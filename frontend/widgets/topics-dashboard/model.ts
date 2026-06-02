import type { IFileRecord, ITopicFileInfo } from '@/types/file-sync/models';
import type { IChannelStatus, ITelegramChannel, ITopic } from '@/types/telegram/models';

export type TopicListItemViewModel = {
  topic: ITopic;
  channelStatus?: IChannelStatus;
  isExpanded: boolean;
};

export type TopicsDashboardViewModel = {
  channels: ITelegramChannel[];
  selectedChannel?: ITelegramChannel;
  selectedChannelId?: string;
  topics: TopicListItemViewModel[];
  expandedTopicId?: string;
  records: IFileRecord[];
  files: ITopicFileInfo[];
  originalFolders: string[];
  singleChannelMode: boolean;
};

export function buildTopicsDashboardViewModel(input: {
  channels: ITelegramChannel[];
  single?: ITelegramChannel;
  selectedChannel?: ITelegramChannel;
  selectedChannelId?: string;
  topics: ITopic[];
  statuses: Record<string, IChannelStatus>;
  expandedTopicId?: string;
  records: IFileRecord[];
  files: ITopicFileInfo[];
  originalFolders: string[];
}): TopicsDashboardViewModel {
  const topicItems: TopicListItemViewModel[] = input.topics.map(topic => ({
    topic,
    channelStatus: topic.channelId ? input.statuses[topic.channelId] : undefined,
    isExpanded: input.expandedTopicId === topic.id,
  }));

  return {
    channels: input.single ? [input.single] : input.channels,
    selectedChannel: input.selectedChannel,
    selectedChannelId: input.selectedChannelId,
    topics: topicItems,
    expandedTopicId: input.expandedTopicId,
    records: input.records,
    files: input.files,
    originalFolders: input.originalFolders,
    singleChannelMode: !!input.single,
  };
}

export function formatMegabytes(sizeInBytes: number): string {
  return `${(sizeInBytes / 1024 / 1024).toFixed(1)} MB`;
}
