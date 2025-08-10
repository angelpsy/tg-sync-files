/**
 * File sync domain enums
 */

/**
 * Upload status enum
 */
export const EUploadStatus = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type TUploadStatus = (typeof EUploadStatus)[keyof typeof EUploadStatus];

/**
 * Database-compatible UploadStatus enum (UPPERCASE values for Prisma)
 */
export const EUploadStatusDB = {
  PENDING: 'PENDING',
  UPLOADING: 'UPLOADING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type TUploadStatusDB = (typeof EUploadStatusDB)[keyof typeof EUploadStatusDB];

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
 * Mapping functions for enum conversion
 */

/**
 * Converts UploadStatus from domain model to database enum
 */
export function mapUploadStatusToPrisma(status: TUploadStatus): TUploadStatusDB {
  const statusMap: Record<TUploadStatus, TUploadStatusDB> = {
    [EUploadStatus.PENDING]: EUploadStatusDB.PENDING,
    [EUploadStatus.UPLOADING]: EUploadStatusDB.UPLOADING,
    [EUploadStatus.PAUSED]: EUploadStatusDB.PAUSED,
    [EUploadStatus.COMPLETED]: EUploadStatusDB.COMPLETED,
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
    [EUploadStatusDB.FAILED]: EUploadStatus.FAILED,
  };
  return statusMap[status];
}
