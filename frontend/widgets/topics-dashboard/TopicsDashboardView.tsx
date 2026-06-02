'use client';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileDownloadWidget } from '@/widgets/file-download/FileDownloadWidget';

import { formatMegabytes, type TopicsDashboardViewModel } from './model';

type TopicsDashboardViewProps = {
  vm: TopicsDashboardViewModel;
  onSelectChannel: (channelId: string) => void;
  onToggleTopic: (topicId: string) => void;
};

export function TopicsDashboardView({ vm, onSelectChannel, onToggleTopic }: TopicsDashboardViewProps) {
  return (
    <Card className="h-[calc(50vh-5.5rem)] min-h-[260px] flex flex-col">
      <CardHeader className="py-3 flex items-center gap-3">
        <CardTitle className="text-base">Topics</CardTitle>
        <div className="ml-auto min-w-64">
          <select
            className="w-full border rounded px-2 py-1 bg-background text-foreground disabled:opacity-60"
            value={vm.selectedChannel?.id || ''}
            onChange={event => onSelectChannel(event.target.value)}
            disabled={vm.singleChannelMode}
          >
            {vm.channels.map(channel => (
              <option key={channel.id} value={channel.id}>
                {channel.title}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm overflow-auto">
        {!vm.selectedChannel ? (
          <div className="text-muted-foreground">No channel selected</div>
        ) : vm.topics.length === 0 ? (
          <div className="text-muted-foreground">No topics yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {vm.topics.map(item => (
              <li key={item.topic.id} className="py-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onToggleTopic(item.topic.id)}
                  >
                    {item.isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </Button>
                  <span className="font-medium">{item.topic.title}</span>
                  {item.channelStatus && (
                    <Badge
                      variant={item.channelStatus.isConnected ? 'default' : 'secondary'}
                      className="ml-auto"
                    >
                      {item.channelStatus.status}
                    </Badge>
                  )}
                </div>

                {item.isExpanded && vm.selectedChannelId && (
                  <div className="pl-6 mt-2 space-y-4">
                    <FileDownloadWidget
                      topicId={item.topic.id}
                      channelId={vm.selectedChannelId}
                      files={vm.files}
                      className="mb-4"
                    />

                    {vm.originalFolders.length > 0 && (
                      <div className="text-muted-foreground mb-2">
                        Original folders: {vm.originalFolders.join(', ')}
                      </div>
                    )}
                    {vm.records.length === 0 ? (
                      <div className="text-muted-foreground">No files recorded.</div>
                    ) : (
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {vm.records.map(record => (
                          <li
                            key={`${record.topicId}-${record.fileName}`}
                            className="flex items-center justify-between border rounded px-2 py-1"
                          >
                            <span className="truncate" title={record.fileName}>
                              {record.fileName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatMegabytes(record.size)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
