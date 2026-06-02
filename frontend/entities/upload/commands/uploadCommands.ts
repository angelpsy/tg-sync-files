import { WSEvent } from '@/types/websocket/events';

import { emit } from '@/shared/api/ws/events';

export type StartFolderUploadCommand = {
  folderPath: string;
  channelId: string;
  existingTopicId?: string;
  newTopicName?: string;
  selectedFiles?: string[];
};

export function startFolderUpload(command: StartFolderUploadCommand) {
  emit(WSEvent.START_FOLDER_UPLOAD, command);
}

export function requestUploadSessions() {
  emit(WSEvent.REQUEST_UPLOAD_SESSIONS, {});
}

export function pauseUpload(uploadId: string) {
  emit(WSEvent.PAUSE_UPLOAD, { uploadId });
}

export function resumeUpload(uploadId: string) {
  emit(WSEvent.RESUME_UPLOAD, { uploadId });
}

export function cancelUpload(uploadId: string) {
  emit(WSEvent.CANCEL_UPLOAD, { uploadId });
}
