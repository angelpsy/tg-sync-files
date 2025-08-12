'use client';
import type { ITopic } from '@/types/telegram/models';
import { useCallback } from 'react';

// Placeholder: will emit a proper WS command when backend exposes rename API

/**
 * useRenameTopic — returns a function to request topic rename via WS
 */
export function useRenameTopic() {
  return useCallback((topic: ITopic, newTitle: string) => {
    console.warn('[useRenameTopic] not implemented yet', { topicId: topic.id, newTitle });
  }, []);
}
