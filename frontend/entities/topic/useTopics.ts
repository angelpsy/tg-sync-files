'use client';
import type { ITopic } from '@/types/telegram/models';
import { WSEvent } from '@/types/websocket/events';
import { useEffect, useMemo, useRef, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

export function useTopics(channelId?: string, refreshMs = 30000) {
  const [topics, setTopics] = useState<ITopic[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const off = on(WSEvent.TOPICS_SNAPSHOT, payload => {
      if (payload && 'channelId' in payload && payload.channelId === channelId) {
        setTopics(payload.topics || []);
      }
    });
    return () => off();
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;
    const request = () => emit(WSEvent.REQUEST_TOPICS, { channelId });
    request();
    if (refreshMs > 0) {
      timerRef.current = setInterval(request, refreshMs);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [channelId, refreshMs]);

  return useMemo(() => ({ topics }), [topics]);
}
