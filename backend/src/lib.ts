import { PrismaClient } from '@prisma/client';

import { serviceLoggers } from '../../shared/logger';

import { loadConfig, type AppConfig } from './config/env';
import { DownloadOrchestrator } from './core/services/DownloadOrchestrator';
import { SchedulerService } from './core/services/SchedulerService';
import { UploadOrchestrator } from './core/services/UploadOrchestrator';
import { FSService } from './infrastructure/fs/FSService';
import { StorageService } from './infrastructure/storage/StorageService';
import { TelegramService } from './infrastructure/telegram/TelegramService';
import { SocketService } from './infrastructure/ws/SocketService';

import type {
  EventPayloadMap,
  IFolderTree,
  IFSService,
  ISchedulerService,
  ISocketService,
  IStorageService,
  ITelegramService,
  ITelegramUserMinimal,
  IUploadOrchestrator,
} from '@/types';
import type {
  IDownloadOrchestrator,
  TFileHashStrategy,
  TUploadConflictPolicy,
} from '@/types/file-sync';
import type { TEventName } from '@/types/websocket/events';

function hasDestroy(svc: unknown): svc is { destroy: () => Promise<void> } {
  return (
    typeof svc === 'object' &&
    svc !== null &&
    'destroy' in svc &&
    typeof (svc as { destroy: unknown }).destroy === 'function'
  );
}

function hasHealthProvider(
  svc: ISocketService
): svc is ISocketService & { setHealthProvider: (fn: () => unknown) => void } {
  return typeof (svc as { setHealthProvider?: unknown }).setHealthProvider === 'function';
}

function hasShutdown(
  svc: ISocketService
): svc is ISocketService & { shutdown: () => Promise<void> } {
  return typeof (svc as { shutdown?: unknown }).shutdown === 'function';
}

function hasInbound(svc: ISocketService): svc is ISocketService & {
  onInbound: <E extends TEventName>(
    event: E,
    handler: (clientId: string, payload: EventPayloadMap[E]) => void
  ) => void;
} {
  return typeof (svc as { onInbound?: unknown }).onInbound === 'function';
}

export interface BackendServices {
  config: AppConfig;
  prisma: PrismaClient;
  storage: IStorageService;
  fsService: IFSService;
  telegramService?: ITelegramService;
  socketService: ISocketService;
  scheduler: ISchedulerService;
  uploadOrchestrator: UploadOrchestrator & IUploadOrchestrator;
  downloadOrchestrator: DownloadOrchestrator & IDownloadOrchestrator;
  shutdown: () => Promise<void>;
  startedAt: Date;
}

export async function createBackendServices(): Promise<BackendServices> {
  const startedAt = new Date();
  const logger = serviceLoggers.api;
  const config = loadConfig();
  logger.info('Creating backend services', { config });

  const prisma = new PrismaClient();
  const storage = new StorageService(prisma as unknown as PrismaClient);

  const fsService = new FSService({
    maxDepth: 3,
    ignoredFolders: [],
    ignoredFiles: [],
    watchPaths: config.watchPaths,
  });

  let telegramService: ITelegramService | undefined;
  if (config.telegramApiId && config.telegramApiHash) {
    telegramService = new TelegramService(storage, config.telegramApiId, config.telegramApiHash);
    try {
      await telegramService.initialize();
    } catch (e) {
      logger.error('Telegram initialization failed', { error: e });
    }
  } else {
    logger.warn('Telegram credentials missing – features requiring Telegram disabled');
  }

  const socketService: ISocketService = new SocketService({
    port: config.wsPort,
  });
  await socketService.initialize();

  // Wire FS updates to WS events and start watcher
  let lastTrees: IFolderTree[] | undefined;
  fsService.onUpdate(trees => {
    lastTrees = trees;
    try {
      socketService.emit(
        'folder_tree_update',
        trees as unknown as EventPayloadMap['folder_tree_update']
      );
    } catch (e) {
      logger.error('Emit folder_tree_update failed', { error: e });
    }
  });
  // Start watching configured paths
  for (const p of config.watchPaths) {
    try {
      await fsService.watchFolder(p);
    } catch (e) {
      logger.error('watchFolder failed', { path: p, error: e });
    }
  }
  // Initial scan and emit
  try {
    lastTrees = await fsService.scanFolders();
    socketService.emit(
      'folder_tree_update',
      lastTrees as unknown as EventPayloadMap['folder_tree_update']
    );
  } catch (e) {
    logger.error('Initial scan failed', { error: e });
  }

  // Send current tree to newly connected clients
  socketService.onClientConnect(async clientId => {
    if (!lastTrees) return;
    try {
      // Emit to all for simplicity; optimization to target client would require sendToClient-event mapping
      socketService.emit(
        'folder_tree_update',
        lastTrees as unknown as EventPayloadMap['folder_tree_update']
      );
      // Also emit current upload sessions snapshot for reconnecting UI
      try {
        const sessions = await uploadOrchestrator.listSessions();
        socketService.emit('upload_sessions_snapshot', { sessions });
      } catch (e) {
        logger.warn('emit upload_sessions_snapshot on connect failed', { clientId, error: e });
      }
    } catch (e) {
      logger.error('Emit on connect failed', { clientId, error: e });
    }
  });

  // Telegram data snapshots and requests
  // Emit channels snapshot on client connect if Telegram is available
  // Telegram channels/topics/files WS API
  if (telegramService) {
    type WithMe = ITelegramService & { getMeMinimal?: () => Promise<ITelegramUserMinimal | null> };
    socketService.onClientConnect(async clientId => {
      try {
        const channels = await telegramService.getChannels();
        socketService.emit('channels_snapshot', channels);
        // Also broadcast current auth state
        const isOk = await telegramService.checkSession();
        const getMe = (telegramService as WithMe).getMeMinimal?.bind(
          telegramService as ITelegramService
        );
        const maybeUser = getMe ? await getMe() : null;
        socketService.emit('auth_state', { isAuthenticated: isOk, user: maybeUser ?? undefined });
      } catch (e) {
        logger.error('channels_snapshot emit failed', { clientId, error: e });
      }
    });

    if (hasInbound(socketService)) {
      // Auth flow: auth_init -> code -> password (optional)
      socketService.onInbound('auth_init', async (cid, payload: { phone: string }) => {
        try {
          const svc = telegramService as ITelegramService & {
            startAuth?: (p: string) => Promise<{ needsCode: true; maskedPhone?: string }>;
          };
          if (!svc.startAuth) throw new Error('startAuth not supported');
          const res = await svc.startAuth(payload.phone);
          socketService.emit('auth_pending_code', { maskedPhone: res.maskedPhone });
          // Emit state update (still unauthenticated)
          const isOk = await telegramService.checkSession();
          const getMe = (telegramService as WithMe).getMeMinimal?.bind(
            telegramService as ITelegramService
          );
          const maybeUser = getMe ? await getMe() : null;
          socketService.emit('auth_state', { isAuthenticated: isOk, user: maybeUser ?? undefined });
        } catch (e) {
          logger.error('auth_init failed', { cid, error: e });
          socketService.emit('auth_error', {
            code: 'AUTH_INIT_FAILED',
            message: (e as Error).message,
          });
        }
      });
      socketService.onInbound('auth_code', async (cid, payload: { code: string }) => {
        try {
          const svc = telegramService as ITelegramService & {
            submitCode?: (
              code: string
            ) => Promise<
              | { success: true; maskedPhone?: string }
              | { needsPassword: true; maskedPhone?: string }
            >;
          };
          if (!svc.submitCode) throw new Error('submitCode not supported');
          const res = await svc.submitCode(payload.code);
          if ('needsPassword' in res) {
            socketService.emit('auth_pending_password', { maskedPhone: res.maskedPhone });
          } else {
            socketService.emit('auth_success', { maskedPhone: res.maskedPhone || '' });
            // Immediately refresh channels for client after successful auth
            try {
              const channels = await telegramService.getChannels();
              socketService.emit('channels_snapshot', channels);
            } catch (err) {
              logger.warn('emit channels after auth failed', { error: err });
            }
          }
          // Emit state update
          const isOk = await telegramService.checkSession();
          const getMe = (telegramService as WithMe).getMeMinimal?.bind(
            telegramService as ITelegramService
          );
          const maybeUser = getMe ? await getMe() : null;
          socketService.emit('auth_state', { isAuthenticated: isOk, user: maybeUser ?? undefined });
        } catch (e) {
          logger.error('auth_code failed', { cid, error: e });
          socketService.emit('auth_error', {
            code: 'AUTH_CODE_FAILED',
            message: (e as Error).message,
          });
        }
      });
      socketService.onInbound('auth_password', async (cid, payload: { password: string }) => {
        try {
          const svc = telegramService as ITelegramService & {
            submitPassword?: (password: string) => Promise<{ success: true; maskedPhone?: string }>;
          };
          if (!svc.submitPassword) throw new Error('submitPassword not supported');
          const res = await svc.submitPassword(payload.password);
          socketService.emit('auth_success', { maskedPhone: res.maskedPhone || '' });
          // Immediately refresh channels for client after successful auth
          try {
            const channels = await telegramService.getChannels();
            socketService.emit('channels_snapshot', channels);
          } catch (err) {
            logger.warn('emit channels after auth (password) failed', { error: err });
          }
          // Emit state update (now authenticated)
          const isOk = await telegramService.checkSession();
          const getMe = (telegramService as WithMe).getMeMinimal?.bind(
            telegramService as ITelegramService
          );
          const maybeUser = getMe ? await getMe() : null;
          socketService.emit('auth_state', { isAuthenticated: isOk, user: maybeUser ?? undefined });
        } catch (e) {
          logger.error('auth_password failed', { cid, error: e });
          socketService.emit('auth_error', {
            code: 'AUTH_PASSWORD_FAILED',
            message: (e as Error).message,
          });
        }
      });
      // request_auth_state
      socketService.onInbound('request_auth_state', async cid => {
        try {
          const isOk = await telegramService.checkSession();
          const getMe = (telegramService as WithMe).getMeMinimal?.bind(
            telegramService as ITelegramService
          );
          const maybeUser = getMe ? await getMe() : null;
          socketService.emit('auth_state', { isAuthenticated: isOk, user: maybeUser ?? undefined });
        } catch (e) {
          logger.error('request_auth_state failed', { cid, error: e });
        }
      });

      // auth_logout
      socketService.onInbound('auth_logout', async cid => {
        try {
          // Clear sessions in DB and disconnect telegram client
          await storage.clearTelegramSessions();
          if (hasDestroy(telegramService)) await telegramService.destroy();
          // Emit unauthenticated state and empty channels
          socketService.emit('auth_state', { isAuthenticated: false });
          socketService.emit(
            'channels_snapshot',
            [] as unknown as EventPayloadMap['channels_snapshot']
          );
        } catch (e) {
          logger.error('auth_logout failed', { cid, error: e });
          socketService.emit('auth_error', {
            code: 'AUTH_LOGOUT_FAILED',
            message: (e as Error).message,
          });
        }
      });
      // request_channels
      socketService.onInbound('request_channels', async cid => {
        try {
          const channels = await telegramService.getChannels();
          socketService.emit('channels_snapshot', channels);
        } catch (e) {
          logger.error('request_channels failed', { cid, error: e });
        }
      });
      // request_topics { channelId }
      socketService.onInbound('request_topics', async (cid, payload: { channelId: string }) => {
        try {
          const topics = await telegramService.getTopics(payload.channelId);
          socketService.emit('topics_snapshot', { channelId: payload.channelId, topics });
        } catch (e) {
          logger.error('request_topics failed', { cid, payload, error: e });
        }
      });
      // request_topic_files { topicId }
      socketService.onInbound('request_topic_files', async (cid, payload: { topicId: string }) => {
        try {
          // Try to find channel id for this topic via probing topics across channels
          const chans = await telegramService.getChannels();
          let foundChannelId: string | undefined;
          let remoteFiles: Array<{ id: string; name?: string; size?: number; mimeType?: string }> =
            [];
          for (const ch of chans) {
            try {
              const ts = await telegramService.getTopics(ch.id);
              if (ts.some(t => t.id === payload.topicId)) {
                foundChannelId = ch.id;
                break;
              }
            } catch {
              // ignore per-channel errors
            }
          }
          // If channel is unknown, just emit what we have in DB (do not hard fail)
          if (foundChannelId) {
            try {
              remoteFiles = await telegramService.listTopicFiles(foundChannelId, payload.topicId);
            } catch (err) {
              logger.warn('listTopicFiles failed; continuing with DB records only', {
                topicId: payload.topicId,
                error: (err as Error).message,
              });
            }
          } else {
            logger.warn('Channel for topic not found; emitting DB records only', {
              topicId: payload.topicId,
            });
          }
          // Persisted records and original folders (from DB)
          const records = await storage.getTopicFileRecords(payload.topicId);
          // If DB has no records yet, synthesize view-only records from Telegram listing so UI isn't empty
          const finalRecords =
            records && records.length > 0
              ? records
              : remoteFiles.map((f, idx) => ({
                  id: `remote:${payload.topicId}:${f.id || idx}`,
                  folderPath: '(remote)',
                  topicId: payload.topicId,
                  fileName: f.name || `file_${String(f.id || idx)}`,
                  size: f.size || 0,
                  mtimeMs: Date.now(),
                  uploadedAt: new Date(),
                  updatedAt: new Date(),
                  hash: undefined,
                }));
          const originalFolders = Array.from(new Set(finalRecords.map(r => r.folderPath)));
          socketService.emit('topic_files_snapshot', {
            topicId: payload.topicId,
            records: finalRecords,
            originalFolders,
          } as unknown as EventPayloadMap['topic_files_snapshot']);
        } catch (e) {
          logger.error('request_topic_files failed', { cid, payload, error: e });
        }
      });

      // Start single folder upload (new or existing topic)
      socketService.onInbound('start_folder_upload', async (cid, payload) => {
        try {
          const {
            folderPath,
            channelId,
            existingTopicId,
            newTopicName,
            selectedFiles,
            conflictPolicy,
            hashStrategy,
          } = payload as EventPayloadMap['start_folder_upload'];
          let topicId = existingTopicId;
          const tg = telegramService as ITelegramService;
          if (!topicId) {
            if (!newTopicName)
              throw new Error('Either existingTopicId or newTopicName is required');
            const topic = await tg.createTopic(channelId, newTopicName);
            topicId = topic.id;
          }
          if (!topicId) throw new Error('Topic id resolution failed');
          await uploadOrchestrator.startUpload(folderPath, channelId, topicId, {
            conflictPolicy: conflictPolicy as TUploadConflictPolicy,
            hashStrategy: hashStrategy as TFileHashStrategy,
            selectedFiles,
          });
          // Optionally emit refreshed sessions snapshot
          try {
            const sessions = await uploadOrchestrator.listSessions();
            socketService.emit('upload_sessions_snapshot', { sessions });
          } catch (e) {
            logger.debug('upload sessions snapshot emit failed', { error: e });
          }
        } catch (e) {
          logger.error('start_folder_upload failed', { cid, payload, error: e });
        }
      });

      // Start bulk folder uploads
      socketService.onInbound('start_bulk_folder_upload', async (cid, payload) => {
        const arr = payload as EventPayloadMap['start_bulk_folder_upload'];
        for (const item of arr) {
          try {
            const {
              folderPath,
              channelId,
              existingTopicId,
              newTopicName,
              selectedFiles,
              conflictPolicy,
              hashStrategy,
            } = item;
            let topicId = existingTopicId;
            const tg = telegramService as ITelegramService;
            if (!topicId) {
              if (!newTopicName)
                throw new Error('Either existingTopicId or newTopicName is required');
              const topic = await tg.createTopic(channelId, newTopicName);
              topicId = topic.id;
            }
            if (!topicId) throw new Error('Topic id resolution failed');
            await uploadOrchestrator.startUpload(folderPath, channelId, topicId, {
              conflictPolicy: (conflictPolicy as TUploadConflictPolicy) || undefined,
              hashStrategy: (hashStrategy as TFileHashStrategy) || undefined,
              selectedFiles,
            });
          } catch (e) {
            logger.error('bulk item start failed', { item, error: e });
          }
        }
        try {
          const sessions = await uploadOrchestrator.listSessions();
          socketService.emit('upload_sessions_snapshot', { sessions });
        } catch (e) {
          logger.debug('upload sessions snapshot emit failed (bulk)', { error: e });
        }
      });

      // request_upload_sessions
      socketService.onInbound('request_upload_sessions', async cid => {
        try {
          const sessions = await uploadOrchestrator.listSessions();
          socketService.emit('upload_sessions_snapshot', { sessions });
        } catch (e) {
          logger.error('request_upload_sessions failed', { cid, error: e });
        }
      });

      // Download handlers
      socketService.onInbound(
        'start_topic_download',
        async (
          cid,
          payload: {
            topicId: string;
            channelId: string;
            targetPath: string;
            selectedFiles?: string[];
            overwriteExisting?: boolean;
          }
        ) => {
          try {
            logger.info('start_topic_download received', { cid, payload });
            const result = await downloadOrchestrator.startDownload(
              payload.topicId,
              payload.channelId,
              payload.targetPath,
              {
                selectedFiles: payload.selectedFiles,
                overwriteExisting: payload.overwriteExisting,
              }
            );
            logger.info('start_topic_download completed', { sessionId: result.id });
          } catch (e) {
            logger.error('start_topic_download failed', { cid, error: e, payload });
            socketService.emit('download_error', {
              downloadId: 'unknown',
              topicId: payload.topicId,
              error: (e as Error).message,
              timestamp: Date.now(),
            });
          }
        }
      );

      // TODO: Add download_pause and download_resume events to WebSocket schema
      // socketService.onInbound('download_pause', ...)
      // socketService.onInbound('download_resume', ...)

      socketService.onInbound('request_download_sessions', async cid => {
        try {
          const sessions = await downloadOrchestrator.listSessions();
          socketService.emit('download_sessions_snapshot', { sessions });
        } catch (e) {
          logger.error('request_download_sessions failed', { cid, error: e });
        }
      });
    }
  } else {
    // Fallback: serve channels from env if provided
    if (Array.isArray(config.channelIds) && config.channelIds.length > 0) {
      socketService.onClientConnect(clientId => {
        try {
          const channels = (config.channelIds as string[]).map((id: string) => ({
            id,
            title: id,
            name: id,
            username: undefined,
            accessHash: undefined,
            isGroup: false,
            isForum: true,
            participantsCount: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));
          socketService.emit(
            'channels_snapshot',
            channels as unknown as EventPayloadMap['channels_snapshot']
          );
        } catch (e) {
          logger.error('env channels emit failed', { clientId, error: e });
        }
      });
      if (hasInbound(socketService)) {
        socketService.onInbound('request_channels', cid => {
          try {
            const channels = (config.channelIds as string[]).map((id: string) => ({
              id,
              title: id,
              name: id,
              username: undefined,
              accessHash: undefined,
              isGroup: false,
              isForum: true,
              participantsCount: 0,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));
            socketService.emit(
              'channels_snapshot',
              channels as unknown as EventPayloadMap['channels_snapshot']
            );
          } catch (e) {
            logger.error('env request_channels failed', { cid, error: e });
          }
        });
      }
    }
  }

  const scheduler = new SchedulerService(fsService, storage);
  await scheduler.start();
  // Periodic re-scan to catch missed changes and update cache (e.g., every 30s)
  scheduler.scheduleFileScan(30_000);

  const uploadOrchestrator = new UploadOrchestrator(
    fsService,
    telegramService as ITelegramService,
    storage,
    scheduler,
    socketService,
    { persistIntervalMs: 60_000 }
  );
  await uploadOrchestrator.recoverDanglingSessions();

  const downloadOrchestrator = new DownloadOrchestrator(
    telegramService as ITelegramService,
    storage,
    socketService,
    scheduler,
    { maxParallelDownloads: 1, persistIntervalMs: 60_000 }
  );

  if (hasHealthProvider(socketService)) {
    socketService.setHealthProvider(() => ({
      status: 'ok',
      startedAt,
      uptimeMs: Date.now() - startedAt.getTime(),
      env: config.env,
      socket: socketService.getStats(),
      scheduler: scheduler.getTasksInfo(),
    }));
  }

  async function shutdown() {
    logger.info('Backend services shutdown start');
    try {
      await uploadOrchestrator.shutdown();
    } catch (e) {
      logger.error('UploadOrchestrator shutdown error', { e });
    }
    try {
      await downloadOrchestrator.shutdown();
    } catch (e) {
      logger.error('DownloadOrchestrator shutdown error', { e });
    }
    try {
      await scheduler.stop();
    } catch (e) {
      logger.error('Scheduler shutdown error', { e });
    }
    if (hasShutdown(socketService)) {
      try {
        await socketService.shutdown();
      } catch (e) {
        logger.error('Socket shutdown error', { e });
      }
    }
    try {
      fsService.stopWatching();
    } catch (e) {
      logger.error('FS watcher stop error', { e });
    }
    if (telegramService && hasDestroy(telegramService)) {
      try {
        await telegramService.destroy();
      } catch (e) {
        logger.error('Telegram destroy error', { e });
      }
    }
    try {
      await prisma.$disconnect();
    } catch (e) {
      logger.error('Prisma disconnect error', { e });
    }
    logger.info('Backend services shutdown complete');
  }

  return {
    config,
    prisma,
    storage,
    fsService,
    telegramService,
    socketService,
    scheduler,
    uploadOrchestrator,
    downloadOrchestrator,
    shutdown,
    startedAt,
  };
}
