import { EOperationStatus, EUploadStatus } from '@/types/file-sync/enums';
import type { TOperationStatus, TUploadStatus } from '@/types/file-sync/enums';

export type UiOperationStatus = TOperationStatus | TUploadStatus;

export function isInProgress(status: UiOperationStatus): boolean {
  return status === EOperationStatus.IN_PROGRESS || status === EUploadStatus.UPLOADING;
}

export function isPending(status: UiOperationStatus): boolean {
  return status === EOperationStatus.PENDING || status === EUploadStatus.PENDING;
}

export function isPaused(status: UiOperationStatus): boolean {
  return status === EOperationStatus.PAUSED || status === EUploadStatus.PAUSED;
}

export function getStatusText(status: UiOperationStatus): string {
  if (status === EOperationStatus.PENDING) return 'Pending';
  if (isInProgress(status)) return 'In Progress';
  if (status === EOperationStatus.COMPLETED || status === EUploadStatus.COMPLETED) return 'Completed';
  if (status === EOperationStatus.FAILED || status === EUploadStatus.FAILED) return 'Failed';
  if (status === EOperationStatus.PARTIAL || status === EUploadStatus.PARTIAL) return 'Partially Complete';
  if (isPaused(status)) return 'Paused';
  return 'Unknown';
}

export function getStatusBadgeClass(status: UiOperationStatus): string {
  if (status === EOperationStatus.PENDING) return 'bg-yellow-100 text-yellow-800';
  if (isInProgress(status)) return 'bg-blue-100 text-blue-800';
  if (status === EOperationStatus.COMPLETED || status === EUploadStatus.COMPLETED)
    return 'bg-green-100 text-green-800';
  if (status === EOperationStatus.FAILED || status === EUploadStatus.FAILED)
    return 'bg-red-100 text-red-800';
  if (status === EOperationStatus.PARTIAL || status === EUploadStatus.PARTIAL)
    return 'bg-orange-100 text-orange-800';
  if (isPaused(status)) return 'bg-gray-100 text-gray-800';
  return 'bg-gray-100 text-gray-800';
}
