import type { PrismaClient } from '@prisma/client';

import { serviceLoggers } from '../../shared/logger.mts';
import type {
  IDownloadOrchestrator,
  TFileHashStrategy,
  TUploadConflictPolicy,
} from '../../types/file-sync/index.ts';
import type {
  EventPayloadMap,
  IFSService,
  IFolderTree,
  ISchedulerService,
  ISocketService,
  IStorageService,
  ITelegramQrAuthStartResult,
  ITelegramQrAuthWaitResult,
  ITelegramService,
  ITelegramStartAuthResult,
  ITelegramUserMinimal,
  IUploadOrchestrator,
} from '../../types/index.ts';
import { WSEvent } from '../../types/websocket/WSEvent.ts';

import { loadConfig, type AppConfig } from './config/env';
import { ServiceContainer } from './core/Container';
import { hasDestroy, hasHealthProvider, hasInbound } from './shared/service-utils';

export interface BackendServices {
  config: AppConfig;
  prisma: PrismaClient;
  storage: IStorageService;
  fsService: IFSService;
  telegramService?: ITelegramService;
  socketService: ISocketService;
  scheduler: ISchedulerService;
  uploadOrchestrator: IUploadOrchestrator;
  downloadOrchestrator: IDownloadOrchestrator;
  shutdown: () => Promise<void>;
  startedAt: Date;
}

export async function createBackendServices(): Promise<BackendServices> {
  const startedAt = new Date();
  const logger = serviceLoggers.api;
  const config = loadConfig();
  logger.info('Creating backend services', { config });

  const container = new ServiceContainer(config);
  await container.initialize();

  const {
    prisma,
    storage,
    fsService,
    telegramService,
    socketService,
    scheduler,
    uploadOrchestrator,
    downloadOrchestrator,
  } = container;

  // Wire FS updates to WS events and start watcher
  let lastTrees: IFolderTree[] | undefined;
  fsService.onUpdate((trees: IFolderTree[]) => {
    lastTrees = trees;
    try {
      socketService.emit(
        WSEvent.FOLDER_TREE_UPDATE,
        trees as unknown as EventPayloadMap[typeof WSEvent.FOLDER_TREE_UPDATE]
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
      WSEvent.FOLDER_TREE_UPDATE,
      lastTrees as unknown as EventPayloadMap[typeof WSEvent.FOLDER_TREE_UPDATE]
    );
  } catch (e) {
    logger.error('Initial scan failed', { error: e });
  }

  // Send current tree to newly connected clients
  socketService.onClientConnect(async (clientId: string) => {
    if (!lastTrees) return;
    try {
      // Emit to all for simplicity; optimization to target client would require sendToClient-event mapping
      socketService.emit(
        WSEvent.FOLDER_TREE_UPDATE,
        lastTrees as unknown as EventPayloadMap[typeof WSEvent.FOLDER_TREE_UPDATE]
      );
      // Also emit current upload sessions snapshot for reconnecting UI
      try {
        const sessions = await uploadOrchestrator.listSessions();
        socketService.emit(WSEvent.UPLOAD_SESSIONS_SNAPSHOT, { sessions });
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
    const tg = telegramService;
    type WithMe = ITelegramService & { getMeMinimal?: () => Promise<ITelegramUserMinimal | null> };
    socketService.onClientConnect(async (clientId: string) => {
      try {
        const channels = await tg.getChannels();
        socketService.emit(WSEvent.CHANNELS_SNAPSHOT, channels);
        // Also broadcast current auth state
        const isOk = await tg.checkSession();
        const getMe = (tg as WithMe).getMeMinimal?.bind(tg as ITelegramService);
        const maybeUser = getMe ? await getMe() : null;
        socketService.emit(WSEvent.AUTH_STATE, {
          isAuthenticated: isOk,
          user: maybeUser ?? undefined,
        });
      } catch (e) {
        logger.error('channels_snapshot emit failed', { clientId, error: e });
      }
    });

    if (hasInbound(socketService)) {
      // Auth flow: auth_init -> code -> password (optional)
      socketService.onInbound(WSEvent.AUTH_INIT, async (cid, payload: { phone: string }) => {
        logger.info('AUTH_INIT received', { cid });
        try {
          const svc = tg as ITelegramService & {
            startAuth?: (p: string) => Promise<ITelegramStartAuthResult>;
          };
          if (!svc.startAuth) {
            logger.error('startAuth not supported on TelegramService');
            throw new Error('startAuth not supported');
          }
          logger.debug('Starting auth for phone');
          const res = await svc.startAuth(payload.phone);
          logger.info('Auth initiated, sending AUTH_PENDING_CODE', {
            maskedPhone: res.maskedPhone,
            deliveryType: res.delivery?.type,
            nextDeliveryType: res.delivery?.nextType,
            timeoutSec: res.delivery?.timeoutSec,
          });
          socketService.emit(WSEvent.AUTH_PENDING_CODE, {
            maskedPhone: res.maskedPhone,
            delivery: res.delivery,
          });
          socketService.emit(WSEvent.AUTH_STATE, { isAuthenticated: false });
        } catch (e) {
          logger.error('AUTH_INIT failed', { cid, error: e });
          socketService.emit(WSEvent.AUTH_ERROR, {
            code: 'AUTH_INIT_FAILED',
            message: (e as Error).message,
          });
        }
      });
      socketService.onInbound(WSEvent.AUTH_QR_INIT, async cid => {
        logger.info('AUTH_QR_INIT received', { cid });
        try {
          const svc = tg as ITelegramService & {
            startQrAuth?: () => Promise<ITelegramQrAuthStartResult>;
            waitForQrAuth?: () => Promise<ITelegramQrAuthWaitResult>;
          };
          if (!svc.startQrAuth || !svc.waitForQrAuth) {
            throw new Error('QR auth not supported');
          }

          const res = await svc.startQrAuth();
          socketService.emit(WSEvent.AUTH_QR_CODE, res.qr);
          socketService.emit(WSEvent.AUTH_STATE, { isAuthenticated: false });

          void svc
            .waitForQrAuth()
            .then(async result => {
              if ('needsPassword' in result) {
                socketService.emit(WSEvent.AUTH_PENDING_PASSWORD, {
                  maskedPhone: result.maskedPhone,
                });
                socketService.emit(WSEvent.AUTH_STATE, { isAuthenticated: false });
                return;
              }

              socketService.emit(WSEvent.AUTH_SUCCESS, { maskedPhone: result.maskedPhone || '' });
              try {
                const channels = await tg.getChannels();
                socketService.emit(WSEvent.CHANNELS_SNAPSHOT, channels);
              } catch (err) {
                logger.warn('emit channels after QR auth failed', { error: err });
              }

              const isOk = await tg.checkSession();
              const getMe = (tg as WithMe).getMeMinimal?.bind(tg as ITelegramService);
              const maybeUser = getMe ? await getMe() : null;
              socketService.emit(WSEvent.AUTH_STATE, {
                isAuthenticated: isOk,
                user: maybeUser ?? undefined,
              });
            })
            .catch(error => {
              if ((error as Error).message === 'QR_AUTH_CANCELLED') return;
              logger.error('QR auth wait failed', { cid, error });
              socketService.emit(WSEvent.AUTH_ERROR, {
                code: 'AUTH_QR_FAILED',
                message: (error as Error).message,
              });
            });
        } catch (e) {
          logger.error('AUTH_QR_INIT failed', { cid, error: e });
          socketService.emit(WSEvent.AUTH_ERROR, {
            code: 'AUTH_QR_INIT_FAILED',
            message: (e as Error).message,
          });
        }
      });
      socketService.onInbound(WSEvent.AUTH_QR_CANCEL, async cid => {
        logger.info('AUTH_QR_CANCEL received', { cid });
        try {
          const svc = tg as ITelegramService & {
            cancelQrAuth?: () => Promise<void>;
          };
          await svc.cancelQrAuth?.();
        } catch (e) {
          logger.warn('AUTH_QR_CANCEL failed', { cid, error: e });
        }
      });
      socketService.onInbound(WSEvent.AUTH_CODE, async (cid, payload: { code: string }) => {
        try {
          const svc = tg as ITelegramService & {
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
            socketService.emit(WSEvent.AUTH_PENDING_PASSWORD, { maskedPhone: res.maskedPhone });
            socketService.emit(WSEvent.AUTH_STATE, { isAuthenticated: false });
          } else {
            socketService.emit(WSEvent.AUTH_SUCCESS, { maskedPhone: res.maskedPhone || '' });
            // Immediately refresh channels for client after successful auth
            try {
              const channels = await tg.getChannels();
              socketService.emit(WSEvent.CHANNELS_SNAPSHOT, channels);
            } catch (err) {
              logger.warn('emit channels after auth failed', { error: err });
            }
            // Emit state update
            const isOk = await tg.checkSession();
            const getMe = (tg as WithMe).getMeMinimal?.bind(tg as ITelegramService);
            const maybeUser = getMe ? await getMe() : null;
            socketService.emit(WSEvent.AUTH_STATE, {
              isAuthenticated: isOk,
              user: maybeUser ?? undefined,
            });
          }
        } catch (e) {
          logger.error('auth_code failed', { cid, error: e });
          socketService.emit(WSEvent.AUTH_ERROR, {
            code: 'AUTH_CODE_FAILED',
            message: (e as Error).message,
          });
        }
      });
      socketService.onInbound(WSEvent.AUTH_RESEND_CODE, async cid => {
        try {
          const svc = tg as ITelegramService & {
            resendAuthCode?: () => Promise<ITelegramStartAuthResult>;
          };
          if (!svc.resendAuthCode) throw new Error('resendAuthCode not supported');
          const res = await svc.resendAuthCode();
          logger.info('Auth code resent, sending AUTH_PENDING_CODE', {
            maskedPhone: res.maskedPhone,
            deliveryType: res.delivery?.type,
            nextDeliveryType: res.delivery?.nextType,
            timeoutSec: res.delivery?.timeoutSec,
          });
          socketService.emit(WSEvent.AUTH_PENDING_CODE, {
            maskedPhone: res.maskedPhone,
            delivery: res.delivery,
          });
        } catch (e) {
          logger.error('auth_resend_code failed', { cid, error: e });
          socketService.emit(WSEvent.AUTH_ERROR, {
            code: 'AUTH_RESEND_CODE_FAILED',
            message: (e as Error).message,
          });
        }
      });
      socketService.onInbound(WSEvent.AUTH_PASSWORD, async (cid, payload: { password: string }) => {
        try {
          const svc = tg as ITelegramService & {
            submitPassword?: (password: string) => Promise<{ success: true; maskedPhone?: string }>;
          };
          if (!svc.submitPassword) throw new Error('submitPassword not supported');
          const res = await svc.submitPassword(payload.password);
          socketService.emit(WSEvent.AUTH_SUCCESS, { maskedPhone: res.maskedPhone || '' });
          // Immediately refresh channels for client after successful auth
          try {
            const channels = await tg.getChannels();
            socketService.emit(WSEvent.CHANNELS_SNAPSHOT, channels);
          } catch (err) {
            logger.warn('emit channels after auth (password) failed', { error: err });
          }
          // Emit state update (now authenticated)
          const isOk = await tg.checkSession();
          const getMe = (tg as WithMe).getMeMinimal?.bind(tg as ITelegramService);
          const maybeUser = getMe ? await getMe() : null;
          socketService.emit(WSEvent.AUTH_STATE, {
            isAuthenticated: isOk,
            user: maybeUser ?? undefined,
          });
        } catch (e) {
          logger.error('auth_password failed', { cid, error: e });
          socketService.emit(WSEvent.AUTH_ERROR, {
            code: 'AUTH_PASSWORD_FAILED',
            message: (e as Error).message,
          });
        }
      });
      // request_auth_state
      socketService.onInbound(WSEvent.REQUEST_AUTH_STATE, async cid => {
        try {
          const isOk = await tg.checkSession();
          const getMe = (tg as WithMe).getMeMinimal?.bind(tg as ITelegramService);
          const maybeUser = getMe ? await getMe() : null;
          socketService.emit(WSEvent.AUTH_STATE, {
            isAuthenticated: isOk,
            user: maybeUser ?? undefined,
          });
        } catch (e) {
          logger.error('request_auth_state failed', { cid, error: e });
        }
      });

      // auth_logout
      socketService.onInbound(WSEvent.AUTH_LOGOUT, async cid => {
        try {
          // Clear sessions in DB and disconnect telegram client
          await storage.clearTelegramSessions();
          if (hasDestroy(tg)) await tg.destroy();
          // Emit unauthenticated state and empty channels
          socketService.emit(WSEvent.AUTH_STATE, { isAuthenticated: false });
          socketService.emit(
            WSEvent.CHANNELS_SNAPSHOT,
            [] as unknown as EventPayloadMap[typeof WSEvent.CHANNELS_SNAPSHOT]
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
      socketService.onInbound(WSEvent.REQUEST_CHANNELS, async cid => {
        try {
          const channels = await tg.getChannels();
          socketService.emit(WSEvent.CHANNELS_SNAPSHOT, channels);
        } catch (e) {
          logger.error('request_channels failed', { cid, error: e });
        }
      });
      // request_topics { channelId }
      socketService.onInbound(
        WSEvent.REQUEST_TOPICS,
        async (cid, payload: { channelId: string }) => {
          try {
            const topics = await tg.getTopics(payload.channelId);
            socketService.emit(WSEvent.TOPICS_SNAPSHOT, { channelId: payload.channelId, topics });
          } catch (e) {
            logger.error('request_topics failed', { cid, payload, error: e });
          }
        }
      );
      // request_topic_files { topicId }
      socketService.onInbound(
        WSEvent.REQUEST_TOPIC_FILES,
        async (cid, payload: { topicId: string }) => {
          try {
            // Try to find channel id for this topic via probing topics across channels
            const chans = await tg.getChannels();
            let foundChannelId: string | undefined;
            let remoteFiles: Array<{
              id: string;
              name?: string;
              size?: number;
              mimeType?: string;
            }> = [];
            for (const ch of chans) {
              try {
                const ts = await tg.getTopics(ch.id);
                if (ts.some((t: { id: string }) => t.id === payload.topicId)) {
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
                remoteFiles = await tg.listTopicFiles(foundChannelId, payload.topicId);
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
            socketService.emit(WSEvent.TOPIC_FILES_SNAPSHOT, {
              topicId: payload.topicId,
              files: remoteFiles.map(f => ({
                id: f.id,
                name: f.name || '',
                size: f.size || 0,
                mimeType: f.mimeType,
                uploadedAt: new Date(),
                messageId: 0,
              })),
              records: finalRecords,
              originalFolders,
            });
          } catch (e) {
            logger.error('request_topic_files failed', { cid, payload, error: e });
          }
        }
      );

      // Start single folder upload (new or existing topic)
      socketService.onInbound(WSEvent.START_FOLDER_UPLOAD, async (cid, payload) => {
        try {
          const {
            folderPath,
            channelId,
            existingTopicId,
            newTopicName,
            selectedFiles,
            conflictPolicy,
            hashStrategy,
          } = payload as EventPayloadMap[typeof WSEvent.START_FOLDER_UPLOAD];
          let topicId = existingTopicId;
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
            socketService.emit(WSEvent.UPLOAD_SESSIONS_SNAPSHOT, { sessions });
          } catch (e) {
            logger.debug('upload sessions snapshot emit failed', { error: e });
          }
        } catch (e) {
          logger.error('start_folder_upload failed', { cid, payload, error: e });
        }
      });

      // Start bulk folder uploads
      socketService.onInbound(WSEvent.START_BULK_FOLDER_UPLOAD, async (cid, payload) => {
        const arr = payload as EventPayloadMap[typeof WSEvent.START_BULK_FOLDER_UPLOAD];
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
          socketService.emit(WSEvent.UPLOAD_SESSIONS_SNAPSHOT, { sessions });
        } catch (e) {
          logger.debug('upload sessions snapshot emit failed (bulk)', { error: e });
        }
      });

      // request_upload_sessions
      socketService.onInbound(WSEvent.REQUEST_UPLOAD_SESSIONS, async cid => {
        try {
          const sessions = await uploadOrchestrator.listSessions();
          socketService.emit(WSEvent.UPLOAD_SESSIONS_SNAPSHOT, { sessions });
        } catch (e) {
          logger.error('request_upload_sessions failed', { cid, error: e });
        }
      });
      // upload control
      socketService.onInbound(WSEvent.PAUSE_UPLOAD, async (cid, payload) => {
        try {
          await uploadOrchestrator.pauseUpload(payload.uploadId);
          const sessions = await uploadOrchestrator.listSessions();
          socketService.emit(WSEvent.UPLOAD_SESSIONS_SNAPSHOT, { sessions });
        } catch (e) {
          logger.error('pause_upload failed', { cid, error: e });
        }
      });
      socketService.onInbound(WSEvent.RESUME_UPLOAD, async (cid, payload) => {
        try {
          await uploadOrchestrator.resumeUpload(payload.uploadId);
          const sessions = await uploadOrchestrator.listSessions();
          socketService.emit(WSEvent.UPLOAD_SESSIONS_SNAPSHOT, { sessions });
        } catch (e) {
          logger.error('resume_upload failed', { cid, error: e });
        }
      });
      socketService.onInbound(WSEvent.CANCEL_UPLOAD, async (cid, payload) => {
        try {
          await uploadOrchestrator.cancelUpload(payload.uploadId);
          const sessions = await uploadOrchestrator.listSessions();
          socketService.emit(WSEvent.UPLOAD_SESSIONS_SNAPSHOT, { sessions });
        } catch (e) {
          logger.error('cancel_upload failed', { cid, error: e });
        }
      });

      // Download handlers
      socketService.onInbound(
        WSEvent.START_TOPIC_DOWNLOAD,
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
            socketService.emit(WSEvent.DOWNLOAD_ERROR, {
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

      socketService.onInbound(WSEvent.REQUEST_DOWNLOAD_SESSIONS, async cid => {
        try {
          const sessions = await downloadOrchestrator.listSessions();
          socketService.emit(WSEvent.DOWNLOAD_SESSIONS_SNAPSHOT, { sessions });
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
            WSEvent.CHANNELS_SNAPSHOT,
            channels as unknown as EventPayloadMap[typeof WSEvent.CHANNELS_SNAPSHOT]
          );
        } catch (e) {
          logger.error('env channels emit failed', { clientId, error: e });
        }
      });
      if (hasInbound(socketService)) {
        socketService.onInbound(WSEvent.REQUEST_CHANNELS, cid => {
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
              WSEvent.CHANNELS_SNAPSHOT,
              channels as unknown as EventPayloadMap[typeof WSEvent.CHANNELS_SNAPSHOT]
            );
          } catch (e) {
            logger.error('env request_channels failed', { cid, error: e });
          }
        });
      }
    }
  }

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
    shutdown: () => container.shutdown(),
    startedAt,
  };
}
