'use client';
import type { IFileRecord } from '@/types/file-sync/models';
import { WSEvent } from '@/types/websocket/events';
import { useEffect, useMemo, useRef, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

export function useTopicFilesQuery(topicId?: string, channelId?: string, refreshMs = 30000) {
  const [records, setRecords] = useState<IFileRecord[]>([]);
  const [originalFolders, setOriginalFolders] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const off = on(WSEvent.TOPIC_FILES_SNAPSHOT, payload => {
      if (payload && 'topicId' in payload && payload.topicId === topicId) {
        setRecords(payload.records || []);
        setOriginalFolders(payload.originalFolders || []);
      }
    });
    return () => off();
  }, [topicId]);

  useEffect(() => {
    if (!topicId || !channelId) return;
    const request = () => emit(WSEvent.REQUEST_TOPIC_FILES, { topicId, channelId });
    request();
    if (refreshMs > 0) {
      timerRef.current = setInterval(request, refreshMs);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [topicId, channelId, refreshMs]);

  return useMemo(() => ({ records, originalFolders }), [records, originalFolders]);
}
