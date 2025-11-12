'use client';
import type { ITopicFileInfo } from '@/types/file-sync/models';
import { useEffect, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

export function useTopicFilesList(topicId?: string, channelId?: string) {
  const [files, setFiles] = useState<ITopicFileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const off = on('topic_files_snapshot', payload => {
      if (payload && 'topicId' in payload && payload.topicId === topicId) {
        // topic_files_snapshot should contain files: ITopicFileInfo[] according to events.ts
        setFiles(payload.files || []);
        setIsLoading(false);
      }
    });
    return () => off();
  }, [topicId]);

  useEffect(() => {
    if (!topicId || !channelId) {
      setFiles([]);
      return;
    }

    setIsLoading(true);
    // Request topic files using the proper event
    emit('request_topic_files', { topicId, channelId });
  }, [topicId, channelId]);

  return {
    files,
    isLoading,
    refetch: () => {
      if (topicId && channelId) {
        setIsLoading(true);
        emit('request_topic_files', { topicId, channelId });
      }
    },
  } as const;
}
