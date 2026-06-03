'use client';
import { useMemo, useState } from 'react';

import { buildTopicsDashboardViewModel } from './model';
import { TopicsDashboardView } from './TopicsDashboardView';

import { useChannelsQuery } from '@/entities/channel/queries/useChannelsQuery';
import { useChannelStatusesQuery } from '@/entities/channel/queries/useChannelStatusesQuery';
import { usePersistedChannelSelectionQuery } from '@/entities/channel/queries/usePersistedChannelSelectionQuery';
import { useTopicFilesListQuery } from '@/entities/topic/queries/useTopicFilesListQuery';
import { useTopicFilesQuery } from '@/entities/topic/queries/useTopicFilesQuery';
import { useTopicsQuery } from '@/entities/topic/queries/useTopicsQuery';

export function TopicsDashboard() {
  const { channels, single } = useChannelsQuery();
  const { selectedChannelId, selectedChannel, setSelectedChannelId } =
    usePersistedChannelSelectionQuery(channels, single);
  const { topics } = useTopicsQuery(selectedChannelId);
  const { statuses } = useChannelStatusesQuery();

  const [expandedTopicId, setExpandedTopicId] = useState<string | undefined>(undefined);
  const { records, originalFolders } = useTopicFilesQuery(expandedTopicId, selectedChannelId);
  const { files } = useTopicFilesListQuery(expandedTopicId, selectedChannelId);

  const viewModel = useMemo(
    () =>
      buildTopicsDashboardViewModel({
        channels,
        single,
        selectedChannel,
        selectedChannelId,
        topics,
        statuses,
        expandedTopicId,
        records,
        files,
        originalFolders,
      }),
    [
      channels,
      single,
      selectedChannel,
      selectedChannelId,
      topics,
      statuses,
      expandedTopicId,
      records,
      files,
      originalFolders,
    ]
  );

  return (
    <TopicsDashboardView
      vm={viewModel}
      onSelectChannel={setSelectedChannelId}
      onToggleTopic={topicId =>
        setExpandedTopicId(prev => (prev === topicId ? undefined : topicId))
      }
    />
  );
}
