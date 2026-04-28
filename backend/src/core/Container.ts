import prismaPkg from '@prisma/client';
import type { PrismaClient as PrismaClientType } from '@prisma/client';

const { PrismaClient } = prismaPkg as unknown as {
  PrismaClient: new () => PrismaClientType;
};

import { serviceLoggers } from '../../../shared/logger.mts';
import type { IDownloadOrchestrator } from '../../../types/file-sync/index.js';
import type {
  IFSService,
  ISchedulerService,
  ISocketService,
  IStorageService,
  ITelegramService,
  IUploadOrchestrator,
} from '../../../types/index.js';
import type { AppConfig } from '../config/env';
import { FSService } from '../infrastructure/fs/FSService';
import { ensureDatabaseSchema } from '../infrastructure/storage/PrismaSetup';
import { StorageService } from '../infrastructure/storage/StorageService';
import { TelegramService } from '../infrastructure/telegram/TelegramService';
import { SocketService } from '../infrastructure/ws/SocketService';
import { hasDestroy, hasShutdown } from '../shared/service-utils';

import { DownloadOrchestrator } from './services/DownloadOrchestrator';
import { SchedulerService } from './services/SchedulerService';
import { UploadOrchestrator } from './services/UploadOrchestrator';

export class ServiceContainer {
  public prisma!: PrismaClientType;
  public storage!: IStorageService;
  public fsService!: IFSService;
  public telegramService?: ITelegramService;
  public socketService!: ISocketService;
  public scheduler!: ISchedulerService;
  public uploadOrchestrator!: UploadOrchestrator & IUploadOrchestrator;
  public downloadOrchestrator!: DownloadOrchestrator & IDownloadOrchestrator;

  constructor(private config: AppConfig) {}

  async initialize(): Promise<void> {
    const logger = serviceLoggers.api;

    // 1. Prisma & Storage
    this.prisma = new PrismaClient();
    await ensureDatabaseSchema(this.prisma, logger);
    this.storage = new StorageService(this.prisma);

    // 2. FS Service
    this.fsService = new FSService({
      maxDepth: 3,
      ignoredFolders: [],
      ignoredFiles: [],
      watchPaths: this.config.watchPaths,
    });

    // 3. Telegram Service (Optional)
    if (this.config.telegramApiId && this.config.telegramApiHash) {
      this.telegramService = new TelegramService(
        this.storage,
        this.config.telegramApiId,
        this.config.telegramApiHash
      );
      try {
        await this.telegramService.initialize();
      } catch (e) {
        logger.error('Telegram initialization failed', { error: e });
      }
    }

    // 4. Socket Service
    this.socketService = new SocketService({
      port: this.config.wsPort,
    });
    await this.socketService.initialize();

    // 5. Scheduler
    this.scheduler = new SchedulerService(this.fsService, this.storage);
    await this.scheduler.start();
    this.scheduler.scheduleFileScan(30_000);

    // 6. Orchestrators
    this.uploadOrchestrator = new UploadOrchestrator(
      this.fsService,
      this.telegramService as ITelegramService,
      this.storage,
      this.scheduler,
      this.socketService,
      { persistIntervalMs: 60_000 }
    );
    await this.uploadOrchestrator.recoverDanglingSessions();

    this.downloadOrchestrator = new DownloadOrchestrator(
      this.telegramService as ITelegramService,
      this.storage,
      this.socketService,
      this.scheduler,
      { maxParallelDownloads: 1, persistIntervalMs: 60_000 }
    );
  }

  async shutdown(): Promise<void> {
    const logger = serviceLoggers.api;
    logger.info('ServiceContainer shutdown start');

    const tasks = [
      () => this.uploadOrchestrator?.shutdown(),
      () => this.downloadOrchestrator?.shutdown(),
      () => this.scheduler?.stop(),
      () => {
        if (this.socketService && hasShutdown(this.socketService)) {
          return this.socketService.shutdown();
        }
      },
      () => this.fsService?.stopWatching(),
      () => {
        if (this.telegramService && hasDestroy(this.telegramService)) {
          return this.telegramService.destroy();
        }
      },
      () => this.prisma?.$disconnect(),
    ];

    for (const task of tasks) {
      try {
        await task();
      } catch (e) {
        logger.error('Shutdown task failed', { error: e });
      }
    }

    logger.info('ServiceContainer shutdown complete');
  }
}
