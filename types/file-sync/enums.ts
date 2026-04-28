/**
 * File sync domain enums
 */

/**
 * Unified operation status enum for both upload and download operations
 */
export enum EOperationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress', // covers both 'uploading' and 'downloading'
  PAUSED = 'paused',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed',
  SKIPPED = 'skipped', // For files that are skipped (already exist, etc.)
}

export type TOperationStatus = EOperationStatus;

/**
 * Database-compatible OperationStatus enum (UPPERCASE values for Prisma)
 */
export enum EOperationStatusDB {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export type TOperationStatusDB = EOperationStatusDB;

/**
 * Legacy upload status enum - kept for backward compatibility
 * @deprecated Use EOperationStatus instead
 */
export enum EUploadStatus {
  PENDING = 'pending',
  UPLOADING = 'in_progress', // mapped to IN_PROGRESS
  PAUSED = 'paused',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed',
}

export type TUploadStatus = EUploadStatus;

/**
 * Legacy database-compatible UploadStatus enum
 * @deprecated Use EOperationStatusDB instead
 */
export enum EUploadStatusDB {
  PENDING = 'PENDING',
  UPLOADING = 'IN_PROGRESS', // mapped to IN_PROGRESS
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

export type TUploadStatusDB = EUploadStatusDB;

/**
 * Download status enum - unified with upload
 */
export const EDownloadStatus = EOperationStatus;
export type TDownloadStatus = TOperationStatus;

/**
 * Database-compatible DownloadStatus enum - unified with upload
 */
export const EDownloadStatusDB = EOperationStatusDB;
export type TDownloadStatusDB = TOperationStatusDB;

/**
 * Sync status enum
 */
export enum ESyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export type TSyncStatus = ESyncStatus;

/**
 * File system change type
 */
export enum EFileChangeType {
  CREATED = 'created',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  RENAMED = 'renamed',
}

export type TFileChangeType = EFileChangeType;

/**
 * Upload conflict policy
 * SKIP      – treat existing name as satisfied (no new upload)
 * RENAME    – generate unique name (file (1).ext, file (2).ext ...)
 * LOG_ONLY  – upload anyway even if duplicate (may create remote duplicates)
 */
export enum EUploadConflictPolicy {
  SKIP = 'skip',
  RENAME = 'rename',
  LOG_ONLY = 'log_only',
}

export type TUploadConflictPolicy = EUploadConflictPolicy;

/**
 * File hash strategy (placeholder for future hashing enhancement)
 * none       – do not compute hashes (current default)
 * on_demand  – compute hash only if quick fingerprint (size+mtime) changed ambiguity detected
 * eager      – compute hash for every file during scan
 */
export enum EFileHashStrategy {
  NONE = 'none',
  ON_DEMAND = 'on_demand',
  EAGER = 'eager',
}

export type TFileHashStrategy = EFileHashStrategy;

/**
 * Mapping functions for enum conversion
 */

/**
 * Converts UploadStatus from domain model to database enum
 */
// NOTE: We intentionally avoid importing Prisma types here to keep the shared types package decoupled.
// Backend code can cast the returned value to Prisma.UploadStatus when needed.

export function mapUploadStatusToPrisma(status: TUploadStatus): TUploadStatusDB {
  const statusMap: Record<TUploadStatus, TUploadStatusDB> = {
    [EUploadStatus.PENDING]: EUploadStatusDB.PENDING,
    [EUploadStatus.UPLOADING]: EUploadStatusDB.UPLOADING,
    [EUploadStatus.PAUSED]: EUploadStatusDB.PAUSED,
    [EUploadStatus.COMPLETED]: EUploadStatusDB.COMPLETED,
    [EUploadStatus.PARTIAL]: EUploadStatusDB.PARTIAL,
    [EUploadStatus.FAILED]: EUploadStatusDB.FAILED,
  };
  return statusMap[status];
}

/**
 * Converts UploadStatus from database enum to domain model
 */
export function mapUploadStatusFromPrisma(status: TUploadStatusDB): TUploadStatus {
  const statusMap: Record<TUploadStatusDB, TUploadStatus> = {
    [EUploadStatusDB.PENDING]: EUploadStatus.PENDING,
    [EUploadStatusDB.UPLOADING]: EUploadStatus.UPLOADING,
    [EUploadStatusDB.PAUSED]: EUploadStatus.PAUSED,
    [EUploadStatusDB.COMPLETED]: EUploadStatus.COMPLETED,
    [EUploadStatusDB.PARTIAL]: EUploadStatus.PARTIAL,
    [EUploadStatusDB.FAILED]: EUploadStatus.FAILED,
  };
  return statusMap[status];
}
