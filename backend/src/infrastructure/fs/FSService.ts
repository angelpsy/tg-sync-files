import { readdir, stat } from 'fs/promises';
import { basename, join, relative } from 'path';

import chokidar from 'chokidar';

import { serviceLoggers } from '../../../../shared/logger';

import type { IFileChangeEvent, IFileInfo, IFolderTree, IFSService } from '@/types';

/**
 * Options for FSService
 */
export interface FSServiceOptions {
  /** Maximum scanning depth */
  maxDepth: number;
  /** Ignored folders (glob patterns) */
  ignoredFolders: string[];
  /** Ignored files (glob patterns) */
  ignoredFiles: string[];
  /** Paths to watch */
  watchPaths: string[];
}

/**
 * File System Service
 * Manages file system scanning and change monitoring
 */
export class FSService implements IFSService {
  private readonly logger = serviceLoggers.fs;
  private watcher?: ReturnType<typeof chokidar.watch>;
  private updateCallbacks: Array<(tree: IFolderTree[]) => void> = [];
  private fileChangeCallbacks: Array<(event: IFileChangeEvent) => void> = [];
  private cachedTree: IFolderTree[] = [];

  constructor(private readonly options: FSServiceOptions) {
    this.logger.info('FSService initialized', {
      maxDepth: options.maxDepth,
      ignoredFolders: options.ignoredFolders.length,
      ignoredFiles: options.ignoredFiles.length,
      watchPaths: options.watchPaths.length,
    });
  }

  /**
   * Scans folders and returns file tree
   */
  async scanFolders(): Promise<IFolderTree[]> {
    this.logger.info('Starting folder scan');

    try {
      const trees: IFolderTree[] = [];

      for (const path of this.options.watchPaths) {
        const tree = await this.scanDirectory(path, 0);
        if (tree) {
          trees.push(tree);
        }
      }

      this.cachedTree = trees;
      this.logger.info('Folder scan completed', {
        totalFolders: trees.length,
        totalFiles: this.countFiles(trees),
      });

      return trees;
    } catch (error) {
      this.logger.error('Error during folder scan', { error });
      throw error;
    }
  }

  /**
   * Scans single folder and returns file tree
   */
  async scanFolder(folderPath: string): Promise<IFolderTree> {
    this.logger.info('Starting single folder scan', { path: folderPath });

    try {
      const tree = await this.scanDirectory(folderPath, 0);
      if (!tree) {
        throw new Error(`Failed to scan folder: ${folderPath}`);
      }

      this.logger.info('Single folder scan completed', {
        path: folderPath,
        fileCount: tree.fileCount,
      });

      return tree;
    } catch (error) {
      this.logger.error('Error during single folder scan', { path: folderPath, error });
      throw error;
    }
  }

  /**
   * Starts monitoring changes in folders
   */
  async watchFolder(
    folderPath: string,
    callback?: (event: IFileChangeEvent) => void
  ): Promise<void> {
    if (callback) {
      this.fileChangeCallbacks.push(callback);
    }

    if (this.watcher) {
      this.watcher.add(folderPath);
      this.logger.info('Added path to existing watcher', { path: folderPath });
      return;
    }

    this.logger.info('Starting file watcher', { path: folderPath });

    this.watcher = chokidar.watch(folderPath, {
      // Ignore configured patterns + system .DS_Store files
      ignored: [...this.options.ignoredFolders, ...this.options.ignoredFiles, '**/.DS_Store'],
      persistent: true,
      ignoreInitial: true,
      depth: this.options.maxDepth,
    });

    this.setupWatcherEvents();
  }

  /**
   * Stops watching folder
   */
  async unwatchFolder(folderPath: string): Promise<void> {
    if (this.watcher) {
      this.watcher.unwatch(folderPath);
      this.logger.info('Removed path from watcher', { path: folderPath });
    }
  }

  /**
   * Stops monitoring changes
   */
  stopWatching(): void {
    if (this.watcher) {
      this.logger.info('Stopping file watcher');
      this.watcher.close();
      this.watcher = undefined;
    }
  }

  /**
   * Subscribes to file system update events
   */
  onUpdate(callback: (tree: IFolderTree[]) => void): void {
    this.updateCallbacks.push(callback);
    this.logger.debug('Added update callback', {
      totalCallbacks: this.updateCallbacks.length,
    });
  }

  /**
   * Forces scan on demand
   */
  async forceScan(): Promise<IFolderTree[]> {
    this.logger.info('Force scan requested');
    const tree = await this.scanFolders();
    this.notifyUpdate(tree);
    return tree;
  }

  /**
   * Gets file information
   */
  async getFileInfo(filePath: string): Promise<IFileInfo> {
    const stats = await stat(filePath);
    const { fileTypeFromFile } = await import('file-type');
    const fileType = await fileTypeFromFile(filePath);

    // Create simple hash from path and modification time
    const crypto = await import('crypto');
    const hash = crypto
      .createHash('md5')
      .update(`${filePath}-${stats.mtime.getTime()}`)
      .digest('hex');

    return {
      id: hash, // Using hash as ID
      path: filePath,
      name: filePath.split('/').pop() || '',
      size: stats.size,
      mimeType: fileType?.mime || 'application/octet-stream',
      hash,
      createdAt: stats.birthtime,
      updatedAt: stats.mtime,
    };
  }

  /**
   * Validates file path
   */
  async validatePath(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets folder statistics
   */
  async getFolderStats(folderPath: string): Promise<{
    totalFiles: number;
    totalSize: number;
    lastModified: Date;
  }> {
    const tree = await this.scanFolder(folderPath);
    const stats = await this.calculateTreeStats(tree);
    return stats;
  }

  /**
   * Recursively scans directory
   */
  private async scanDirectory(
    dirPath: string,
    currentDepth: number,
    basePath?: string
  ): Promise<IFolderTree | null> {
    if (currentDepth > this.options.maxDepth) {
      return null;
    }

    try {
      const stats = await stat(dirPath);

      if (!stats.isDirectory()) {
        return {
          path: dirPath,
          name: dirPath.split('/').pop() || '',
          type: 'file',
          size: stats.size,
          fileCount: 1,
        };
      }

      const entries = await readdir(dirPath);
      const children: IFolderTree[] = [];
      let totalFileCount = 0;

      for (const entry of entries) {
        const fullPath = join(dirPath, entry);

        // Проверяем, не игнорируется ли путь
        if (this.shouldIgnore(fullPath, basePath || dirPath)) {
          continue;
        }

        const child = await this.scanDirectory(fullPath, currentDepth + 1, basePath || dirPath);
        if (child) {
          children.push(child);
          totalFileCount += child.fileCount;
        }
      }

      return {
        path: dirPath,
        name: dirPath.split('/').pop() || '',
        type: 'folder',
        children: children.length > 0 ? children : undefined,
        fileCount: totalFileCount,
      };
    } catch (error) {
      this.logger.warn('Error scanning directory', {
        path: dirPath,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Проверяет, нужно ли игнорировать путь
   */
  private shouldIgnore(fullPath: string, basePath: string): boolean {
    const relativePath = relative(basePath, fullPath);

    // Always ignore macOS Finder metadata files
    if (basename(fullPath) === '.DS_Store' || relativePath.endsWith('/.DS_Store')) {
      return true;
    }

    // Проверяем игнорируемые папки и файлы
    for (const pattern of [...this.options.ignoredFolders, ...this.options.ignoredFiles]) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Простая проверка соответствия паттерну
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Простая реализация glob-like паттернов
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Подсчитывает общее количество файлов в дереве
   */
  private countFiles(trees: IFolderTree[]): number {
    return trees.reduce((total, tree) => total + tree.fileCount, 0);
  }

  /**
   * Calculates statistics for a folder tree
   */
  private async calculateTreeStats(tree: IFolderTree): Promise<{
    totalFiles: number;
    totalSize: number;
    lastModified: Date;
  }> {
    let totalFiles = 0;
    let totalSize = 0;
    let lastModified = new Date(0);

    const processTree = async (node: IFolderTree): Promise<void> => {
      if (node.type === 'file') {
        totalFiles++;
        totalSize += node.size || 0;

        // Get file stats for last modified date
        try {
          const stats = await stat(node.path);
          if (stats.mtime > lastModified) {
            lastModified = stats.mtime;
          }
        } catch {
          // Ignore stat errors
        }
      } else if (node.children) {
        for (const child of node.children) {
          await processTree(child);
        }
      }
    };

    await processTree(tree);

    return {
      totalFiles,
      totalSize,
      lastModified,
    };
  }

  /**
   * Настраивает обработчики событий watcher
   */
  private setupWatcherEvents(): void {
    if (!this.watcher) return;

    this.watcher
      .on('add', (path: string) => {
        this.logger.debug('File added', { path });
        this.notifyFileChange({
          id: this.generateEventId(),
          path,
          type: 'created',
          timestamp: new Date(),
        });
        this.scheduleUpdate();
      })
      .on('change', (path: string) => {
        this.logger.debug('File changed', { path });
        this.notifyFileChange({
          id: this.generateEventId(),
          path,
          type: 'modified',
          timestamp: new Date(),
        });
        this.scheduleUpdate();
      })
      .on('unlink', (path: string) => {
        this.logger.debug('File removed', { path });
        this.notifyFileChange({
          id: this.generateEventId(),
          path,
          type: 'deleted',
          timestamp: new Date(),
        });
        this.scheduleUpdate();
      })
      .on('addDir', (path: string) => {
        this.logger.debug('Directory added', { path });
        this.scheduleUpdate();
      })
      .on('unlinkDir', (path: string) => {
        this.logger.debug('Directory removed', { path });
        this.scheduleUpdate();
      })
      .on('error', (err: unknown) => {
        this.logger.error('Watcher error', { error: err });
      });
  }

  /**
   * Generates unique event ID
   */
  private generateEventId(): string {
    return `fs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notifies file change callbacks
   */
  private notifyFileChange(event: IFileChangeEvent): void {
    this.fileChangeCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Error in file change callback', { error });
      }
    });
  }

  /**
   * Планирует обновление дерева (debounced)
   */
  private updateTimer?: NodeJS.Timeout;
  private scheduleUpdate(): void {
    // Debounce: ждем 500ms после последнего изменения
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    this.updateTimer = setTimeout(async () => {
      try {
        const tree = await this.scanFolders();
        this.notifyUpdate(tree);
      } catch (error) {
        this.logger.error('Error during scheduled update', { error });
      }
    }, 500);
  }

  /**
   * Уведомляет подписчиков об обновлении
   */
  private notifyUpdate(tree: IFolderTree[]): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(tree);
      } catch (error) {
        this.logger.error('Error in update callback', { error });
      }
    });
  }
}
