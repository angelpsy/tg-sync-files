/**
 * WebSocket events registry (compile-time mapping EventName -> Payload type)
 */

import type {
  IFileSyncEvent,
  ISyncDiffResult,
  IUploadCompleteEvent,
  IUploadErrorEvent,
  IUploadFileEvent,
  IUploadProgress,
  IUploadStartEvent,
} from '../file-sync/index.js';
import type { IChannelStatus } from '../telegram/index.js';

// Protocol version for WS messages (bump when breaking wire changes occur)
export const WS_PROTOCOL_VERSION = 1 as const;

// Canonical event name union (string literal types)
export const EventNames = [
  // File sync lifecycle
  'file_sync_start',
  'file_sync_progress',
  'file_sync_complete',
  'file_sync_error',
  // Upload lifecycle
  'upload_start',
  'upload_progress',
  'upload_complete',
  'upload_error',
  'upload_file_event',
  // Diff
  'sync_diff',
  // FS / system
  'folder_tree_update',
  'channel_status_update',
] as const;

export type TEventName = (typeof EventNames)[number];

// Mapping of event name to payload type
export interface EventPayloadMap {
  file_sync_start: IFileSyncEvent;
  file_sync_progress: IFileSyncEvent;
  file_sync_complete: IFileSyncEvent;
  file_sync_error: IFileSyncEvent;
  upload_start: IUploadStartEvent;
  upload_progress: IUploadProgress;
  upload_complete: IUploadCompleteEvent;
  upload_error: IUploadErrorEvent;
  upload_file_event: IUploadFileEvent;
  sync_diff: ISyncDiffResult;
  folder_tree_update: unknown; // Provided by FS layer (tree snapshot)
  channel_status_update: IChannelStatus;
}

// Helper generic for narrowing payload type
export type EventPayload<E extends TEventName> = EventPayloadMap[E];
