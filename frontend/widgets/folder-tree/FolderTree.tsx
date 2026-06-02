'use client';
import { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChannelsQuery, usePersistedChannelSelectionQuery } from '@/entities/channel';
import type { IFolderTree } from '@/entities/folder/types';
import { useFolderTreeQuery } from '@/entities/folder';
import { useTopicsQuery } from '@/entities/topic';
import { startFolderUpload, useUploadSessionsQuery } from '@/entities/upload';

import { TreeNode, TreeToolbar } from './components';

/**
 * FolderTree widget – renders current scanned folder tree snapshot from WS events.
 */
export function FolderTree() {
  const { tree, changedPaths } = useFolderTreeQuery();
  const { channels, single } = useChannelsQuery();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hiddenFiles, setHiddenFiles] = useState<Set<string>>(new Set());
  const { selectedChannelId, setSelectedChannelId } = usePersistedChannelSelectionQuery(
    channels,
    single
  );
  const { topics } = useTopicsQuery(selectedChannelId);
  const { getByFolder, pause, resume, cancel } = useUploadSessionsQuery();

  useEffect(() => {
    if (!tree) return;
    setExpanded(prev => {
      if (prev.size > 0) return prev;
      const next = new Set(prev);
      next.add(tree.path);
      return next;
    });
  }, [tree]);

  const toggleNode = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => {
    if (!tree) return;
    setExpanded(new Set(collectFolderPaths(tree)));
  };

  const collapseAll = () => {
    if (!tree) {
      setExpanded(new Set());
      return;
    }
    setExpanded(new Set<string>([tree.path]));
  };

  const toggleHideFiles = (path: string) => {
    setHiddenFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const hideFilesForExpanded = (hide: boolean) => {
    setHiddenFiles(prev => {
      const next = new Set(prev);
      expanded.forEach(path => {
        if (hide) next.add(path);
        else next.delete(path);
      });
      return next;
    });
  };

  const content = useMemo(() => {
    if (!tree) {
      return (
        <div className="text-sm text-muted-foreground">No data yet. Waiting for folder_tree_update…</div>
      );
    }

    return (
      <div className="space-y-1">
        <TreeNode
          node={tree}
          depth={0}
          expanded={expanded}
          changedPaths={changedPaths}
          hiddenFiles={hiddenFiles}
          selectedChannelId={selectedChannelId}
          topics={topics}
          getByFolder={getByFolder}
          onToggle={toggleNode}
          onToggleHideFiles={toggleHideFiles}
          onStartUpload={startFolderUpload}
          onPause={pause}
          onResume={resume}
          onCancel={cancel}
        />
      </div>
    );
  }, [
    tree,
    expanded,
    changedPaths,
    hiddenFiles,
    selectedChannelId,
    topics,
    getByFolder,
    pause,
    resume,
    cancel,
  ]);

  return (
    <Card className="h-[calc(50vh-5.5rem)] min-h-[260px] flex flex-col">
      <CardHeader className="py-3 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base flex-shrink-0">Folder Tree</CardTitle>
        <TreeToolbar
          channels={channels}
          singleChannel={single}
          selectedChannelId={selectedChannelId || single?.id || ''}
          treeLoaded={!!tree}
          onSelectChannel={setSelectedChannelId}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          onHideFiles={() => hideFilesForExpanded(true)}
          onShowFiles={() => hideFilesForExpanded(false)}
        />
      </CardHeader>
      <CardContent className="overflow-auto text-sm">{content}</CardContent>
    </Card>
  );
}

function collectFolderPaths(root: IFolderTree): string[] {
  const out: string[] = [];
  const walk = (node: IFolderTree) => {
    if (node.type === 'folder') {
      out.push(node.path);
      node.children?.forEach(walk);
    }
  };
  walk(root);
  return out;
}
