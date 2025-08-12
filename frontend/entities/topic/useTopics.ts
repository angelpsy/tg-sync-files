'use client';
import type { ITopic } from '@/types/telegram/models';

/**
 * useTopics — placeholder hook; will subscribe to a typed WS event once backend exposes topics.
 */
export function useTopics(channelId?: string) {
  const topics: ITopic[] = [];
  const data = channelId ? topics.filter(t => t.channelId === channelId) : topics;
  return { topics: data } as const;
}
