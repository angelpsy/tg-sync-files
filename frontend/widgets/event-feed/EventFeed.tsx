'use client';
import type { EventPayloadMap, TEventName } from '@/types/websocket/events';
import { WSEvent } from '@/types/websocket/events';
import { ChevronUp } from 'lucide-react';
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsubs = SUBSCRIBED_EVENTS.map(eventName =>
      on(eventName, (payload: EventPayloadMap[typeof eventName]) => {
        setItems(prev => {
          const next: FeedItem[] = [
            { id: `${Date.now()}-${Math.random()}`, event: eventName, payload, ts: Date.now() },
            ...prev,
          ];
          return next.slice(0, limit);
        });
      })
    );

    return () => {
      unsubs.forEach(unsubscribe => unsubscribe());
    };
  }, [limit]);

  const clear = () => setItems([]);

  const content = useMemo(
    () =>
      items.map(item => (
        <div key={item.id} className="border-b border-border py-2 last:border-b-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {item.event}
            </Badge>
            <span className="text-xs text-muted-foreground">{new Date(item.ts).toLocaleTimeString()}</span>
          </div>
          <div className="mt-1 text-xs break-words text-foreground">{formatEvent(item.event, item.payload)}</div>
        </div>
      )),
    [items]
  );

  return (
    <div className="fixed bottom-3 left-3 right-3 z-40 md:left-6 md:right-6">
      <Card className="bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border shadow-lg">
        <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
          <button
            type="button"
            onClick={() => setOpen(prev => !prev)}
            className="inline-flex items-center gap-2 text-left"
          >
            <ChevronUp className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            <CardTitle className="text-sm">Event Feed</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {items.length}
            </Badge>
          </button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={clear}>
              Clear
            </Button>
          </div>
        </CardHeader>
        {open && (
          <CardContent className="pt-0 pb-3 px-3">
            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No events yet</div>
            ) : (
              <div className="max-h-64 overflow-auto">{content}</div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
