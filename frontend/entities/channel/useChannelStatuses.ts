'use client';
import type { IChannelStatus } from '@/types/telegram/models';
import { useEffect, useState } from 'react';

import { on } from '@/shared/api/ws/events';

/**
 * useChannelStatuses — subscribes to channel_status_update events
 */
export function useChannelStatuses() {
  const [statuses, setStatuses] = useState<Record<string, IChannelStatus>>({});

  useEffect(() => {
    const off = on('channel_status_update', payload => {
      const st = payload as IChannelStatus;
      setStatuses(prev => ({ ...prev, [st.channelId]: st }));
    });
    return () => off();
  }, []);

  return { statuses } as const;
}
