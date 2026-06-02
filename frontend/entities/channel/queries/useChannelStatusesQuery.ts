'use client';
import type { IChannelStatus } from '@/types/telegram/models';
import { WSEvent } from '@/types/websocket/events';
import { useEffect, useState } from 'react';

import { on } from '@/shared/api/ws/events';

/**
 * useChannelStatuses — subscribes to channel_status_update events
 */
export function useChannelStatusesQuery() {
  const [statuses, setStatuses] = useState<Record<string, IChannelStatus>>({});

  useEffect(() => {
    const off = on(WSEvent.CHANNEL_STATUS_UPDATE, status => {
      setStatuses(prev => ({ ...prev, [status.channelId]: status }));
    });
    return () => off();
  }, []);

  return { statuses } as const;
}
