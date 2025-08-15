'use client';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  File as FileIcon,
  Folder as FolderIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChannels } from '@/entities/channel/useChannels';
import type { IFolderTree } from '@/entities/folder/types';
import { useFolderTree } from '@/entities/folder/useFolderTree';
import { useTopics } from '@/entities/topic/useTopics';
import { useUploadSessions } from '@/entities/upload/useUploadSessions';
import { emit } from '@/shared/api/ws/events';

/**
 * FolderTree widget – renders current scanned folder tree snapshot from WS events.
 * Input: none (uses WS-subscription hook). Output: visual tree. Empty/null handled.
 */
export function FolderTree() {
  const { tree, changedPaths } = useFolderTree();
  const { channels, single } = useChannels();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hiddenFiles, setHiddenFiles] = useState<Set<string>>(new Set());
  const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(single?.id);
  const { topics } = useTopics(selectedChannelId);
  const { getByFolder } = useUploadSessions();

  useEffect(() => {
    if (single?.id) setSelectedChannelId(single.id);
  }, [single?.id]);

  // Ensure root is expanded when first tree arrives
  useEffect(() => {
    if (!tree) return;
    setExpanded(prev => {
      if (prev.size > 0) return prev;
      const next = new Set(prev);
      next.add(tree.path);
      return next;
    });
  }, [tree]);

  const onToggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => {
    if (!tree) return;
    const all = collectFolderPaths(tree);
    setExpanded(new Set(all));
  };

  const collapseAll = () => {
    if (!tree) return setExpanded(new Set());
    const rootOnly = new Set<string>([tree.path]);
    setExpanded(rootOnly);
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
      expanded.forEach(p => {
        if (hide) next.add(p);
        else next.delete(p);
      });
      return next;
    });
  };

  const content = useMemo(() => {
    if (!tree)
      return (
        <div className="text-sm text-muted-foreground">
          No data yet. Waiting for folder_tree_update…
        </div>
      );
    return (
      <div className="space-y-1">
        <TreeNode
          node={tree}
          depth={0}
          expanded={expanded}
          onToggle={onToggle}
          changedPaths={changedPaths}
          hiddenFiles={hiddenFiles}
          onToggleHideFiles={toggleHideFiles}
          selectedChannelId={selectedChannelId}
          topics={topics}
          getByFolder={getByFolder}
        />
      </div>
    );
  }, [tree, expanded, changedPaths, hiddenFiles, selectedChannelId, topics, getByFolder]);

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Folder Tree</CardTitle>
        <div className="flex gap-2">
          <select
            className="border rounded px-2 py-1 bg-background text-foreground disabled:opacity-60"
            value={selectedChannelId || single?.id || ''}
            onChange={e => setSelectedChannelId(e.target.value)}
            disabled={!!single}
          >
            {(single ? [single] : channels).map(c => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <Button size="sm" variant="secondary" onClick={expandAll} disabled={!tree}>
            Expand all
          </Button>
          <Button size="sm" variant="secondary" onClick={collapseAll} disabled={!tree}>
            Collapse all
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => hideFilesForExpanded(true)}
            disabled={!tree}
          >
            Hide files (expanded)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => hideFilesForExpanded(false)}
            disabled={!tree}
          >
            Show files (expanded)
          </Button>
        </div>
      </CardHeader>
      <CardContent className="max-h-96 overflow-auto text-sm">{content}</CardContent>
    </Card>
  );
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  changedPaths,
  hiddenFiles,
  onToggleHideFiles,
  selectedChannelId,
  topics,
  getByFolder,
}: {
  node: IFolderTree;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  changedPaths: Set<string>;
  hiddenFiles: Set<string>;
  onToggleHideFiles: (path: string) => void;
  selectedChannelId?: string;
  topics: Array<{ id: string; title?: string; name?: string }>;
  getByFolder: (folderPath: string) =>
    | {
        id: string;
        folderPath: string;
        topicId: string;
        status: string;
        totalFiles: number;
        uploadedFiles: number;
        currentFile?: string;
        progress: number;
        startedAt: Date;
        updatedAt: Date;
      }
    | undefined;
}) {
  const isFolder = node.type === 'folder';
  const isOpen = isFolder && expanded.has(node.path);
  const isChanged = changedPaths.has(node.path);
  const filesHiddenHere = hiddenFiles.has(node.path);

  return (
    <div>
      <div
        className={`flex items-center gap-2 ${isChanged ? 'bg-amber-100/40 dark:bg-amber-900/20 rounded px-1' : ''}`}
      >
        <span
          className="tabular-nums text-muted-foreground"
          style={{ width: depth ? depth * 12 : 0 }}
        />
        {isFolder ? (
          <button
            type="button"
            onClick={() => onToggle(node.path)}
            className="inline-flex items-center justify-center size-5 rounded hover:bg-accent text-muted-foreground"
            aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="inline-flex items-center justify-center size-5" />
        )}

        {isFolder ? (
          <FolderIcon className="size-4 text-yellow-600" />
        ) : (
          <FileIcon className="size-4 text-blue-600" />
        )}

        <span className="font-medium truncate" title={node.name}>
          {node.name}
        </span>

        {typeof node.size === 'number' && !isFolder && (
          <span className="ml-auto text-muted-foreground">{formatBytes(node.size)}</span>
        )}
        {isFolder && (
          <span className="ml-auto text-muted-foreground flex items-center gap-2">
            {node.fileCount} items
            {isChanged && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
                updated
              </span>
            )}
            <button
              type="button"
              onClick={() => onToggleHideFiles(node.path)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent text-muted-foreground border border-border"
              aria-label={filesHiddenHere ? 'Show files' : 'Hide files'}
              title={filesHiddenHere ? 'Show files' : 'Hide files'}
            >
              {filesHiddenHere ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              <span className="text-[10px]">{filesHiddenHere ? 'Show files' : 'Hide files'}</span>
            </button>
          </span>
        )}
      </div>

      {isFolder && isOpen ? (
        <div className="pl-4 border-l border-border ml-3">
          <FolderUploadControls
            folderPath={node.path}
            directFiles={(node.children || []).filter(c => c.type === 'file').map(f => f.name)}
            selectedChannelId={selectedChannelId}
            topics={topics}
            activeSession={getByFolder(node.path)}
          />
          {node.children?.length
            ? node.children
                .filter(c => (filesHiddenHere && c.type === 'file' ? false : true))
                .map((child, idx) => (
                  <TreeNode
                    key={`${child.path}-${idx}`}
                    node={child}
                    depth={depth + 1}
                    expanded={expanded}
                    onToggle={onToggle}
                    changedPaths={changedPaths}
                    hiddenFiles={hiddenFiles}
                    onToggleHideFiles={onToggleHideFiles}
                    selectedChannelId={selectedChannelId}
                    topics={topics}
                    getByFolder={getByFolder}
                  />
                ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

function FolderUploadControls({
  folderPath,
  directFiles,
  selectedChannelId,
  topics,
  activeSession,
}: {
  folderPath: string;
  directFiles: string[];
  selectedChannelId?: string;
  topics: Array<{ id: string; title?: string; name?: string }>;
  activeSession?: {
    id: string;
    folderPath: string;
    topicId: string;
    status: string;
    totalFiles: number;
    uploadedFiles: number;
    progress: number;
  };
}) {
  const [topicChoice, setTopicChoice] = useState<string>('__new__');
  const [newTopicName, setNewTopicName] = useState<string>(folderPath.split('/').pop() || 'New');
  const [useAllFiles, setUseAllFiles] = useState<boolean>(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const canStart =
    !!selectedChannelId && (topicChoice !== '__new__' || newTopicName.trim().length > 0);
  const topicOptions = useMemo(
    () => [{ id: '__new__', title: '— New topic —' }, ...topics],
    [topics]
  );

  const onToggleFile = (name: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const startUpload = () => {
    if (!selectedChannelId) return;
    const channelId = selectedChannelId;
    const base = { folderPath, channelId } as const;
    const topicPart =
      topicChoice === '__new__'
        ? { newTopicName: newTopicName.trim() }
        : { existingTopicId: topicChoice };
    const filesPart = useAllFiles ? {} : { selectedFiles: Array.from(selectedFiles) };
    // emit typed event
    emit('start_folder_upload', { ...base, ...topicPart, ...filesPart });
  };

  return (
    <div className="my-2 p-2 border rounded bg-muted/30">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="border rounded px-2 py-1 bg-background text-foreground"
          value={topicChoice}
          onChange={e => setTopicChoice(e.target.value)}
        >
          {topicOptions.map(t => (
            <option key={t.id} value={t.id}>
              {t.title || t.name}
            </option>
          ))}
        </select>
        {topicChoice === '__new__' && (
          <input
            type="text"
            className="border rounded px-2 py-1 bg-background text-foreground min-w-52"
            placeholder="New topic name"
            value={newTopicName}
            onChange={e => setNewTopicName(e.target.value)}
          />
        )}
        <label className="inline-flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={useAllFiles}
            onChange={e => setUseAllFiles(e.target.checked)}
          />
          All files
        </label>
        <Button size="sm" disabled={!canStart} onClick={startUpload}>
          Start Upload
        </Button>
        {activeSession && (
          <span className="ml-auto text-xs text-muted-foreground">
            {activeSession.uploadedFiles}/{activeSession.totalFiles} • {activeSession.progress}%
          </span>
        )}
      </div>
      {!useAllFiles && (
        <div className="mt-2 flex flex-wrap gap-2">
          {directFiles.length === 0 ? (
            <span className="text-muted-foreground">No direct files in this folder</span>
          ) : (
            directFiles.map(f => (
              <label
                key={f}
                className="inline-flex items-center gap-1 text-xs border rounded px-1 py-0.5"
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.has(f)}
                  onChange={() => onToggleFile(f)}
                />
                <span className="truncate max-w-56" title={f}>
                  {f}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function collectFolderPaths(root: IFolderTree): string[] {
  const out: string[] = [];
  const walk = (n: IFolderTree) => {
    if (n.type === 'folder') {
      out.push(n.path);
      n.children?.forEach(walk);
    }
  };
  walk(root);
  return out;
}
