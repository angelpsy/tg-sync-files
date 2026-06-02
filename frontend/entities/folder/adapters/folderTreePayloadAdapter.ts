import type { IFolderTree } from '@/entities/folder/types';

export function adaptFolderTreePayload(payload: unknown): IFolderTree {
  if (Array.isArray(payload)) {
    const forest = payload.filter(isFolderTreeNode);
    if (forest.length === 1) return forest[0];

    return {
      path: '__ROOT__',
      name: 'ROOT',
      type: 'folder',
      children: forest,
      fileCount: forest.reduce((acc, node) => acc + (node.fileCount || 0), 0),
    };
  }

  if (isFolderTreeNode(payload)) return payload;

  return {
    path: '__ROOT__',
    name: 'ROOT',
    type: 'folder',
    children: [],
    fileCount: 0,
  };
}

function isFolderTreeNode(value: unknown): value is IFolderTree {
  if (!value || typeof value !== 'object') return false;

  const path = Reflect.get(value, 'path');
  const name = Reflect.get(value, 'name');
  const type = Reflect.get(value, 'type');
  const fileCount = Reflect.get(value, 'fileCount');

  return (
    typeof path === 'string' &&
    typeof name === 'string' &&
    (type === 'file' || type === 'folder') &&
    typeof fileCount === 'number'
  );
}
