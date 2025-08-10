/**
 * WebSocket domain enums
 */

/**
 * WebSocket message types enum
 */
export const EWSMessageType = {
  // File sync events
  FILE_SYNC_START: 'file_sync_start',
  FILE_SYNC_PROGRESS: 'file_sync_progress',
  FILE_SYNC_COMPLETE: 'file_sync_complete',
  FILE_SYNC_ERROR: 'file_sync_error',

  // Upload events
  UPLOAD_START: 'upload_start',
  UPLOAD_PROGRESS: 'upload_progress',
  UPLOAD_COMPLETE: 'upload_complete',
  UPLOAD_ERROR: 'upload_error',

  // Download events
  DOWNLOAD_START: 'download_start',
  DOWNLOAD_PROGRESS: 'download_progress',
  DOWNLOAD_COMPLETE: 'download_complete',
  DOWNLOAD_ERROR: 'download_error',

  // System events
  FOLDER_TREE_UPDATE: 'folder_tree_update',
  CHANNEL_STATUS_UPDATE: 'channel_status_update',

  // Connection events
  CLIENT_CONNECTED: 'client_connected',
  CLIENT_DISCONNECTED: 'client_disconnected',
} as const;

export type TWSMessageType = (typeof EWSMessageType)[keyof typeof EWSMessageType];

/**
 * WebSocket connection status
 */
export const EWSConnectionStatus = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  RECONNECTING: 'reconnecting',
} as const;

export type TWSConnectionStatus = (typeof EWSConnectionStatus)[keyof typeof EWSConnectionStatus];
