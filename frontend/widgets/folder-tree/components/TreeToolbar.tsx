'use client';

import { Button } from '@/components/ui/button';

type Channel = { id: string; title: string };

type TreeToolbarProps = {
  channels: Channel[];
  selectedChannelId: string;
  singleChannel?: Channel;
  treeLoaded: boolean;
  onSelectChannel: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onHideFiles: () => void;
  onShowFiles: () => void;
};

export function TreeToolbar({
  channels,
  selectedChannelId,
  singleChannel,
  treeLoaded,
  onSelectChannel,
  onExpandAll,
  onCollapseAll,
  onHideFiles,
  onShowFiles,
}: TreeToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-end">
      <select
        className="border rounded px-2 py-1 bg-background text-foreground disabled:opacity-60 text-sm"
        value={selectedChannelId}
        onChange={e => onSelectChannel(e.target.value)}
        disabled={!!singleChannel}
      >
        {(singleChannel ? [singleChannel] : channels).map(channel => (
          <option key={channel.id} value={channel.id}>
            {channel.title}
          </option>
        ))}
      </select>
      <Button size="sm" variant="secondary" onClick={onExpandAll} disabled={!treeLoaded}>
        Expand all
      </Button>
      <Button size="sm" variant="secondary" onClick={onCollapseAll} disabled={!treeLoaded}>
        Collapse all
      </Button>
      <Button size="sm" variant="secondary" onClick={onHideFiles} disabled={!treeLoaded}>
        Hide files
      </Button>
      <Button size="sm" variant="secondary" onClick={onShowFiles} disabled={!treeLoaded}>
        Show files
      </Button>
    </div>
  );
}
