/**
 * File sync domain enums
 */

/**
 * Unified operation status enum for both upload and download operations
 */
export const EOperationStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress', // covers both 'uploading' and 'downloading'
  PAUSED: 'paused',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
  SKIPPED: 'skipped', // For files that are skipped (already exist, etc.)
} as const;

export type TOperationStatus = (typeof EOperationStatus)[keyof typeof EOperationStatus];

/**
 * Database-compatible OperationStatus enum (UPPERCASE values for Prisma)
 */
export const EOperationStatusDB = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

export type TOperationStatusDB = (typeof EOperationStatusDB)[keyof typeof EOperationStatusDB];

/**
 * Legacy upload status enum - kept for backward compatibility
 * @deprecated Use EOperationStatus instead
 */
export const EUploadStatus = {
  PENDING: 'pending',
  UPLOADING: 'in_progress', // mapped to IN_PROGRESS
  PAUSED: 'paused',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
} as const;

export type TUploadStatus = (typeof EUploadStatus)[keyof typeof EUploadStatus];

/**
 * Legacy database-compatible UploadStatus enum
 * @deprecated Use EOperationStatusDB instead
 */
export const EUploadStatusDB = {
  PENDING: 'PENDING',
  UPLOADING: 'IN_PROGRESS', // mapped to IN_PROGRESS
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
} as const;

export type TUploadStatusDB = (typeof EUploadStatusDB)[keyof typeof EUploadStatusDB];

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
export const ESyncStatus = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;

export type TSyncStatus = (typeof ESyncStatus)[keyof typeof ESyncStatus];

/**
 * File system change type
 */
export const EFileChangeType = {
  CREATED: 'created',
  MODIFIED: 'modified',
  DELETED: 'deleted',
  RENAMED: 'renamed',
} as const;

export type TFileChangeType = (typeof EFileChangeType)[keyof typeof EFileChangeType];

/**
 * Upload conflict policy
 * SKIP      – treat existing name as satisfied (no new upload)
 * RENAME    – generate unique name (file (1).ext, file (2).ext ...)
 * LOG_ONLY  – upload anyway even if duplicate (may create remote duplicates)
 */
export const EUploadConflictPolicy = {
  SKIP: 'skip',
  RENAME: 'rename',
  LOG_ONLY: 'log_only',
} as const;

export type TUploadConflictPolicy =
  (typeof EUploadConflictPolicy)[keyof typeof EUploadConflictPolicy];

/**
 * File hash strategy (placeholder for future hashing enhancement)
 * none       – do not compute hashes (current default)
 * on_demand  – compute hash only if quick fingerprint (size+mtime) changed ambiguity detected
 * eager      – compute hash for every file during scan
 */
export const EFileHashStrategy = {
  NONE: 'none',
  ON_DEMAND: 'on_demand',
  EAGER: 'eager',
} as const;

export type TFileHashStrategy = (typeof EFileHashStrategy)[keyof typeof EFileHashStrategy];

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
