'use client';
import { ChevronDown, ChevronRight, Eye, EyeOff, File as FileIcon, Folder as FolderIcon } from 'lucide-react';

import { UploadControls } from './UploadControls';
import type { FolderTreeNodeProps } from './types';

export function TreeNode({
  node,
  depth,
  expanded,
  changedPaths,
  hiddenFiles,
  selectedChannelId,
  topics,
  getByFolder,
  onToggle,
  onToggleHideFiles,
  onStartUpload,
  onPause,
  onResume,
  onCancel,
}: FolderTreeNodeProps) {
  const isFolder = node.type === 'folder';
  const isOpen = isFolder && expanded.has(node.path);
  const isChanged = changedPaths.has(node.path);
  const filesHiddenHere = hiddenFiles.has(node.path);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-0.5 ${isChanged ? 'bg-amber-100/40 dark:bg-amber-900/20 rounded px-1' : ''}`}
      >
        <div style={{ width: depth * 16 }} className="flex-shrink-0" />
        {isFolder ? (
          <button
            type="button"
            onClick={() => onToggle(node.path)}
            className="inline-flex items-center justify-center size-5 rounded hover:bg-accent text-muted-foreground mr-1"
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <div className="size-5 mr-1" />
        )}

        {isFolder ? (
          <FolderIcon className="size-4 text-yellow-600 flex-shrink-0" />
        ) : (
          <FileIcon className="size-4 text-blue-600 flex-shrink-0" />
        )}

        <span className="font-medium truncate max-w-[300px]" title={node.path}>
          {node.name}
        </span>

        {typeof node.size === 'number' && !isFolder && (
          <span className="ml-auto text-muted-foreground text-xs">{formatBytes(node.size)}</span>
        )}
        {isFolder && (
          <span className="ml-auto text-muted-foreground flex items-center gap-2">
            <span className="text-xs">{node.fileCount} items</span>
            {isChanged && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100 font-bold uppercase">
                updated
              </span>
            )}
            <button
              type="button"
              onClick={() => onToggleHideFiles(node.path)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent text-muted-foreground border border-border"
              title={filesHiddenHere ? 'Show files' : 'Hide files'}
            >
              {filesHiddenHere ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              <span className="text-[10px] hidden sm:inline">{filesHiddenHere ? 'Show' : 'Hide'}</span>
            </button>
          </span>
        )}
      </div>

      {isFolder && isOpen && (
        <div className="ml-2 pl-3 border-l border-border/50">
          <UploadControls
            folderPath={node.path}
            directFiles={(node.children || []).filter(child => child.type === 'file').map(file => file.name)}
            selectedChannelId={selectedChannelId}
            topics={topics}
            activeSession={getByFolder(node.path)}
            onStartUpload={onStartUpload}
            onPause={onPause}
            onResume={onResume}
            onCancel={onCancel}
          />
          {node.children?.length
            ? node.children
                .filter(child => !(filesHiddenHere && child.type === 'file'))
                .map((child, index) => (
                  <TreeNode
                    key={`${child.path}-${index}`}
                    node={child}
                    depth={depth + 1}
                    expanded={expanded}
                    changedPaths={changedPaths}
                    hiddenFiles={hiddenFiles}
                    selectedChannelId={selectedChannelId}
                    topics={topics}
                    getByFolder={getByFolder}
                    onToggle={onToggle}
                    onToggleHideFiles={onToggleHideFiles}
                    onStartUpload={onStartUpload}
                    onPause={onPause}
                    onResume={onResume}
                    onCancel={onCancel}
                  />
                ))
            : null}
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
