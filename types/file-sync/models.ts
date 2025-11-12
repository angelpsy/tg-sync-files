/**
 * File sync domain models
 */

import type { TFileChangeType, TOperationStatus, TSyncStatus, TUploadStatus } from './enums';

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
 * uploadedFiles: count of files that ended in a satisfied state for the session (either really uploaded or skipped as already present / unchanged)
 * failedFiles: list of file names that definitively failed to upload after all retries
 * hasFailures: true when at least one file failed while at least one succeeded or was satisfied
 */
export interface IUploadResult {
  uploadId: string;
  /** Final high-level session status (COMPLETED | PARTIAL | FAILED etc.) */
  status: TUploadStatus;
  /** Total number of files discovered at session start */
  totalFiles: number;
  /** Number of files successfully uploaded OR skipped as satisfied (duplicate / unchanged) */
  uploadedFiles: number;
  /** Number of files actually transferred to Telegram (excludes skips) */
  realUploadedFiles?: number;
  /** Number of files skipped as already satisfied (remote duplicate / unchanged) */
  skippedFilesCount?: number;
  /** File names that failed to upload */
  failedFiles: string[];
  /** Session start time */
  startedAt: Date;
  /** Session completion time (set when status becomes COMPLETED, PARTIAL or FAILED) */
  completedAt?: Date;
  /** @deprecated use status === 'partial' instead; retained for backward compatibility */
  hasFailures?: boolean;
  /** Count of conflicts resolved by skipping (policy=SKIP) */
  conflictsSkipped?: number;
  /** Count of conflicts resolved by renaming (policy=RENAME) */
  conflictsRenamed?: number;
  /** Count of conflicts only logged (policy=LOG_ONLY) */
  conflictsLogged?: number;
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
 * Upload session (in-flight state held in memory)
 * NOTE: This interface does NOT expose internal tracking properties like failedFiles or conflictPolicy used internally by SyncService.
 * - uploadedFiles counts both actually uploaded and logically satisfied (skipped duplicate / unchanged) files.
 * - progress is derived from uploadedFiles / totalFiles (0..100 integer percentage).
 */
export interface IUploadSession {
  /** Session identifier */
  id: string;
  /** Local folder path being uploaded */
  folderPath: string;
  /** Target topic id in Telegram */
  topicId: string;
  /** Current session status */
  status: TUploadStatus;
  /** Total files determined at the start (flat scan, no recursion) */
  totalFiles: number;
  /** Count of files uploaded OR skipped as satisfied */
  uploadedFiles: number;
  /** Name of file currently being processed (upload attempt) */
  currentFile?: string;
  /** Percentage (integer 0..100) = Math.round(uploadedFiles / totalFiles * 100) */
  progress: number;
  /** Timestamp when session started */
  startedAt: Date;
  /** Last mutation timestamp (any state change) */
  updatedAt: Date;
  /** Completion timestamp when finished or failed */
  completedAt?: Date;
  /** Error message if session failed or was cancelled */
  error?: string;
  /** Count of actually transferred files (excludes skips) */
  realUploadedFiles?: number;
  /** Count of logically satisfied skipped files (remote duplicate / unchanged) */
  skippedFilesCount?: number;
  /** Conflict metrics */
  conflictsSkipped?: number;
  conflictsRenamed?: number;
  conflictsLogged?: number;
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

/**
 * File fingerprint information
 */
export interface IFileFingerprint {
  size: number;
  mtimeMs: number;
  hash?: string; // sha256 optional
}

/**
 * File record information
 */
export interface IFileRecord {
  id: string; // composite or uuid
  folderPath: string;
  topicId: string;
  fileName: string;
  size: number;
  mtimeMs: number;
  hash?: string;
  uploadedAt: Date;
  updatedAt: Date;
}

/**
 * Upload lifecycle start event payload
 */
export interface IUploadStartEvent {
  uploadId: string;
  folderPath: string;
  topicId: string;
  totalFiles: number;
  timestamp: number;
}

/**
 * Upload lifecycle completion event payload
 */
export interface IUploadCompleteEvent {
  uploadId: string;
  topicId: string;
  totalFiles: number;
  uploadedFiles: number; // satisfied count
  failedFiles: number;
  hasFailures: boolean;
  durationMs: number;
  timestamp: number;
  realUploadedFiles?: number;
  skippedFilesCount?: number;
  conflictsSkipped?: number;
  conflictsRenamed?: number;
  conflictsLogged?: number;
}

/**
 * Upload lifecycle error event payload
 */
export interface IUploadErrorEvent {
  uploadId: string;
  topicId: string;
  error: string;
  timestamp: number;
}

/**
 * File-level upload event (per file action)
 * action: uploaded | skipped | renamed | failed
 * reason: remote_duplicate | unchanged | conflict | error
 */
export interface IUploadFileEvent {
  uploadId: string;
  topicId: string;
  fileName: string;
  originalName?: string; // for renamed
  action: 'uploaded' | 'skipped' | 'renamed' | 'failed';
  reason?: 'remote_duplicate' | 'unchanged' | 'conflict' | 'error';
  index: number; // 1-based satisfied/processed index after this action
  totalFiles: number;
  error?: string;
  timestamp: number;
}

/**
 * Result of incremental diff calculation
 */
export interface ISyncDiffResult {
  topicId: string;
  folderPath: string;
  newFiles: string[]; // not in records nor remote
  updatedFiles: string[]; // present but fingerprint (size/mtime or hash) changed
  removedFiles: string[]; // exist in records but not locally (UI highlight only)
  unchangedFiles: string[]; // satisfied
  remoteOnlyFiles?: string[]; // exist remotely but not locally nor in records (orphan remote)
  timestamp: number;
}

/**
 * Download session model (parallel to IUploadSession)
 */
export interface IDownloadSession {
  /** Session identifier */
  id: string;
  /** Target local folder path for download */
  targetPath: string;
  /** Source topic id in Telegram */
  topicId: string;
  /** Channel id containing the topic */
  channelId: string;
  /** Current session status */
  status: TOperationStatus;
  /** Selected files to download (empty array = all files) */
  selectedFiles: string[];
  /** Total files determined at session start */
  totalFiles: number;
  /** Count of files downloaded OR skipped as already exist */
  downloadedFiles: number;
  /** Name of file currently being processed */
  currentFile?: string;
  /** Percentage (integer 0..100) = Math.round(downloadedFiles / totalFiles * 100) */
  progress: number;
  /** Timestamp when session started */
  startedAt: Date;
  /** Last mutation timestamp (any state change) */
  updatedAt: Date;
  /** Completion timestamp when finished or failed */
  completedAt?: Date;
  /** Error message if session failed or was cancelled */
  error?: string;
  /** Count of actually downloaded files (excludes skips) */
  realDownloadedFiles?: number;
  /** Count of skipped files (already exist locally) */
  skippedFilesCount?: number;
}

/**
 * Download result model (parallel to IUploadResult)
 */
export interface IDownloadResult {
  downloadId: string;
  /** Final high-level session status */
  status: TOperationStatus;
  /** Total number of files in the topic */
  totalFiles: number;
  /** Number of files successfully downloaded OR skipped as already exist */
  downloadedFiles: number;
  /** Number of files actually downloaded (excludes skips) */
  realDownloadedFiles?: number;
  /** Number of files skipped as already exist locally */
  skippedFilesCount?: number;
  /** File names that failed to download */
  failedFiles: string[];
  /** Target folder path */
  targetPath: string;
  /** Session start time */
  startedAt: Date;
  /** Session completion time */
  completedAt?: Date;
}

/**
 * Download progress for WebSocket events (parallel to IUploadProgress)
 */
export interface IDownloadProgress {
  downloadId: string;
  fileName: string;
  fileIndex: number;
  totalFiles: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  eta: number; // seconds
}

/**
 * Download lifecycle start event payload
 */
export interface IDownloadStartEvent {
  downloadId: string;
  targetPath: string;
  topicId: string;
  channelId: string;
  totalFiles: number;
  selectedFiles: string[];
  timestamp: number;
}

/**
 * Download lifecycle completion event payload
 */
export interface IDownloadCompleteEvent {
  downloadId: string;
  topicId: string;
  totalFiles: number;
  downloadedFiles: number;
  failedFiles: number;
  hasFailures: boolean;
  durationMs: number;
  timestamp: number;
  realDownloadedFiles?: number;
  skippedFilesCount?: number;
}

/**
 * Download lifecycle error event payload
 */
export interface IDownloadErrorEvent {
  downloadId: string;
  topicId: string;
  error: string;
  timestamp: number;
}

/**
 * File-level download event (per file action)
 * action: downloaded | skipped | failed
 * reason: already_exists | error
 */
export interface IDownloadFileEvent {
  downloadId: string;
  topicId: string;
  fileName: string;
  action: 'downloaded' | 'skipped' | 'failed';
  reason?: 'already_exists' | 'error';
  index: number; // 1-based processed index after this action
  totalFiles: number;
  error?: string;
  timestamp: number;
}

/**
 * Topic file metadata (for UI file selection)
 */
export interface ITopicFileInfo {
  id: string; // Telegram message/document ID
  name: string;
  size: number;
  mimeType?: string;
  uploadedAt?: Date;
  messageId?: number;
}
