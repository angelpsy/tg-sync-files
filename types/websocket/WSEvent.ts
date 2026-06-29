/**
 * WebSocket events enum
 */
export enum WSEvent {
  // File sync lifecycle
  FILE_SYNC_START = 'file_sync_start',
  FILE_SYNC_PROGRESS = 'file_sync_progress',
  FILE_SYNC_COMPLETE = 'file_sync_complete',
  FILE_SYNC_ERROR = 'file_sync_error',

  // Upload lifecycle
  UPLOAD_START = 'upload_start',
  UPLOAD_PROGRESS = 'upload_progress',
  UPLOAD_COMPLETE = 'upload_complete',
  UPLOAD_ERROR = 'upload_error',
  UPLOAD_FILE_EVENT = 'upload_file_event',

  // Download lifecycle
  DOWNLOAD_START = 'download_start',
  DOWNLOAD_PROGRESS = 'download_progress',
  DOWNLOAD_COMPLETE = 'download_complete',
  DOWNLOAD_ERROR = 'download_error',
  DOWNLOAD_FILE_EVENT = 'download_file_event',

  // Diff
  SYNC_DIFF = 'sync_diff',

  // FS / system
  FOLDER_TREE_UPDATE = 'folder_tree_update',
  CHANNEL_STATUS_UPDATE = 'channel_status_update',

  // Snapshots
  CHANNELS_SNAPSHOT = 'channels_snapshot',
  TOPICS_SNAPSHOT = 'topics_snapshot',
  TOPIC_FILES_SNAPSHOT = 'topic_files_snapshot',

  // Inbound requests (client -> server)
  REQUEST_CHANNELS = 'request_channels',
  REQUEST_TOPICS = 'request_topics',
  REQUEST_TOPIC_FILES = 'request_topic_files',

  // Upload control
  START_FOLDER_UPLOAD = 'start_folder_upload',
  START_BULK_FOLDER_UPLOAD = 'start_bulk_folder_upload',
  PAUSE_UPLOAD = 'pause_upload',
  RESUME_UPLOAD = 'resume_upload',
  CANCEL_UPLOAD = 'cancel_upload',
  REQUEST_UPLOAD_SESSIONS = 'request_upload_sessions',

  // Download control
  START_TOPIC_DOWNLOAD = 'start_topic_download',
  PAUSE_DOWNLOAD = 'pause_download',
  RESUME_DOWNLOAD = 'resume_download',
  CANCEL_DOWNLOAD = 'cancel_download',
  REQUEST_DOWNLOAD_SESSIONS = 'request_download_sessions',

  // Auth flow
  AUTH_INIT = 'auth_init',
  AUTH_QR_INIT = 'auth_qr_init',
  AUTH_QR_CANCEL = 'auth_qr_cancel',
  AUTH_RESEND_CODE = 'auth_resend_code',
  AUTH_CODE = 'auth_code',
  AUTH_PASSWORD = 'auth_password',
  AUTH_LOGOUT = 'auth_logout',
  AUTH_STATE = 'auth_state',
  REQUEST_AUTH_STATE = 'request_auth_state',

  // Auth responses
  AUTH_QR_CODE = 'auth_qr_code',
  AUTH_PENDING_CODE = 'auth_pending_code',
  AUTH_PENDING_PASSWORD = 'auth_pending_password',
  AUTH_SUCCESS = 'auth_success',
  AUTH_ERROR = 'auth_error',

  // Sessions snapshot
  UPLOAD_SESSIONS_SNAPSHOT = 'upload_sessions_snapshot',
  DOWNLOAD_SESSIONS_SNAPSHOT = 'download_sessions_snapshot',
}
