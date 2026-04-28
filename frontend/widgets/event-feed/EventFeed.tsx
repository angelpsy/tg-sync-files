'use client';
import type { EventPayloadMap, TEventName } from '@/types/websocket/events';
import { WSEvent } from '@/types/websocket/events';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { on } from '@/shared/api/ws/events';

const SUBSCRIBED_EVENTS: TEventName[] = [
  WSEvent.FILE_SYNC_START,
  WSEvent.FILE_SYNC_PROGRESS,
  WSEvent.FILE_SYNC_COMPLETE,
  WSEvent.FILE_SYNC_ERROR,
  WSEvent.UPLOAD_START,
  WSEvent.UPLOAD_PROGRESS,
  WSEvent.UPLOAD_COMPLETE,
  WSEvent.UPLOAD_ERROR,
  WSEvent.UPLOAD_FILE_EVENT,
  WSEvent.SYNC_DIFF,
  WSEvent.FOLDER_TREE_UPDATE,
  WSEvent.CHANNEL_STATUS_UPDATE,
];

type FeedItem = { id: string; event: TEventName; payload: unknown; ts: number };

function formatEvent(event: TEventName, payload: unknown): string {
  try {
    return `${event}: ${JSON.stringify(payload)}`;
  } catch {
    return `${event}: [unserializable]`;
  }
}

export function EventFeed({ limit = 50 }: { limit?: number }) {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    const unsubs = SUBSCRIBED_EVENTS.map(ev =>
      on(ev, (payload: EventPayloadMap[typeof ev]) => {
        setItems(prev => {
          const next: FeedItem[] = [
            { id: `${Date.now()}-${Math.random()}`, event: ev, payload, ts: Date.now() },
            ...prev,
          ];
          return next.slice(0, limit);
        });
      })
    );
    return () => {
      unsubs.forEach(u => u());
    };
  }, [limit]);

  const clear = () => setItems([]);

  const content = useMemo(
    () =>
      items.map(it => (
        <div key={it.id} className="border-b border-border py-2 last:border-b-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {it.event}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(it.ts).toLocaleTimeString()}
            </span>
          </div>
          <div className="mt-1 text-xs break-words text-foreground">
            {formatEvent(it.event, it.payload)}
          </div>
        </div>
      )),
    [items]
  );

  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Event Feed</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
          <Button size="sm" variant="outline" onClick={clear}>
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No events yet</div>
        ) : (
          <div className="max-h-80 overflow-auto">{content}</div>
        )}
      </CardContent>
    </Card>
  );
}
