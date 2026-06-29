/**
 * WebSocket events registry (compile-time mapping EventName -> Payload type)
 */

import type {
  IDownloadCompleteEvent,
  IDownloadErrorEvent,
  IDownloadFileEvent,
  IDownloadProgress,
  IDownloadSession,
  IDownloadStartEvent,
  IFileRecord,
  IFileSyncEvent,
  ISyncDiffResult,
  ITopicFileInfo,
  IUploadCompleteEvent,
  IUploadErrorEvent,
  IUploadFileEvent,
  IUploadProgress,
  IUploadSession,
  IUploadStartEvent,
} from '../file-sync/index.js';
import type {
  IChannelStatus,
  ITelegramAuthCodeDelivery,
  ITelegramChannel,
  ITelegramQrAuthToken,
  ITelegramUserMinimal,
  ITopic,
} from '../telegram/index.js';

// Protocol version for WS messages (bump when breaking wire changes occur)
export const WS_PROTOCOL_VERSION = 1 as const;

// Canonical event names
import { WSEvent } from './WSEvent';
export { WSEvent };

export type TEventName = WSEvent;
export const EventNames = Object.values(WSEvent) as TEventName[];

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
  download_start: IDownloadStartEvent;
  download_progress: IDownloadProgress;
  download_complete: IDownloadCompleteEvent;
  download_error: IDownloadErrorEvent;
  download_file_event: IDownloadFileEvent;
  sync_diff: ISyncDiffResult;
  folder_tree_update: unknown; // Provided by FS layer (tree snapshot)
  channel_status_update: IChannelStatus;
  // Snapshots
  channels_snapshot: ITelegramChannel[];
  topics_snapshot: { channelId: string; topics: ITopic[] };
  topic_files_snapshot: {
    topicId: string;
    files: ITopicFileInfo[];
    records: IFileRecord[];
    originalFolders: string[];
  };
  // Requests (client -> server)
  request_channels: Record<string, never>;
  request_topics: { channelId: string };
  request_topic_files: { topicId: string; channelId: string };
  // Upload control (client -> server)
  start_folder_upload: {
    folderPath: string;
    channelId: string;
    existingTopicId?: string;
    newTopicName?: string;
    selectedFiles?: string[]; // if omitted => all child files
    conflictPolicy?: 'skip' | 'rename' | 'log_only';
    hashStrategy?: 'none' | 'on_demand' | 'eager';
  };
  start_bulk_folder_upload: Array<{
    folderPath: string;
    channelId: string;
    existingTopicId?: string;
    newTopicName?: string;
    selectedFiles?: string[];
    conflictPolicy?: 'skip' | 'rename' | 'log_only';
    hashStrategy?: 'none' | 'on_demand' | 'eager';
  }>;
  request_upload_sessions: Record<string, never>;
  pause_upload: { uploadId: string };
  resume_upload: { uploadId: string };
  cancel_upload: { uploadId: string };
  // Download control (client -> server)
  start_topic_download: {
    topicId: string;
    channelId: string;
    targetPath: string;
    selectedFiles?: string[]; // if omitted => all files
    overwriteExisting?: boolean; // default: false
  };
  pause_download: { sessionId: string };
  resume_download: { sessionId: string };
  cancel_download: { sessionId: string };
  request_download_sessions: Record<string, never>;
  // Auth requests
  auth_init: { phone: string };
  auth_qr_init: Record<string, never>;
  auth_qr_cancel: Record<string, never>;
  auth_resend_code: Record<string, never>;
  auth_code: { code: string };
  auth_password: { password: string };
  auth_logout: Record<string, never>;
  request_auth_state: Record<string, never>;
  // Auth responses
  auth_qr_code: ITelegramQrAuthToken;
  auth_pending_code: { maskedPhone?: string; delivery?: ITelegramAuthCodeDelivery };
  auth_pending_password: { maskedPhone?: string };
  auth_success: { maskedPhone: string };
  auth_error: { code: string; message: string };
  // Auth state broadcast
  auth_state: { isAuthenticated: boolean; user?: ITelegramUserMinimal };
  // Upload sessions snapshot (server -> clients)
  upload_sessions_snapshot: { sessions: IUploadSession[] };
  // Download sessions snapshot (server -> clients)
  download_sessions_snapshot: { sessions: IDownloadSession[] };
}

// Helper generic for narrowing payload type
export type EventPayload<E extends TEventName> = EventPayloadMap[E];
