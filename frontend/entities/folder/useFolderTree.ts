'use client';
import { WSEvent } from '@/types/websocket/events';
import { useEffect, useRef, useState } from 'react';

import type { IFolderTree } from './types';

import { on } from '@/shared/api/ws/events';

/**
 * useFolderTree — subscribes to folder_tree_update and stores last snapshot
 */
export function useFolderTree() {
  const [tree, setTree] = useState<IFolderTree | null>(null);
  const [changedPaths, setChangedPaths] = useState<Set<string>>(new Set());
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = on(WSEvent.FOLDER_TREE_UPDATE, payload => {
      const data = payload as unknown;
      if (Array.isArray(data)) {
        const arr = data as IFolderTree[];
        if (arr.length === 1) {
          setTree(prev => {
            const next = arr[0];
            const changed = computeFolderTreeDiff(prev, next);
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            setChangedPaths(changed);
            clearTimerRef.current = setTimeout(() => setChangedPaths(new Set()), 4000);
            return next;
          });
        } else {
          const root: IFolderTree = {
            path: '__ROOT__',
            name: 'ROOT',
            type: 'folder',
            children: arr,
            fileCount: arr.reduce((acc, t) => acc + (t.fileCount || 0), 0),
          };
          setTree(prev => {
            const changed = computeFolderTreeDiff(prev, root);
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            setChangedPaths(changed);
            clearTimerRef.current = setTimeout(() => setChangedPaths(new Set()), 4000);
            return root;
          });
        }
      } else {
        const next = data as IFolderTree;
        setTree(prev => {
          const changed = computeFolderTreeDiff(prev, next);
          if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
          setChangedPaths(changed);
          clearTimerRef.current = setTimeout(() => setChangedPaths(new Set()), 4000);
          return next;
        });
      }
    });
    return () => off();
  }, []);

  return { tree, changedPaths } as const;
}

// Helpers kept outside the hook to avoid re-creation and hook deps
function computeFolderTreeDiff(prevTree: IFolderTree | null, nextTree: IFolderTree): Set<string> {
  const prevMap = new Map<string, IFolderTree>();
  const nextMap = new Map<string, IFolderTree>();

  const walk = (n: IFolderTree, map: Map<string, IFolderTree>) => {
    map.set(n.path, n);
    n.children?.forEach(c => walk(c, map));
  };
  if (prevTree) walk(prevTree, prevMap);
  walk(nextTree, nextMap);

  const changed = new Set<string>();
  // Added and modified
  nextMap.forEach((node, path) => {
    const prev = prevMap.get(path);
    if (!prev) {
      changed.add(path);
      addParents(path, changed);
      return;
    }
    if (node.type === 'file' && prev.type === 'file') {
      const sz1 = node.size ?? 0;
      const sz0 = prev.size ?? 0;
      if (sz1 !== sz0) {
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
  // Removed (highlight parent)
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
  let p = parentPath(path);
  while (p) {
    set.add(p);
    p = parentPath(p);
  }
}
