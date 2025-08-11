/**
 * File sync domain interfaces
 */

import type { TFileHashStrategy, TUploadConflictPolicy } from './enums.js';
import type {
  IFileChangeEvent,
  IFileInfo,
  IFolderTree,
  ISyncDiffResult,
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
    opts?: { conflictPolicy?: TUploadConflictPolicy; hashStrategy?: TFileHashStrategy }
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
}
