'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ITelegramChannel } from '@/types/telegram/models';

const CHANNEL_STORAGE_KEY = 'tg-sync:selectedChannelId';
const CHANNEL_EVENT = 'tg-sync:selected-channel-change';

type ChannelSelectionPayload = {
  channelId?: string;
};

export function usePersistedChannelSelectionQuery(
  channels: ITelegramChannel[],
  single?: ITelegramChannel
) {
  const [selectedChannelId, setSelectedChannelIdState] = useState<string | undefined>(single?.id);

  const persistAndBroadcast = useCallback((channelId?: string) => {
    if (typeof window === 'undefined') return;
    if (channelId) window.localStorage.setItem(CHANNEL_STORAGE_KEY, channelId);
    else window.localStorage.removeItem(CHANNEL_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent<ChannelSelectionPayload>(CHANNEL_EVENT, { detail: { channelId } }));
  }, []);

  const setSelectedChannelId = useCallback(
    (channelId?: string) => {
      setSelectedChannelIdState(channelId);
      persistAndBroadcast(channelId);
    },
    [persistAndBroadcast]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(CHANNEL_STORAGE_KEY) || undefined;
    if (stored) setSelectedChannelIdState(stored);
  }, []);

  useEffect(() => {
    const hasChannels = channels.length > 0;
    if (single?.id) {
      if (selectedChannelId !== single.id) {
        setSelectedChannelIdState(single.id);
        persistAndBroadcast(single.id);
      }
      return;
    }

    if (!hasChannels) return;

    const exists = selectedChannelId && channels.some(channel => channel.id === selectedChannelId);
    if (exists) return;

    const fallback = channels[0]?.id;
    if (fallback) {
      setSelectedChannelIdState(fallback);
      persistAndBroadcast(fallback);
    }
  }, [channels, single?.id, selectedChannelId, persistAndBroadcast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== CHANNEL_STORAGE_KEY) return;
      setSelectedChannelIdState(event.newValue || undefined);
    };

    const onCustom = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail;
      if (!detail || typeof detail !== 'object') return;
      const maybeChannelId = Reflect.get(detail, 'channelId');
      setSelectedChannelIdState(
        typeof maybeChannelId === 'string' && maybeChannelId.length > 0 ? maybeChannelId : undefined
      );
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANNEL_EVENT, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANNEL_EVENT, onCustom);
    };
  }, []);

  const selectedChannel = useMemo(
    () => channels.find(channel => channel.id === selectedChannelId) || single,
    [channels, selectedChannelId, single]
  );

  return {
    selectedChannelId,
    selectedChannel,
    setSelectedChannelId,
  } as const;
}
