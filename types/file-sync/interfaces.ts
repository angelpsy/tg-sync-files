/**
 * File sync domain interfaces
 */

import type {
  IFileChangeEvent,
  IFileInfo,
  IFolderTree,
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
 * Sync Service Interface
 * Manages file synchronization logic
 */
export interface ISyncService {
  /**
   * Uploads folder to topic
   */
  uploadFolderToTopic(folderPath: string, topicName: string): Promise<IUploadResult>;

  /**
   * Starts upload session
   */
  startUpload(folderPath: string, topicId: string): Promise<IUploadSession>;

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
   * Synchronizes folder with topic
   */
  syncFolder(linkId: string): Promise<void>;

  /**
   * Checks for duplicate files
   */
  checkDuplicates(folderPath: string, topicName: string): Promise<boolean>;
}
