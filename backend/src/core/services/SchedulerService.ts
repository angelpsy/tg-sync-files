import { serviceLoggers } from '../../../../shared/logger.js';

import type { IFSService, ISchedulerService, IStorageService } from '@/types';

/**
 * Scheduled task information
 */
interface ScheduledTask {
  id: string;
  name: string;
  intervalMs: number;
  timer?: NodeJS.Timeout;
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  execute: () => Promise<void>;
}

/**
 * Scheduler Service
 * Manages periodic tasks: FS scanning, cleanup, session checks
 */
export class SchedulerService implements ISchedulerService {
  private readonly logger = serviceLoggers.scheduler;
  private tasks = new Map<string, ScheduledTask>();
  private isStarted = false;

  constructor(
    private readonly fsService: IFSService,
    private readonly storageService: IStorageService
  ) {
    this.logger.info('SchedulerService initialized');
  }

  /**
   * Starts scheduler
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('Scheduler already started');
      return;
    }

    this.isStarted = true;
    this.logger.info('Scheduler started');

    // Start all scheduled tasks
    for (const task of this.tasks.values()) {
      this.startTask(task);
    }
  }

  /**
   * Stops scheduler
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      this.logger.warn('Scheduler not started');
      return;
    }

    this.isStarted = false;
    this.logger.info('Stopping scheduler');

    // Stop all tasks
    for (const task of this.tasks.values()) {
      this.stopTask(task);
    }

    this.tasks.clear();
    this.logger.info('Scheduler stopped');
  }

  /**
   * Pauses scheduler
   */
  async pause(): Promise<void> {
    // TODO: Implement pause functionality
    this.logger.info('Scheduler paused');
  }

  /**
   * Resumes scheduler
   */
  async resume(): Promise<void> {
    // TODO: Implement resume functionality
    this.logger.info('Scheduler resumed');
  }

  /**
   * Gets scheduler status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    isPaused: boolean;
    nextRun?: Date;
    lastRun?: Date;
  }> {
    return {
      isRunning: this.isStarted,
      isPaused: false, // TODO: Implement pause state
      nextRun: undefined, // TODO: Calculate next run time
      lastRun: undefined, // TODO: Track last run time
    };
  }

  /**
   * Forces immediate execution of scheduled tasks
   */
  async executeNow(): Promise<void> {
    this.logger.info('Executing scheduled tasks immediately');
    for (const task of this.tasks.values()) {
      try {
        await task.execute();
        this.logger.debug('Task executed successfully', { taskId: task.id });
      } catch (error) {
        this.logger.error('Task execution failed', {
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Schedules periodic file system scan
   */
  scheduleFileScan(intervalMs: number): void {
    const taskId = 'file-scan';
    const task: ScheduledTask = {
      id: taskId,
      name: 'File System Scan',
      intervalMs,
      isRunning: false,
      execute: async () => {
        this.logger.debug('Executing file system scan');
        if (this.fsService) {
          await this.fsService.forceScan();
        }
      },
    };

    this.tasks.set(taskId, task);

    if (this.isStarted) {
      this.startTask(task);
    }

    this.logger.info('Scheduled file scan task', { intervalMs });
  }

  /**
   * Schedules cleanup of temporary files
   */
  scheduleCleanup(intervalMs: number): void {
    const taskId = 'cleanup';
    const task: ScheduledTask = {
      id: taskId,
      name: 'Cleanup Temporary Files',
      intervalMs,
      isRunning: false,
      execute: async () => {
        this.logger.debug('Executing cleanup task');
        // TODO: Implement cleanup logic
      },
    };

    this.tasks.set(taskId, task);

    if (this.isStarted) {
      this.startTask(task);
    }

    this.logger.info('Scheduled cleanup task', { intervalMs });
  }

  /**
   * Schedules Telegram session status check
   */
  scheduleSessionCheck(intervalMs: number): void {
    const taskId = 'session-check';
    const task: ScheduledTask = {
      id: taskId,
      name: 'Telegram Session Check',
      intervalMs,
      isRunning: false,
      execute: async () => {
        this.logger.debug('Executing session check');
        // TODO: Implement session check logic
      },
    };

    this.tasks.set(taskId, task);

    if (this.isStarted) {
      this.startTask(task);
    }

    this.logger.info('Scheduled session check task', { intervalMs });
  }

  /**
   * Gets information about all tasks
   */
  getTasksInfo(): Array<Omit<ScheduledTask, 'timer' | 'execute'>> {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      name: task.name,
      intervalMs: task.intervalMs,
      isRunning: task.isRunning,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
    }));
  }

  /**
   * Cancels specific task
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      this.logger.warn('Task not found', { taskId });
      return false;
    }

    this.stopTask(task);
    this.tasks.delete(taskId);

    this.logger.info('Task cancelled', { taskId, taskName: task.name });
    return true;
  }

  /**
   * Запускает конкретную задачу
   */
  private startTask(task: ScheduledTask): void {
    if (task.timer) {
      clearInterval(task.timer);
    }

    const executeTask = async () => {
      if (task.isRunning) {
        this.logger.warn('Task already running, skipping', { taskId: task.id });
        return;
      }

      task.isRunning = true;
      task.lastRun = new Date();

      try {
        await this.executeTaskById(task.id);
        this.logger.debug('Task executed successfully', {
          taskId: task.id,
          taskName: task.name,
        });
      } catch (error) {
        this.logger.error('Task execution failed', {
          taskId: task.id,
          taskName: task.name,
          error,
        });
      } finally {
        task.isRunning = false;
        task.nextRun = new Date(Date.now() + task.intervalMs);
      }
    };

    // Выполняем задачу немедленно при первом запуске
    executeTask().catch(error => {
      this.logger.error('Initial task execution failed', {
        taskId: task.id,
        error,
      });
    });

    // Планируем повторные выполнения
    task.timer = setInterval(executeTask, task.intervalMs);
    task.nextRun = new Date(Date.now() + task.intervalMs);

    this.logger.info('Task started', {
      taskId: task.id,
      taskName: task.name,
      intervalMs: task.intervalMs,
    });
  }

  /**
   * Останавливает конкретную задачу
   */
  private stopTask(task: ScheduledTask): void {
    if (task.timer) {
      clearInterval(task.timer);
      task.timer = undefined;
    }

    task.isRunning = false;
    task.nextRun = undefined;

    this.logger.info('Task stopped', {
      taskId: task.id,
      taskName: task.name,
    });
  }

  /**
   * Выполняет задачу по ID
   */
  private async executeTaskById(taskId: string): Promise<void> {
    switch (taskId) {
      case 'file-scan':
        await this.executeFileScanTask();
        break;

      case 'cleanup':
        await this.executeCleanupTask();
        break;

      case 'session-check':
        await this.executeSessionCheckTask();
        break;

      default:
        throw new Error(`Unknown task ID: ${taskId}`);
    }
  }

  /**
   * Выполняет задачу сканирования файловой системы
   */
  private async executeFileScanTask(): Promise<void> {
    this.logger.debug('Executing file scan task');

    try {
      await this.fsService.forceScan();
      this.logger.debug('File scan task completed');
    } catch (error) {
      this.logger.error('File scan task failed', { error });
      throw error;
    }
  }

  /**
   * Выполняет задачу очистки временных файлов
   */
  private async executeCleanupTask(): Promise<void> {
    this.logger.debug('Executing cleanup task');

    try {
      // TODO: Реализовать логику очистки временных файлов
      // - Удаление старых логов
      // - Очистка кэша
      // - Удаление незавершенных загрузок

      this.logger.debug('Cleanup task completed (placeholder)');
    } catch (error) {
      this.logger.error('Cleanup task failed', { error });
      throw error;
    }
  }

  /**
   * Выполняет задачу проверки Telegram сессии
   */
  private async executeSessionCheckTask(): Promise<void> {
    this.logger.debug('Executing session check task');

    try {
      const session = await this.storageService.getTelegramSession();

      if (!session) {
        this.logger.warn('No Telegram session found');
        return;
      }

      // TODO: Реализовать проверку активности сессии
      // - Проверка валидности stringSession
      // - Попытка подключения к Telegram
      // - Обновление статуса в БД

      this.logger.debug('Session check task completed (placeholder)', {
        sessionId: session.id,
        isActive: session.isActive,
      });
    } catch (error) {
      this.logger.error('Session check task failed', { error });
      throw error;
    }
  }
}
