'use client';
import type { ITelegramChannel, ITopic } from '@/types/telegram/models';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChannelStatuses } from '@/entities/channel/useChannelStatuses';
import { useTopics } from '@/entities/topic/useTopics';

/**
 * TopicsDashboard – renders list of topics (placeholder until WS topics event).
 * Shows channel status if available from useChannelStatuses.
 */
export function TopicsDashboard({ channel }: { channel?: ITelegramChannel }) {
  const { topics } = useTopics(channel?.id);
  const { statuses } = useChannelStatuses();

  const list = useMemo(() => topics, [topics]);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Topics{channel ? ` · ${channel.title}` : ''}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {list.length === 0 ? (
          <div className="text-muted-foreground">No topics yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((t: ITopic) => {
              const st = t.channelId ? statuses[t.channelId] : undefined;
              return (
                <li key={t.id} className="py-2 flex items-center gap-2">
                  <span className="font-medium">{t.title}</span>
                  {st && (
                    <Badge variant={st.isConnected ? 'default' : 'secondary'} className="ml-auto">
                      {st.status}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
