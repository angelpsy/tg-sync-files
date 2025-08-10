/**
 * File sync domain models
 */

import type { TFileChangeType, TSyncStatus, TUploadStatus } from './enums';

/**
 * File information model
 */
export interface IFileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  hash: string;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Download operation info
 */
export interface IDownloadInfo {
  fileId: string;
  fileName: string;
  fileSize: number;
  downloadPath: string;
  progress: number;
  status: TUploadStatus; // Reusing upload status for consistency
}

/**
 * Upload operation info
 */
export interface IUploadInfo {
  fileId: string;
  fileName: string;
  fileSize: number;
  uploadPath: string;
  channelId: string;
  topicId?: string;
  progress: number;
  status: TUploadStatus;
  error?: string;
}

/**
 * Sync operation info
 */
export interface ISyncInfo {
  id: string;
  sourcePath: string;
  targetPath: string;
  status: TSyncStatus;
  progress: number;
  filesTotal: number;
  filesProcessed: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Folder tree structure
 */
export interface IFolderTree {
  path: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  children?: IFolderTree[];
  fileCount: number;
}

/**
 * Upload result
 */
export interface IUploadResult {
  uploadId: string;
  status: TUploadStatus;
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: string[];
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Download options
 */
export interface IDownloadOptions {
  overwrite?: boolean;
  createFolders?: boolean;
  filePattern?: string;
}

/**
 * Download result
 */
export interface IDownloadResult {
  downloadId: string;
  totalFiles: number;
  downloadedFiles: number;
  failedFiles: string[];
  targetPath: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Folder-Topic link
 */
export interface IFolderTopicLink {
  id: string;
  folderPath: string;
  topicId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Upload session
 */
export interface IUploadSession {
  id: string;
  folderPath: string;
  topicId: string;
  status: TUploadStatus;
  totalFiles: number;
  uploadedFiles: number;
  currentFile?: string;
  progress: number;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * File sync event payload
 */
export interface IFileSyncEvent {
  id: string;
  fileName: string;
  filePath: string;
  channelId: string;
  status: TSyncStatus;
  timestamp: Date;
  error?: string;
}

/**
 * Upload progress for WebSocket events
 */
export interface IUploadProgress {
  uploadId: string;
  fileName: string;
  fileIndex: number;
  totalFiles: number;
  uploadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  eta: number; // seconds
}

/**
 * File system change event
 */
export interface IFileChangeEvent {
  id: string;
  path: string;
  type: TFileChangeType;
  timestamp: Date;
  metadata?: {
    oldPath?: string; // for rename events
    size?: number;
    hash?: string;
  };
}
