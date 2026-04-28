'use client';
import { WSEvent } from '@/types/websocket/events';
import { useCallback } from 'react';

import { emit } from '@/shared/api/ws/events';

export interface DownloadOptions {
  topicId: string;
  channelId: string;
  targetPath: string;
  selectedFiles?: string[];
  overwriteExisting?: boolean;
}

export function useDownload() {
  const startDownload = useCallback((options: DownloadOptions) => {
    emit(WSEvent.START_TOPIC_DOWNLOAD, {
      topicId: options.topicId,
      channelId: options.channelId,
      targetPath: options.targetPath,
      selectedFiles: options.selectedFiles,
      overwriteExisting: options.overwriteExisting,
    });
  }, []);

  // TODO: Add pause/resume when backend events are available
  // const pauseDownload = useCallback((downloadId: string) => {
  //   emit('download_pause', { downloadId });
  // }, []);

  // const resumeDownload = useCallback((downloadId: string) => {
  //   emit('download_resume', { downloadId });
  // }, []);

  return {
    startDownload,
    // pauseDownload,
    // resumeDownload,
  } as const;
}
