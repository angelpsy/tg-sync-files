import { PrismaClient } from '@prisma/client';

import { serviceLoggers } from '../../shared/logger';

import { loadConfig, type AppConfig } from './config/env';
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
  IUploadOrchestrator,
} from '@/types';

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

export interface BackendServices {
  config: AppConfig;
  prisma: PrismaClient;
  storage: IStorageService;
  fsService: IFSService;
  telegramService?: ITelegramService;
  socketService: ISocketService;
  scheduler: ISchedulerService;
  uploadOrchestrator: UploadOrchestrator & IUploadOrchestrator;
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
  socketService.onClientConnect(clientId => {
    if (!lastTrees) return;
    try {
      // Emit to all for simplicity; optimization to target client would require sendToClient-event mapping
      socketService.emit(
        'folder_tree_update',
        lastTrees as unknown as EventPayloadMap['folder_tree_update']
      );
    } catch (e) {
      logger.error('Emit on connect failed', { clientId, error: e });
    }
  });

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
    shutdown,
    startedAt,
  };
}
