'use client';
import type { IFileRecord } from '@/types/file-sync/models';
import { useEffect, useMemo, useRef, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

export function useTopicFiles(topicId?: string, refreshMs = 30000) {
  const [records, setRecords] = useState<IFileRecord[]>([]);
  const [originalFolders, setOriginalFolders] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const off = on('topic_files_snapshot', payload => {
      if (payload && 'topicId' in payload && payload.topicId === topicId) {
        setRecords(payload.records || []);
        setOriginalFolders(payload.originalFolders || []);
      }
    });
    return () => off();
  }, [topicId]);

  useEffect(() => {
    if (!topicId) return;
    const request = () => emit('request_topic_files', { topicId });
    request();
    if (refreshMs > 0) {
      timerRef.current = setInterval(request, refreshMs);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [topicId, refreshMs]);

  return useMemo(() => ({ records, originalFolders }), [records, originalFolders]);
}
