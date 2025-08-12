'use client';
import type { ITelegramChannel } from '@/types/telegram/models';
import { useEffect, useMemo, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

export function useChannels() {
  const [channels, setChannels] = useState<ITelegramChannel[]>([]);

  useEffect(() => {
    const off = on('channels_snapshot', payload => {
      setChannels(Array.isArray(payload) ? payload : []);
    });
    emit('request_channels', {});
    return () => off();
  }, []);

  const single = channels.length === 1 ? channels[0] : undefined;
  return useMemo(() => ({ channels, single }), [channels, single]);
}
