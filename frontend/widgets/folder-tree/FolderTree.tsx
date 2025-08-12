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
import type { IFolderTree } from '@/entities/folder/types';
import { useFolderTree } from '@/entities/folder/useFolderTree';

/**
 * FolderTree widget – renders current scanned folder tree snapshot from WS events.
 * Input: none (uses WS-subscription hook). Output: visual tree. Empty/null handled.
 */
export function FolderTree() {
  const { tree, changedPaths } = useFolderTree();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hiddenFiles, setHiddenFiles] = useState<Set<string>>(new Set());

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
        />
      </div>
    );
  }, [tree, expanded, changedPaths, hiddenFiles]);

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Folder Tree</CardTitle>
        <div className="flex gap-2">
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
}: {
  node: IFolderTree;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  changedPaths: Set<string>;
  hiddenFiles: Set<string>;
  onToggleHideFiles: (path: string) => void;
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

      {isFolder && isOpen && node.children?.length ? (
        <div className="pl-4 border-l border-border ml-3">
          {node.children
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
              />
            ))}
        </div>
      ) : null}
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
