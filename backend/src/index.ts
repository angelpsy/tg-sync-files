/**
 * Backend bootstrap entrypoint.
 * Wires core services, performs session recovery, starts scheduler.
 * Lightweight: no HTTP layer yet; focuses on sync + persistence lifecycle.
 */
import { resolve } from 'path';

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

// Load env from project root .env if present (after prisma import per lint grouping rules)
config({ path: resolve(process.cwd(), '.env') });

import { serviceLoggers } from '../../shared/logger';

import { SchedulerService } from './core/services/SchedulerService';
import { SyncService } from './core/services/SyncService';
import { FSService } from './infrastructure/fs/FSService';
import { StorageService } from './infrastructure/storage/StorageService';
import { TelegramService } from './infrastructure/telegram/TelegramService';
import { SocketService } from './infrastructure/ws/SocketService';

import type { ITelegramService } from '@/types/telegram';
import type { ISocketService } from '@/types/websocket';

// (Removed temporary Noop services and wrapper; real implementations will be injected below)

async function bootstrap(): Promise<void> {
  const logger = serviceLoggers.api; // reuse existing service logger (api) for bootstrap phase
  logger.info('Bootstrap start');

  // Instantiate infra
  const prisma = new PrismaClient();
  const storage = new StorageService(prisma as unknown as PrismaClient);

  // Real implementations should be injected here (FSService is real, others are no-op for now)
  const rawFs = new FSService({
    maxDepth: 3,
    ignoredFolders: [],
    ignoredFiles: [],
    watchPaths: [],
  });
  const fsService = rawFs; // already implements IFSService
  const apiId = process.env.TELEGRAM_API_ID ? parseInt(process.env.TELEGRAM_API_ID, 10) : undefined;
  const apiHash = process.env.TELEGRAM_API_HASH;
  if (!apiId || !apiHash) {
    logger.warn('Telegram API credentials not provided; TelegramService will not initialize');
  }
  let telegramService: ITelegramService | undefined;
  if (apiId && apiHash) {
    telegramService = new TelegramService(storage, apiId, apiHash);
    try {
      await telegramService.initialize();
    } catch (e) {
      logger.error('Telegram init failed', { error: e });
    }
  }
  const socketService: ISocketService = new SocketService({
    port: process.env.BACKEND_WS_PORT ? parseInt(process.env.BACKEND_WS_PORT, 10) : 0,
  });
  await socketService.initialize();
  const scheduler = new SchedulerService(fsService, storage);
  await scheduler.start();

  const syncService = new SyncService(
    fsService,
    // if telegramService undefined, this will throw later when used; for bootstrap we warn instead
    telegramService as unknown as ITelegramService,
    storage,
    scheduler,
    socketService,
    { persistIntervalMs: 60_000 }
  );

  // Recover dangling sessions before accepting new work
  await syncService.recoverDanglingSessions();
  logger.info('Recovery completed');

  // Graceful shutdown hooks
  const shutdown = async (signal: string) => {
    logger.info('Shutdown signal received', { signal });
    try {
      await syncService.shutdown();
    } catch (e) {
      logger.error('SyncService shutdown error', { error: e });
    }
    try {
      await scheduler.stop();
    } catch (e) {
      logger.error('Scheduler shutdown error', { error: e });
    }
    try {
      await socketService.shutdown();
    } catch (e) {
      logger.error('SocketService shutdown error', { error: e });
    }
    if (telegramService) {
      try {
        await telegramService.destroy();
      } catch (e) {
        logger.error('Telegram shutdown error', { error: e });
      }
    }
    await prisma.$disconnect().catch(err => logger.error('Prisma disconnect failed', { err }));
    logger.info('Shutdown complete');
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  logger.info('Bootstrap finished (services ready)');
}

// ESM-safe direct run detection: compare executed script path to import.meta.url
const isDirectRun = (() => {
  try {
    const executed = process.argv[1];
    if (!executed) return false;
    const fileUrl = new URL(import.meta.url);
    return fileUrl.protocol === 'file:' && fileUrl.pathname === executed;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  bootstrap().catch(err => {
    // eslint-disable-next-line no-console
    console.error('Fatal bootstrap error', err);
    process.exit(1);
  });
}

export { bootstrap };
