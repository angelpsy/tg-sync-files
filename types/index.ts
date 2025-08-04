// Shared types for Telegram FileSync project

/**
 * Telegram channel configuration
 */
export interface TelegramChannel {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * File sync status
 */
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'error';

/**
 * File sync event payload
 */
export interface FileSyncEvent {
  id: string;
  fileName: string;
  filePath: string;
  channelId: string;
  status: SyncStatus;
  timestamp: Date;
  error?: string;
}

/**
 * WebSocket message types
 */
export type WSMessageType = 
  | 'file_sync_start'
  | 'file_sync_progress' 
  | 'file_sync_complete'
  | 'file_sync_error'
  | 'channel_status_update';

/**
 * WebSocket message structure
 */
export interface WSMessage<T = any> {
  type: WSMessageType;
  payload: T;
  timestamp: number;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}
