'use client';
import { WSEvent } from '@/types/websocket/events';
import { useEffect, useRef, useState } from 'react';

import { adaptFolderTreePayload } from '../adapters/folderTreePayloadAdapter';
import type { IFolderTree } from '../types';

import { on } from '@/shared/api/ws/events';

/**
 * useFolderTree — subscribes to folder_tree_update and stores last snapshot
 */
export function useFolderTreeQuery() {
  const [tree, setTree] = useState<IFolderTree | null>(null);
  const [changedPaths, setChangedPaths] = useState<Set<string>>(new Set());
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = on(WSEvent.FOLDER_TREE_UPDATE, payload => {
      const next = adaptFolderTreePayload(payload);
      setTree(prev => {
        const changed = computeFolderTreeDiff(prev, next);
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        setChangedPaths(changed);
        clearTimerRef.current = setTimeout(() => setChangedPaths(new Set()), 4000);
        return next;
      });
    });

    return () => off();
  }, []);

  return { tree, changedPaths } as const;
}

function computeFolderTreeDiff(prevTree: IFolderTree | null, nextTree: IFolderTree): Set<string> {
  const prevMap = new Map<string, IFolderTree>();
  const nextMap = new Map<string, IFolderTree>();

  const walk = (node: IFolderTree, map: Map<string, IFolderTree>) => {
    map.set(node.path, node);
    node.children?.forEach(child => walk(child, map));
  };

  if (prevTree) walk(prevTree, prevMap);
  walk(nextTree, nextMap);

  const changed = new Set<string>();

  nextMap.forEach((node, path) => {
    const prev = prevMap.get(path);
    if (!prev) {
      changed.add(path);
      addParents(path, changed);
      return;
    }

    if (node.type === 'file' && prev.type === 'file') {
      const currentSize = node.size ?? 0;
      const previousSize = prev.size ?? 0;
      if (currentSize !== previousSize) {
        changed.add(path);
        addParents(path, changed);
      }
    }

    if (node.type === 'folder' && prev.type === 'folder') {
      if ((node.fileCount ?? 0) !== (prev.fileCount ?? 0)) {
        changed.add(path);
        addParents(path, changed);
      }
    }
  });

  prevMap.forEach((_node, path) => {
    if (!nextMap.has(path)) {
      const parent = parentPath(path);
      if (parent) changed.add(parent);
    }
  });

  return changed;
}

function parentPath(path: string): string | null {
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return null;
  return path.slice(0, idx) || '/';
}

function addParents(path: string, set: Set<string>) {
  let currentParent = parentPath(path);
  while (currentParent) {
    set.add(currentParent);
    currentParent = parentPath(currentParent);
  }
}
