/**
 * WebSocket events registry (compile-time mapping EventName -> Payload type)
 */

import type {
  IFileRecord,
  IFileSyncEvent,
  ISyncDiffResult,
  IUploadCompleteEvent,
  IUploadErrorEvent,
  IUploadFileEvent,
  IUploadProgress,
  IUploadStartEvent,
} from '../file-sync/index.js';
import type { IChannelStatus, ITelegramChannel, ITopic } from '../telegram/index.js';

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
  // Telegram data snapshots
  'channels_snapshot',
  'topics_snapshot',
  'topic_files_snapshot',
  // Client requests (inbound)
  'request_channels',
  'request_topics',
  'request_topic_files',
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
  // Snapshots
  channels_snapshot: ITelegramChannel[];
  topics_snapshot: { channelId: string; topics: ITopic[] };
  topic_files_snapshot: { topicId: string; records: IFileRecord[]; originalFolders: string[] };
  // Requests (client -> server)
  request_channels: Record<string, never>;
  request_topics: { channelId: string };
  request_topic_files: { topicId: string };
}

// Helper generic for narrowing payload type
export type EventPayload<E extends TEventName> = EventPayloadMap[E];
