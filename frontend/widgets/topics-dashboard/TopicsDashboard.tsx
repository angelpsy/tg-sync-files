'use client';
import type { ITelegramChannel, ITopic } from '@/types/telegram/models';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChannels } from '@/entities/channel/useChannels';
import { useChannelStatuses } from '@/entities/channel/useChannelStatuses';
import { useTopicFiles, useTopicFilesList, useTopics } from '@/entities/topic';
import { FileDownloadWidget } from '@/widgets/file-download';

export function TopicsDashboard() {
  const { channels, single } = useChannels();
  const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(single?.id);
  const { topics } = useTopics(selectedChannelId);
  const { statuses } = useChannelStatuses();
  const [expandedTopicId, setExpandedTopicId] = useState<string | undefined>(undefined);
  const { records, originalFolders } = useTopicFiles(expandedTopicId, selectedChannelId);
  const { files } = useTopicFilesList(expandedTopicId, selectedChannelId);

  const list = useMemo(() => topics, [topics]);
  const selectedChannel = useMemo(
    () => channels.find(c => c.id === selectedChannelId) || single,
    [channels, selectedChannelId, single]
  );

  // Ensure selection defaults
  if (!selectedChannelId) {
    if (single?.id) setSelectedChannelId(single.id);
    else if (channels.length > 0) setSelectedChannelId(channels[0].id);
  }

  return (
    <Card>
      <CardHeader className="py-3 flex items-center gap-3">
        <CardTitle className="text-base">Topics</CardTitle>
        <div className="ml-auto min-w-64">
          <select
            className="w-full border rounded px-2 py-1 bg-background text-foreground disabled:opacity-60"
            value={selectedChannel?.id || ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedChannelId(e.target.value)
            }
            disabled={!!single}
          >
            {(single ? [single] : channels).map((c: ITelegramChannel) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!selectedChannel ? (
          <div className="text-muted-foreground">No channel selected</div>
        ) : list.length === 0 ? (
          <div className="text-muted-foreground">No topics yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((t: ITopic) => {
              const st = t.channelId ? statuses[t.channelId] : undefined;
              const open = expandedTopicId === t.id;
              return (
                <li key={t.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedTopicId(open ? undefined : t.id)}
                    >
                      {open ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </Button>
                    <span className="font-medium">{t.title}</span>
                    {st && (
                      <Badge variant={st.isConnected ? 'default' : 'secondary'} className="ml-auto">
                        {st.status}
                      </Badge>
                    )}
                  </div>
                  {open && selectedChannelId && (
                    <div className="pl-6 mt-2 space-y-4">
                      {/* Download Section */}
                      <FileDownloadWidget
                        topicId={t.id}
                        channelId={selectedChannelId}
                        files={files}
                        className="mb-4"
                      />

                      {/* Existing Files Records */}
                      {originalFolders.length > 0 && (
                        <div className="text-muted-foreground mb-2">
                          Original folders: {originalFolders.join(', ')}
                        </div>
                      )}
                      {records.length === 0 ? (
                        <div className="text-muted-foreground">No files recorded.</div>
                      ) : (
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {records.map(r => (
                            <li
                              key={`${r.topicId}-${r.fileName}`}
                              className="flex items-center justify-between border rounded px-2 py-1"
                            >
                              <span className="truncate" title={r.fileName}>
                                {r.fileName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {(r.size / 1024 / 1024).toFixed(1)} MB
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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
