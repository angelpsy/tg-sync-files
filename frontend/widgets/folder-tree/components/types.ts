import type { IFolderTree } from '@/entities/folder/types';
import type { IUploadSession } from '@/types/file-sync';

export type TopicOption = { id: string; title?: string; name?: string };

export type FolderTreeNodeProps = {
  node: IFolderTree;
  depth: number;
  expanded: Set<string>;
  changedPaths: Set<string>;
  hiddenFiles: Set<string>;
  selectedChannelId?: string;
  topics: TopicOption[];
  getByFolder: (folderPath: string) => IUploadSession | undefined;
  onToggle: (path: string) => void;
  onToggleHideFiles: (path: string) => void;
  onStartUpload: (command: {
    folderPath: string;
    channelId: string;
    existingTopicId?: string;
    newTopicName?: string;
    selectedFiles?: string[];
  }) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
};
