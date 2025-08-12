'use client';
import { useEffect, useState } from 'react';

import type { IFolderTree } from './types';

import { on } from '@/shared/api/ws/events';

/**
 * useFolderTree — subscribes to folder_tree_update and stores last snapshot
 */
export function useFolderTree() {
  const [tree, setTree] = useState<IFolderTree | null>(null);

  useEffect(() => {
    const off = on('folder_tree_update', payload => setTree(payload as IFolderTree));
    return () => off();
  }, []);

  return { tree } as const;
}
