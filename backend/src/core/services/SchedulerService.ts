// External / shared
import { serviceLoggers } from '../../../../shared/logger.mts';
// Types
import type { IFSService, ISchedulerService, IStorageService } from '../../../../types/index.js';

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
   * Schedules a generic task
   */
  scheduleTask(id: string, name: string, intervalMs: number, execute: () => Promise<void>): void {
    const task: ScheduledTask = {
      id,
      name,
      intervalMs,
      isRunning: false,
      execute,
    };
    this.tasks.set(id, task);
    if (this.isStarted) this.startTask(task);
    this.logger.info('Scheduled generic task', { id, intervalMs });
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
    if (!task) return false;
    this.stopTask(task);
    this.tasks.delete(taskId);
    this.logger.info('Cancelled task', { taskId });
    return true;
  }

  /**
   * Starts a specific task
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
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Unknown task ID: ${taskId}`);
    // Prefer per-task execute (generic)
    if (task.execute) {
      await task.execute();
      return;
    }
  }
}
