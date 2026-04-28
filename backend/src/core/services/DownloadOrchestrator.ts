import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

import { serviceLoggers } from '../../../../shared/logger.mts';
import type { ISchedulerService, IStorageService } from '../../../../types/common/index.js';
import type {
  IDownloadOrchestrator,
  IDownloadProgress,
  IDownloadResult,
  IDownloadSession,
  ITopicFileInfo,
} from '../../../../types/file-sync/index.js';
import * as FileSyncTypes from '../../../../types/file-sync/index.js';
const { EOperationStatus } = FileSyncTypes;

interface DownloadOrchestratorOptions {
  maxParallelDownloads: number; // currently 1
  persistIntervalMs: number; // 60000
}

/**
 * DownloadOrchestrator – orchestrates download of files from Telegram topics to local folders.
 * Sequential downloads (maxParallelDownloads = 1) with in-memory session tracking.
 * Persistence every persistIntervalMs via injected ISchedulerService.
 */
interface InternalSession extends IDownloadSession {
  failedFiles: string[];
  overwriteExisting: boolean;
  realDownloaded: number; // count of actually downloaded files
  skipped: number; // count of skipped files (already exist locally)
}

export class DownloadOrchestrator implements IDownloadOrchestrator {
  private readonly logger = serviceLoggers.downloadOrchestrator;

  private readonly sessions: Map<string, InternalSession> = new Map();
  private persistTaskId: string | null = null;

  constructor(
    private readonly telegramService: ITelegramService,
    private readonly storageService: IStorageService,
    private readonly socketService: ISocketService,
    private readonly schedulerService: ISchedulerService,
    private readonly options: DownloadOrchestratorOptions = {
      maxParallelDownloads: 1,
      persistIntervalMs: 60000,
    }
  ) {
    this.setupPersistence();
  }

  /**
   * Starts download session from topic to local folder
   */
  async startDownload(
    topicId: string,
    channelId: string,
    targetPath: string,
    opts?: {
      selectedFiles?: string[];
      overwriteExisting?: boolean;
    }
  ): Promise<IDownloadSession> {
    const sessionId = randomUUID();
    const now = new Date();

    this.logger.info(`Starting download session ${sessionId}`, {
      topicId,
      channelId,
      targetPath,
      selectedFiles: opts?.selectedFiles?.length || 'all',
    });

    try {
      // Create target directory if it doesn't exist
      await mkdir(targetPath, { recursive: true });

      // Get list of files in the topic
      const topicFiles = await this.telegramService.listTopicFiles(channelId, topicId);
      let filesToDownload = topicFiles;

      // Filter by selected files if specified
      if (opts?.selectedFiles && opts.selectedFiles.length > 0) {
        filesToDownload = topicFiles.filter(file => opts.selectedFiles?.includes(file.name));
      }

      // Check which files already exist locally (name + extension check only)
      const existingFiles = opts?.overwriteExisting
        ? []
        : await this.checkExistingFiles(topicId, channelId, targetPath);

      // Filter out existing files if not overwriting
      if (!opts?.overwriteExisting && existingFiles.length > 0) {
        filesToDownload = filesToDownload.filter(file => !existingFiles.includes(file.name));
      }

      const session: InternalSession = {
        id: sessionId,
        targetPath,
        topicId,
        channelId,
        status: EOperationStatus.PENDING,
        selectedFiles: opts?.selectedFiles || [],
        totalFiles: filesToDownload.length,
        downloadedFiles: 0,
        progress: 0,
        startedAt: now,
        updatedAt: now,
        // Internal properties
        failedFiles: [],
        overwriteExisting: opts?.overwriteExisting || false,
        realDownloaded: 0,
        skipped: existingFiles.length,
        realDownloadedFiles: 0,
        skippedFilesCount: existingFiles.length,
      };

      this.sessions.set(sessionId, session);

      // Emit download start event
      this.socketService.emit('download_start', {
        downloadId: sessionId,
        targetPath,
        topicId,
        channelId,
        totalFiles: session.totalFiles,
        selectedFiles: session.selectedFiles,
        timestamp: Date.now(),
      });

      // Start processing files asynchronously
      this.processDownloadSession(sessionId, filesToDownload);

      return this.toPublicSession(session);
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error(String(error)),
        `Failed to start download session ${sessionId}`
      );
      throw error;
    }
  }

  /**
   * Pauses download session
   */
  async pauseDownload(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Download session ${sessionId} not found`);
    }

    if (session.status !== EOperationStatus.IN_PROGRESS) {
      throw new Error(`Cannot pause session ${sessionId} with status ${session.status}`);
    }

    session.status = EOperationStatus.PAUSED;
    session.updatedAt = new Date();

    this.logger.info(`Paused download session ${sessionId}`);
  }

  /**
   * Resumes download session
   */
  async resumeDownload(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Download session ${sessionId} not found`);
    }

    if (session.status !== EOperationStatus.PAUSED) {
      throw new Error(`Cannot resume session ${sessionId} with status ${session.status}`);
    }

    session.status = EOperationStatus.IN_PROGRESS;
    session.updatedAt = new Date();

    this.logger.info(`Resumed download session ${sessionId}`);

    // Continue processing from where we left off
    const topicFiles = await this.telegramService.listTopicFiles(
      session.channelId,
      session.topicId
    );
    let filesToDownload = topicFiles;

    if (session.selectedFiles.length > 0) {
      filesToDownload = topicFiles.filter(file => session.selectedFiles.includes(file.name));
    }

    // Skip already downloaded files
    const remainingFiles = filesToDownload.slice(session.downloadedFiles);
    this.processDownloadSession(sessionId, remainingFiles);
  }

  /**
   * Cancels download session
   */
  async cancelDownload(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Download session ${sessionId} not found`);
    }

    session.status = EOperationStatus.FAILED;
    session.error = 'Cancelled by user';
    session.completedAt = new Date();
    session.updatedAt = new Date();

    // Emit download error event
    this.socketService.emit('download_error', {
      downloadId: sessionId,
      topicId: session.topicId,
      error: 'Cancelled by user',
      timestamp: Date.now(),
    });

    this.logger.info(`Cancelled download session ${sessionId}`);
  }

  /**
   * Gets download progress
   */
  async getDownloadProgress(sessionId: string): Promise<IDownloadProgress> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Download session ${sessionId} not found`);
    }

    return {
      downloadId: sessionId,
      fileName: session.currentFile || '',
      fileIndex: session.downloadedFiles,
      totalFiles: session.totalFiles,
      downloadedBytes: 0, // TODO: implement byte-level progress tracking
      totalBytes: 0, // TODO: implement byte-level progress tracking
      speed: 0, // TODO: implement speed calculation
      eta: 0, // TODO: implement ETA calculation
    };
  }

  /**
   * Gets download result
   */
  async getDownloadResult(sessionId: string): Promise<IDownloadResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Download session ${sessionId} not found`);
    }

    return {
      downloadId: sessionId,
      status: session.status,
      totalFiles: session.totalFiles,
      downloadedFiles: session.downloadedFiles,
      realDownloadedFiles: session.realDownloadedFiles,
      skippedFilesCount: session.skippedFilesCount,
      failedFiles: session.failedFiles,
      targetPath: session.targetPath,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    };
  }

  /**
   * Lists all files in a topic (for UI file selection)
   */
  async listTopicFiles(topicId: string, channelId: string): Promise<ITopicFileInfo[]> {
    return await this.telegramService.listTopicFiles(channelId, topicId);
  }

  /**
   * Checks which files from topic already exist in target folder
   * Returns array of existing filenames (name + extension check only)
   */
  async checkExistingFiles(
    topicId: string,
    channelId: string,
    targetPath: string
  ): Promise<string[]> {
    try {
      const topicFiles = await this.telegramService.listTopicFiles(channelId, topicId);
      const existingFiles: string[] = [];

      for (const file of topicFiles) {
        const filePath = join(targetPath, file.name);
        if (existsSync(filePath)) {
          existingFiles.push(file.name);
        }
      }

      return existingFiles;
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error(String(error)),
        `Failed to check existing files for topic ${topicId}`
      );
      return [];
    }
  }

  /**
   * Graceful shutdown: flush persistence and cleanup resources
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down DownloadOrchestrator...');

    // Cancel persistence task
    if (this.persistTaskId) {
      this.schedulerService.cancelTask(this.persistTaskId);
      this.persistTaskId = null;
    }

    // Save all active sessions to database
    await this.persistAllSessions();

    this.logger.info('DownloadOrchestrator shutdown complete');
  }

  /**
   * Lists in-memory (and optionally persisted) download sessions
   */
  async listSessions(): Promise<IDownloadSession[]> {
    return Array.from(this.sessions.values()).map(session => this.toPublicSession(session));
  }

  /**
   * Resumes all paused sessions (for service restart)
   */
  async resumeAllSessions(): Promise<void> {
    const pausedSessions = Array.from(this.sessions.values()).filter(
      session => session.status === EOperationStatus.PAUSED
    );

    this.logger.info(`Resuming ${pausedSessions.length} paused download sessions`);

    for (const session of pausedSessions) {
      try {
        await this.resumeDownload(session.id);
      } catch (error) {
        this.logger.error(
          error instanceof Error ? error : new Error(String(error)),
          `Failed to resume download session ${session.id}`
        );
      }
    }
  }

  /**
   * Process download session - downloads files sequentially
   */
  private async processDownloadSession(
    sessionId: string,
    filesToDownload: ITopicFileInfo[]
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.error(`Session ${sessionId} not found during processing`);
      return;
    }

    session.status = EOperationStatus.IN_PROGRESS;
    session.updatedAt = new Date();

    this.logger.info(
      `Processing download session ${sessionId} with ${filesToDownload.length} files`
    );

    for (let i = 0; i < filesToDownload.length; i++) {
      // Check if session was paused or cancelled
      const currentSession = this.sessions.get(sessionId);
      if (!currentSession || currentSession.status !== EOperationStatus.IN_PROGRESS) {
        this.logger.info(`Download session ${sessionId} paused or cancelled, stopping processing`);
        return;
      }

      const file = filesToDownload[i];
      currentSession.currentFile = file.name;
      currentSession.updatedAt = new Date();

      try {
        // Check if file already exists (skip if not overwriting)
        const filePath = join(currentSession.targetPath, file.name);
        if (!currentSession.overwriteExisting && existsSync(filePath)) {
          // File already exists, skip
          currentSession.skipped++;
          currentSession.skippedFilesCount = currentSession.skipped;

          this.socketService.emit('download_file_event', {
            downloadId: sessionId,
            topicId: currentSession.topicId,
            fileName: file.name,
            action: 'skipped',
            reason: 'already_exists',
            index: currentSession.downloadedFiles + 1,
            totalFiles: currentSession.totalFiles,
            timestamp: Date.now(),
          });
        } else {
          // Download the file
          await this.telegramService.downloadFile(
            currentSession.channelId,
            currentSession.topicId,
            file.id,
            currentSession.targetPath,
            file.name
          );

          currentSession.realDownloaded++;
          currentSession.realDownloadedFiles = currentSession.realDownloaded;

          this.socketService.emit('download_file_event', {
            downloadId: sessionId,
            topicId: currentSession.topicId,
            fileName: file.name,
            action: 'downloaded',
            index: currentSession.downloadedFiles + 1,
            totalFiles: currentSession.totalFiles,
            timestamp: Date.now(),
          });

          this.logger.debug(`Downloaded file ${file.name} to ${filePath}`);
        }

        currentSession.downloadedFiles++;
        currentSession.progress = Math.round(
          (currentSession.downloadedFiles / currentSession.totalFiles) * 100
        );

        // Emit progress event
        this.socketService.emit('download_progress', {
          downloadId: sessionId,
          fileName: file.name,
          fileIndex: currentSession.downloadedFiles,
          totalFiles: currentSession.totalFiles,
          downloadedBytes: 0, // TODO: implement
          totalBytes: 0, // TODO: implement
          speed: 0, // TODO: implement
          eta: 0, // TODO: implement
        });
      } catch (error) {
        this.logger.error(
          error instanceof Error ? error : new Error(String(error)),
          `Failed to download file ${file.name}`
        );

        currentSession.failedFiles.push(file.name);

        this.socketService.emit('download_file_event', {
          downloadId: sessionId,
          topicId: currentSession.topicId,
          fileName: file.name,
          action: 'failed',
          reason: 'error',
          error: error instanceof Error ? error.message : String(error),
          index: currentSession.downloadedFiles + 1,
          totalFiles: currentSession.totalFiles,
          timestamp: Date.now(),
        });
      }
    }

    // Mark session as completed
    this.completeDownloadSession(sessionId);
  }

  /**
   * Complete download session
   */
  private completeDownloadSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const hasFailures = session.failedFiles.length > 0;
    const hasSuccesses = session.realDownloaded > 0 || session.skipped > 0;

    if (hasFailures && hasSuccesses) {
      session.status = EOperationStatus.PARTIAL;
    } else if (hasFailures && !hasSuccesses) {
      session.status = EOperationStatus.FAILED;
    } else {
      session.status = EOperationStatus.COMPLETED;
    }

    session.completedAt = new Date();
    session.updatedAt = new Date();
    session.currentFile = undefined;

    // Emit completion event
    this.socketService.emit('download_complete', {
      downloadId: sessionId,
      topicId: session.topicId,
      totalFiles: session.totalFiles,
      downloadedFiles: session.downloadedFiles,
      failedFiles: session.failedFiles.length,
      hasFailures,
      durationMs: session.completedAt.getTime() - session.startedAt.getTime(),
      timestamp: Date.now(),
      realDownloadedFiles: session.realDownloadedFiles,
      skippedFilesCount: session.skippedFilesCount,
    });

    this.logger.info(`Download session ${sessionId} completed`, {
      status: session.status,
      totalFiles: session.totalFiles,
      downloadedFiles: session.downloadedFiles,
      realDownloadedFiles: session.realDownloadedFiles,
      skippedFilesCount: session.skippedFilesCount,
      failedFiles: session.failedFiles.length,
    });
  }

  /**
   * Convert internal session to public interface
   */
  private toPublicSession(session: InternalSession): IDownloadSession {
    return {
      id: session.id,
      targetPath: session.targetPath,
      topicId: session.topicId,
      channelId: session.channelId,
      status: session.status,
      selectedFiles: session.selectedFiles,
      totalFiles: session.totalFiles,
      downloadedFiles: session.downloadedFiles,
      currentFile: session.currentFile,
      progress: session.progress,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      error: session.error,
      realDownloadedFiles: session.realDownloadedFiles,
      skippedFilesCount: session.skippedFilesCount,
    };
  }

  /**
   * Setup periodic persistence of sessions to database
   */
  private setupPersistence(): void {
    this.schedulerService.scheduleTask(
      'download-orchestrator-persistence',
      'Download Orchestrator Persistence',
      this.options.persistIntervalMs,
      () => this.persistAllSessions()
    );

    this.logger.debug('Download orchestrator persistence scheduled');
  }

  /**
   * Persist all active sessions to database
   */
  private async persistAllSessions(): Promise<void> {
    try {
      const activeSessions = Array.from(this.sessions.values()).filter(
        session =>
          session.status !== EOperationStatus.COMPLETED &&
          session.status !== EOperationStatus.FAILED
      );

      for (const session of activeSessions) {
        await this.persistSession(session);
      }

      this.logger.debug(`Persisted ${activeSessions.length} active download sessions`);
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error(String(error)),
        'Failed to persist download sessions'
      );
    }
  }

  /**
   * Persist single session to database
   */
  private async persistSession(session: InternalSession): Promise<void> {
    try {
      // TODO: Implement database persistence via storageService
      // This would save session state to download_sessions table
      // For now, we'll just log it
      this.logger.debug(`Would persist session ${session.id} to database`);
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error(String(error)),
        `Failed to persist session ${session.id}`
      );
    }
  }
}
