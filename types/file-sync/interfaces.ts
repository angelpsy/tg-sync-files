/**
 * File sync domain interfaces
 */

import type { TFileHashStrategy, TUploadConflictPolicy } from './enums.js';
import type {
  IDownloadProgress,
  IDownloadResult,
  IDownloadSession,
  IFileChangeEvent,
  IFileInfo,
  IFolderTree,
  ISyncDiffResult,
  ITopicFileInfo,
  IUploadProgress,
  IUploadResult,
  IUploadSession,
} from './models.js';

/**
 * File System Service Interface
 * Manages file system operations and monitoring
 */
export interface IFSService {
  /**
   * Scans folders and returns file tree
   */
  scanFolders(): Promise<IFolderTree[]>;

  /**
   * Scans single folder and returns file tree
   */
  scanFolder(folderPath: string): Promise<IFolderTree>;

  /**
   * Starts watching folder for changes with callback
   */
  watchFolder(folderPath: string, callback?: (event: IFileChangeEvent) => void): Promise<void>;

  /**
   * Stops watching folder
   */
  unwatchFolder(folderPath: string): Promise<void>;

  /**
   * Stops monitoring all changes
   */
  stopWatching(): void;

  /**
   * Gets file information
   */
  getFileInfo(filePath: string): Promise<IFileInfo>;

  /**
   * Validates file path
   */
  validatePath(path: string): Promise<boolean>;

  /**
   * Gets folder statistics
   */
  getFolderStats(folderPath: string): Promise<{
    totalFiles: number;
    totalSize: number;
    lastModified: Date;
  }>;

  /**
   * Subscribes to file system update events
   */
  onUpdate(callback: (tree: IFolderTree[]) => void): void;

  /**
   * Forces scan on demand
   */
  forceScan(): Promise<IFolderTree[]>;
}

/**
 * Upload Orchestrator Interface (formerly ISyncService)
 * Orchestrates one-way folder -> topic uploads and related incremental sync helpers.
 * NOTE: Renamed for clarity; use IUploadOrchestrator going forward.
 */
export interface IUploadOrchestrator {
  /**
   * Uploads folder to topic (sequential respecting maxParallelUploads)
   */
  uploadFolderToTopic(
    folderPath: string,
    channelId: string,
    topicId: string
  ): Promise<IUploadResult>;

  /**
   * Starts upload session (deferred execution / streaming progress)
   */
  startUpload(
    folderPath: string,
    channelId: string,
    topicId: string,
    opts?: {
      conflictPolicy?: TUploadConflictPolicy;
      hashStrategy?: TFileHashStrategy;
      selectedFiles?: string[]; // if provided, restrict to this subset
    }
  ): Promise<IUploadSession>;

  /**
   * Pauses upload session
   */
  pauseUpload(sessionId: string): Promise<void>;

  /**
   * Resumes upload session
   */
  resumeUpload(sessionId: string): Promise<void>;

  /**
   * Cancels upload session
   */
  cancelUpload(sessionId: string): Promise<void>;

  /**
   * Gets upload progress
   */
  getUploadProgress(sessionId: string): Promise<IUploadProgress>;

  /**
   * Gets upload result
   */
  getUploadResult(sessionId: string): Promise<IUploadResult>;

  /**
   * Synchronizes folder with topic (incremental)
   */
  syncFolder(linkId: string): Promise<ISyncDiffResult>;

  /**
   * Checks for duplicate files inside a topic by file name
   */
  checkDuplicates(folderPath: string, channelId: string, topicId: string): Promise<boolean>;

  /**
   * Graceful shutdown: flush persistence and cleanup resources
   */
  shutdown(): Promise<void>;

  /**
   * Lists in-memory (and optionally persisted) upload sessions for reconnect snapshots
   */
  listSessions(): Promise<IUploadSession[]>;
}

/**
 * Download Orchestrator Interface
 * Orchestrates download of files from Telegram topics to local folders.
 * Provides session management, progress tracking, and duplicate checking.
 */
export interface IDownloadOrchestrator {
  /**
   * Starts download session from topic to local folder
   */
  startDownload(
    topicId: string,
    channelId: string,
    targetPath: string,
    opts?: {
      selectedFiles?: string[]; // if provided, download only these files
      overwriteExisting?: boolean; // default: false
    }
  ): Promise<IDownloadSession>;

  /**
   * Pauses download session
   */
  pauseDownload(sessionId: string): Promise<void>;

  /**
   * Resumes download session
   */
  resumeDownload(sessionId: string): Promise<void>;

  /**
   * Cancels download session
   */
  cancelDownload(sessionId: string): Promise<void>;

  /**
   * Gets download progress
   */
  getDownloadProgress(sessionId: string): Promise<IDownloadProgress>;

  /**
   * Gets download result
   */
  getDownloadResult(sessionId: string): Promise<IDownloadResult>;

  /**
   * Lists all files in a topic (for UI file selection)
   */
  listTopicFiles(topicId: string, channelId: string): Promise<ITopicFileInfo[]>;

  /**
   * Checks which files from topic already exist in target folder
   * Returns array of existing filenames (name + extension check only)
   */
  checkExistingFiles(topicId: string, channelId: string, targetPath: string): Promise<string[]>;

  /**
   * Graceful shutdown: flush persistence and cleanup resources
   */
  shutdown(): Promise<void>;

  /**
   * Lists in-memory (and optionally persisted) download sessions
   */
  listSessions(): Promise<IDownloadSession[]>;

  /**
   * Resumes all paused sessions (for service restart)
   */
  resumeAllSessions(): Promise<void>;
}
