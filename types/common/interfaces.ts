/**
 * Common domain interfaces
 */

import type { IFileRecord, IFolderTopicLink, IUploadSession } from '../file-sync/index.js';
import type { ITelegramChannel, ITelegramSession } from '../telegram/index.js';

/**
 * Storage Service Interface
 * Manages data persistence via database
 */
export interface IStorageService {
  /**
   * Gets list of channels
   */
  getChannels(): Promise<ITelegramChannel[]>;

  /**
   * Saves channel
   */
  saveChannel(channel: ITelegramChannel): Promise<void>;

  /**
   * Gets folder-topic links
   */
  getFolderTopicLinks(): Promise<IFolderTopicLink[]>;

  /**
   * Saves folder-topic link
   */
  saveFolderTopicLink(link: IFolderTopicLink): Promise<void>;

  /**
   * Gets upload sessions
   */
  getUploadSessions(): Promise<IUploadSession[]>;

  /**
   * Saves upload session
   */
  saveUploadSession(session: IUploadSession): Promise<void>;

  /**
   * Gets active Telegram session
   */
  getTelegramSession(): Promise<ITelegramSession | null>;

  /**
   * Saves Telegram session
   */
  saveTelegramSession(session: ITelegramSession): Promise<void>;

  /**
   * Clears all Telegram sessions (logout)
   */
  clearTelegramSessions(): Promise<void>;

  /**
   * Gets file record by topic and name
   */
  getFileRecord(topicId: string, fileName: string): Promise<IFileRecord | null>;

  /**
   * Upserts file record
   */
  upsertFileRecord(record: IFileRecord): Promise<void>;

  /**
   * Lists file records for a topic
   */
  getTopicFileRecords(topicId: string): Promise<IFileRecord[]>;
}

/**
 * Scheduler Service Interface
 * Manages periodic tasks and job scheduling
 */
export interface ISchedulerService {
  /**
   * Starts scheduler
   */
  start(): Promise<void>;

  /**
   * Stops scheduler
   */
  stop(): Promise<void>;

  /**
   * Pauses scheduler
   */
  pause(): Promise<void>;

  /**
   * Resumes scheduler
   */
  resume(): Promise<void>;

  /**
   * Gets scheduler status
   */
  getStatus(): Promise<{
    isRunning: boolean;
    isPaused: boolean;
    nextRun?: Date;
    lastRun?: Date;
  }>;

  /**
   * Forces immediate execution of scheduled tasks
   */
  executeNow(): Promise<void>;

  /**
   * Schedules periodic file system scan
   */
  scheduleFileScan(intervalMs: number): void;

  /**
   * Schedules cleanup of temporary files
   */
  scheduleCleanup(intervalMs: number): void;

  /**
   * Schedules Telegram session status check
   */
  scheduleSessionCheck(intervalMs: number): void;

  /**
   * Registers a generic periodic task
   */
  scheduleTask(id: string, name: string, intervalMs: number, execute: () => Promise<void>): void;

  /**
   * Cancels task by id
   */
  cancelTask(taskId: string): boolean;

  /**
   * Gets debug info for all tasks
   */
  getTasksInfo(): Record<string, unknown>;
}
