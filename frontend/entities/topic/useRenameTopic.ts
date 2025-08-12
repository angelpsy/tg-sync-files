'use client';
import type { ITopic } from '@/types/telegram/models';
import { useCallback } from 'react';

import { emit } from '@/shared/api/ws/events';

type RenameTopicCommand = { topicId: string; title: string };

/**
 * useRenameTopic — returns a function to request topic rename via WS
 */
export function useRenameTopic() {
  return useCallback((topic: ITopic, newTitle: string) => {
    // Placeholder event name; adjust when backend exposes explicit rename command
    const payload: RenameTopicCommand = { topicId: topic.id, title: newTitle };
    emit('sync_diff', payload as unknown as any);
  }, []);
}
