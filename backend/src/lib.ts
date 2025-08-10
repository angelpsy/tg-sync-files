import { PrismaClient } from '@prisma/client';

import { serviceLoggers } from '../../shared/logger';

import { loadConfig, type AppConfig } from './config/env';
import { SchedulerService } from './core/services/SchedulerService';
import { SyncService } from './core/services/SyncService';
import { FSService } from './infrastructure/fs/FSService';
import { StorageService } from './infrastructure/storage/StorageService';
import { TelegramService } from './infrastructure/telegram/TelegramService';
import { SocketService } from './infrastructure/ws/SocketService';

import type { ISchedulerService, IStorageService } from '@/types/common';
import type { IFSService, ISyncService } from '@/types/file-sync';
import type { ITelegramService } from '@/types/telegram';
import type { ISocketService } from '@/types/websocket';

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
  syncService: SyncService & ISyncService;
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

  const scheduler = new SchedulerService(fsService, storage);
  await scheduler.start();

  const syncService = new SyncService(
    fsService,
    telegramService as ITelegramService,
    storage,
    scheduler,
    socketService,
    { persistIntervalMs: 60_000 }
  );
  await syncService.recoverDanglingSessions();

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
      await syncService.shutdown();
    } catch (e) {
      logger.error('SyncService shutdown error', { e });
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
    syncService,
    shutdown,
    startedAt,
  };
}
