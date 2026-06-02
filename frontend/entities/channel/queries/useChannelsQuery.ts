'use client';
import type { ITelegramChannel } from '@/types/telegram/models';
import { WSEvent } from '@/types/websocket/events';
import { useEffect, useMemo, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

export function useChannelsQuery() {
  const [channels, setChannels] = useState<ITelegramChannel[]>([]);

  useEffect(() => {
    const off = on(WSEvent.CHANNELS_SNAPSHOT, payload => {
      setChannels(Array.isArray(payload) ? payload : []);
    });
    emit(WSEvent.REQUEST_CHANNELS, {});
    return () => off();
  }, []);

  const single = channels.length === 1 ? channels[0] : undefined;
  return useMemo(() => ({ channels, single }), [channels, single]);
}
