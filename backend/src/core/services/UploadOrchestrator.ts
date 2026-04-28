import { createHash, randomUUID } from 'crypto';
import { readdir, stat } from 'fs/promises';
import { join, parse } from 'path';

import { serviceLoggers } from '../../../../shared/logger.mts';
import type { ISchedulerService, IStorageService } from '../../../../types/common/index.js';
import type {
  IFSService,
  IFileInfo,
  IFileRecord,
  ISyncDiffResult,
  ITopicFileInfo,
  IUploadOrchestrator,
  IUploadProgress,
  IUploadResult,
  IUploadSession,
  TFileHashStrategy,
  TUploadConflictPolicy,
} from '../../../../types/file-sync/index.js';
import * as FileSyncTypes from '../../../../types/file-sync/index.js';
import type { ITelegramService } from '../../../../types/telegram/index.js';
import type { ISocketService } from '../../../../types/websocket/index.js';
const { EFileHashStrategy, EUploadConflictPolicy, EUploadStatus } = FileSyncTypes;

interface UploadOrchestratorOptions {
  maxParallelUploads: number; // currently 1
  persistIntervalMs: number; // 60000
}

/**
 * UploadOrchestrator – orchestrates one-way folder → Telegram topic uploads.
 * (Formerly SyncService; renamed to avoid implying full bi-directional sync.)
 * Sequential uploads (maxParallelUploads = 1) with in-memory session tracking.
 * Persistence every persistIntervalMs via injected ISchedulerService.
 */
interface InternalSession extends IUploadSession {
  failedFiles: string[];
  channelId: string;
  conflictPolicy: TUploadConflictPolicy;
  hashStrategy: TFileHashStrategy;
  realUploaded: number; // count of actually transferred files
  skipped: number; // count of logically satisfied skips (remote duplicate / unchanged)
  conflictsSkipped: number; // conflicts handled by skipping
  conflictsRenamed: number; // conflicts handled by renaming
  conflictsLogged: number; // conflicts only logged (LOG_ONLY)
}

export class UploadOrchestrator implements IUploadOrchestrator {
  private readonly logger = serviceLoggers.upload;
  private sessions = new Map<string, InternalSession>();
  private options: UploadOrchestratorOptions;
  private persistTimer?: NodeJS.Timeout;
  private persistenceTaskId = 'upload-session-persist';
  private lastPersisted = new Map<string, Date>();
  private persistenceScheduled = false;
  private fingerprintCache = new Map<string, { size: number; mtimeMs: number; hash?: string }>();

  constructor(
    private readonly fsService: IFSService,
    private readonly telegramService: ITelegramService,
    private readonly storageService: IStorageService,
    private readonly scheduler: ISchedulerService,
    private readonly socketService: ISocketService | undefined,
    opts?: Partial<UploadOrchestratorOptions>
  ) {
    this.options = {
      maxParallelUploads: 1,
      persistIntervalMs: 60_000,
      ...opts,
    };
    this.logger.info('UploadOrchestrator initialized', { options: this.options });
  }

  /** Uploads folder to topic (blocking until completion) */
  async uploadFolderToTopic(
    folderPath: string,
    channelId: string,
    topicId: string
  ): Promise<IUploadResult> {
    const session = await this.startUpload(folderPath, channelId, topicId);
    await this.executeSession(session.id);
    return this.toResult(session.id);
  }

  /** Starts upload session (deferred execution) */
  async startUpload(
    folderPath: string,
    channelId: string,
    topicId: string,
    opts?: {
      conflictPolicy?: TUploadConflictPolicy;
      hashStrategy?: TFileHashStrategy;
      selectedFiles?: string[];
    }
  ): Promise<IUploadSession> {
    const files = await this.collectFiles(folderPath, opts?.selectedFiles);
    const sessionId = randomUUID();
    type ExtendedSession = InternalSession;
    const session: ExtendedSession = {
      id: sessionId,
      folderPath,
      topicId,
      channelId,
      status: EUploadStatus.PENDING,
      totalFiles: files.length,
      uploadedFiles: 0,
      currentFile: undefined,
      progress: 0,
      startedAt: new Date(),
      updatedAt: new Date(),
      failedFiles: [],
      conflictPolicy: opts?.conflictPolicy || EUploadConflictPolicy.SKIP,
      hashStrategy: opts?.hashStrategy || EFileHashStrategy.NONE,
      realUploaded: 0,
      skipped: 0,
      conflictsSkipped: 0,
      conflictsRenamed: 0,
      conflictsLogged: 0,
    };
    this.sessions.set(sessionId, session);
    this.logger.info('Upload session started', {
      sessionId,
      files: files.length,
      conflictPolicy: session.conflictPolicy,
      hashStrategy: session.hashStrategy,
    });
    this.socketService?.emit('upload_start', {
      uploadId: sessionId,
      folderPath,
      topicId,
      totalFiles: session.totalFiles,
      timestamp: Date.now(),
    });
    this.socketService?.emit('upload_progress', {
      uploadId: sessionId,
      fileName: '',
      fileIndex: 0,
      totalFiles: session.totalFiles,
      uploadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      eta: 0,
    });
    this.ensurePersistenceLoop();
    if (this.options.maxParallelUploads === 1) {
      void this.executeSession(sessionId).catch(err => {
        this.logger.error('Async session execution failed', { sessionId, error: err });
      });
    }
    return session;
  }

  /** Pauses upload session */
  async pauseUpload(sessionId: string): Promise<void> {
    const s = this.getSession(sessionId);
    if (s.status === EUploadStatus.UPLOADING) {
      s.status = EUploadStatus.PAUSED;
      s.updatedAt = new Date();
    }
  }

  /** Resumes upload session */
  async resumeUpload(sessionId: string): Promise<void> {
    const s = this.getSession(sessionId);
    if (s.status === EUploadStatus.PAUSED) {
      s.status = EUploadStatus.UPLOADING;
      s.updatedAt = new Date();
      void this.executeSession(sessionId).catch(err => {
        this.logger.error('Resume execution failed', { sessionId, error: err });
      });
    }
  }

  /** Cancels upload session */
  async cancelUpload(sessionId: string): Promise<void> {
    const s = this.getSession(sessionId);
    if (
      s.status === EUploadStatus.PENDING ||
      s.status === EUploadStatus.UPLOADING ||
      s.status === EUploadStatus.PAUSED
    ) {
      s.status = EUploadStatus.FAILED;
      s.error = 'Cancelled';
      s.updatedAt = new Date();
      s.completedAt = new Date();
    }
  }

  /** Gets upload progress */
  async getUploadProgress(sessionId: string): Promise<IUploadProgress> {
    const s = this.getSession(sessionId);
    return {
      uploadId: s.id,
      fileName: s.currentFile || '',
      fileIndex: s.uploadedFiles,
      totalFiles: s.totalFiles,
      uploadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      eta: 0,
    };
  }

  /** Gets upload result */
  async getUploadResult(sessionId: string): Promise<IUploadResult> {
    return this.toResult(sessionId);
  }

  /** Synchronizes folder with topic (incremental placeholder) */
  async syncFolder(linkId: string): Promise<ISyncDiffResult> {
    const topicId = linkId;
    const sessions = Array.from(this.sessions.values()).filter(s => s.topicId === topicId);
    const folderPath = sessions[0]?.folderPath;
    const sessionRef = sessions[0];
    const hashStrategy: TFileHashStrategy = sessionRef?.hashStrategy || EFileHashStrategy.NONE;
    if (!folderPath) {
      this.logger.warn('syncFolder could not resolve folderPath (no session cached)', { topicId });
      return {
        topicId,
        folderPath: '',
        newFiles: [],
        updatedFiles: [],
        removedFiles: [],
        unchangedFiles: [],
        timestamp: Date.now(),
      };
    }
    if (sessions.some(s => s.status === EUploadStatus.UPLOADING)) {
      this.logger.info('syncFolder skipped: active upload in progress', { topicId });
      return {
        topicId,
        folderPath,
        newFiles: [],
        updatedFiles: [],
        removedFiles: [],
        unchangedFiles: [],
        timestamp: Date.now(),
      };
    }
    try {
      const localFiles = await this.collectFiles(folderPath);
      const localMap = new Map(localFiles.map(f => [f.name, f]));
      let records: IFileRecord[] = [];
      try {
        records = await this.storageService.getTopicFileRecords(topicId);
      } catch (err) {
        this.logger.warn('getTopicFileRecords failed', { topicId, error: err });
      }
      const recordMap = new Map(records.map(r => [r.fileName, r]));
      const newFiles: string[] = [];
      const updatedFiles: string[] = [];
      const removedFiles: string[] = [];
      const unchangedFiles: string[] = [];
      let remoteList: { name?: string }[] = [];
      try {
        remoteList = await this.telegramService.listTopicFiles(sessions[0].channelId, topicId);
      } catch (err) {
        this.logger.warn('syncFolder remote list failed (non-fatal)', { topicId, error: err });
      }
      const remoteNames = new Set(remoteList.map(r => r.name).filter((n): n is string => !!n));

      for (const file of localFiles) {
        const rec = recordMap.get(file.name);
        if (!rec) {
          newFiles.push(file.name);
          continue;
        }
        if (rec.size !== file.size || rec.mtimeMs !== file.updatedAt.getTime()) {
          updatedFiles.push(file.name);
        } else {
          unchangedFiles.push(file.name);
        }
      }
      for (const rec of records) {
        if (!localMap.has(rec.fileName)) removedFiles.push(rec.fileName);
      }
      const remoteOnlyFiles: string[] = [];
      for (const rn of remoteNames) {
        if (!localMap.has(rn) && !recordMap.has(rn)) remoteOnlyFiles.push(rn);
      }

      for (const name of [...newFiles, ...updatedFiles]) {
        const file = localMap.get(name);
        if (!file) continue;
        try {
          const fp = await this.buildFingerprint(
            file,
            hashStrategy,
            hashStrategy === EFileHashStrategy.EAGER || hashStrategy === EFileHashStrategy.ON_DEMAND
          );
          await this.telegramService.uploadFile(file, topicId, sessions[0].channelId);
          try {
            await this.storageService.upsertFileRecord({
              id: `${topicId}:${file.name}`,
              folderPath,
              topicId,
              fileName: file.name,
              size: fp.size,
              mtimeMs: fp.mtimeMs,
              hash: fp.hash,
              uploadedAt: new Date(),
              updatedAt: new Date(),
            });
          } catch (e) {
            this.logger.error('upsertFileRecord failed (syncFolder)', {
              file: file.name,
              error: e,
            });
          }
        } catch (err) {
          this.logger.error('syncFolder upload failed', { file: file?.name, error: err });
        }
      }

      if (hashStrategy !== EFileHashStrategy.NONE) {
        for (let i = 0; i < updatedFiles.length; i++) {
          const fname = updatedFiles[i];
          const rec = recordMap.get(fname);
          if (!rec) continue;
          const file = localMap.get(fname);
          if (!file) continue;
          try {
            const fp = await this.buildFingerprint(
              file,
              hashStrategy,
              hashStrategy === EFileHashStrategy.EAGER ||
                hashStrategy === EFileHashStrategy.ON_DEMAND
            );
            if (rec.hash && fp.hash && rec.hash === fp.hash && rec.size === fp.size) {
              unchangedFiles.push(fname);
              updatedFiles.splice(i, 1);
              i--;
            }
          } catch (e) {
            this.logger.warn('hash refinement failed', { file: fname, error: e });
          }
        }
      }

      const diff: ISyncDiffResult = {
        topicId,
        folderPath,
        newFiles,
        updatedFiles,
        removedFiles,
        unchangedFiles,
        remoteOnlyFiles,
        timestamp: Date.now(),
      };
      this.logger.info('syncFolder diff result', {
        diffSummary: {
          new: newFiles.length,
          updated: updatedFiles.length,
          removed: removedFiles.length,
          unchanged: unchangedFiles.length,
        },
      });
      this.socketService?.emit('sync_diff', diff);
      return diff;
    } catch (err) {
      this.logger.error('syncFolder failed', { topicId, error: err });
      return {
        topicId,
        folderPath: folderPath || '',
        newFiles: [],
        updatedFiles: [],
        removedFiles: [],
        unchangedFiles: [],
        timestamp: Date.now(),
      };
    }
  }

  /** Checks duplicates by file name inside a topic (local + remote) */
  async checkDuplicates(folderPath: string, channelId: string, topicId: string): Promise<boolean> {
    const files = await this.collectFiles(folderPath);
    const localNames = new Set<string>();
    for (const f of files) {
      if (localNames.has(f.name)) return true;
      localNames.add(f.name);
    }
    try {
      const remote = await this.telegramService.listTopicFiles(channelId, topicId);
      const remoteNames = new Set(remote.map(r => r.name).filter(Boolean) as string[]);
      for (const f of files) {
        if (remoteNames.has(f.name)) return true;
      }
    } catch (err) {
      this.logger.warn('Remote duplicate check failed (continuing with local only)', {
        error: err,
      });
    }
    return false;
  }

  private getSession(sessionId: string): InternalSession {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`Upload session ${sessionId} not found`);
    return s;
  }

  private async executeSession(sessionId: string): Promise<void> {
    const s = this.getSession(sessionId);
    if (s.status === EUploadStatus.COMPLETED || s.status === EUploadStatus.FAILED) return;
    if (s.status === EUploadStatus.PAUSED) return;

    s.status = EUploadStatus.UPLOADING;
    s.updatedAt = new Date();

    try {
      const files = await this.collectFiles(s.folderPath);
      let remoteNames: Set<string> | null = null;
      try {
        const remote = await this.telegramService.listTopicFiles(s.channelId, s.topicId);
        remoteNames = new Set(remote.map(r => r.name).filter(Boolean) as string[]);
      } catch (err) {
        this.logger.warn('Could not fetch remote file list; proceeding without skip optimization', {
          sessionId,
          error: err,
        });
      }
      for (const file of files) {
        if (s.status !== EUploadStatus.UPLOADING) break;
        if (remoteNames && remoteNames.has(file.name)) {
          if (s.conflictPolicy === EUploadConflictPolicy.SKIP) {
            this.logger.info('Skipping already present remote file (policy=SKIP)', {
              file: file.name,
            });
            s.conflictsSkipped += 1;
            s.uploadedFiles += 1;
            s.skipped += 1;
            s.progress = Math.round((s.uploadedFiles / s.totalFiles) * 100);
            this.socketService?.emit('upload_progress', {
              uploadId: s.id,
              fileName: file.name,
              fileIndex: s.uploadedFiles,
              totalFiles: s.totalFiles,
              uploadedBytes: 0,
              totalBytes: 0,
              speed: 0,
              eta: 0,
            });
            this.socketService?.emit('upload_file_event', {
              uploadId: s.id,
              topicId: s.topicId,
              fileName: file.name,
              action: 'skipped',
              reason: 'remote_duplicate',
              index: s.uploadedFiles,
              totalFiles: s.totalFiles,
              timestamp: Date.now(),
            });
            continue;
          } else if (s.conflictPolicy === EUploadConflictPolicy.RENAME) {
            const originalName = file.name;
            let candidateName = originalName;
            const { name: base, ext } = parse(originalName);
            let counter = 1;
            while (remoteNames.has(candidateName)) {
              candidateName = ext ? `${base} (${counter})${ext}` : `${base} (${counter})`;
              counter += 1;
            }
            this.logger.info('Renaming file due to conflict', {
              from: originalName,
              to: candidateName,
            });
            s.conflictsRenamed += 1;
            (file as unknown as { name: string; originalName?: string }).originalName =
              originalName;
            (file as unknown as { name: string }).name = candidateName;
            this.socketService?.emit('upload_file_event', {
              uploadId: s.id,
              topicId: s.topicId,
              fileName: candidateName,
              originalName,
              action: 'renamed',
              reason: 'conflict',
              index: s.uploadedFiles,
              totalFiles: s.totalFiles,
              timestamp: Date.now(),
            });
          } else if (s.conflictPolicy === EUploadConflictPolicy.LOG_ONLY) {
            this.logger.warn('Conflict detected but uploading anyway (policy=LOG_ONLY)', {
              file: file.name,
            });
            s.conflictsLogged += 1;
          }
        }
        let existing: IFileRecord | null = null;
        try {
          existing = await this.storageService.getFileRecord(s.topicId, file.name);
        } catch (e) {
          this.logger.warn('getFileRecord failed', { file: file.name, error: e });
        }
        const quickFingerprint = await this.buildFingerprint(file, s.hashStrategy, false);
        if (
          existing &&
          existing.size === quickFingerprint.size &&
          existing.mtimeMs === quickFingerprint.mtimeMs
        ) {
          this.logger.info('Skipping unchanged file (fingerprint match)', { file: file.name });
          s.uploadedFiles += 1;
          s.skipped += 1;
          s.progress = Math.round((s.uploadedFiles / s.totalFiles) * 100);
          try {
            await this.storageService.saveUploadSession({
              id: s.id,
              folderPath: s.folderPath,
              topicId: s.topicId,
              status: s.status,
              totalFiles: s.totalFiles,
              uploadedFiles: s.uploadedFiles,
              currentFile: s.currentFile,
              progress: s.progress,
              startedAt: s.startedAt,
              updatedAt: new Date(),
              completedAt: s.completedAt,
              error: s.error,
              realUploadedFiles: s.realUploaded,
              skippedFilesCount: s.skipped,
              conflictsSkipped: s.conflictsSkipped,
              conflictsRenamed: s.conflictsRenamed,
              conflictsLogged: s.conflictsLogged,
            });
          } catch (persistErr) {
            this.logger.debug('Skip persist failed (non-fatal)', {
              sessionId: s.id,
              error: persistErr,
            });
          }
          this.socketService?.emit('upload_progress', {
            uploadId: s.id,
            fileName: file.name,
            fileIndex: s.uploadedFiles,
            totalFiles: s.totalFiles,
            uploadedBytes: 0,
            totalBytes: 0,
            speed: 0,
            eta: 0,
          });
          this.socketService?.emit('upload_file_event', {
            uploadId: s.id,
            topicId: s.topicId,
            fileName: file.name,
            action: 'skipped',
            reason: 'unchanged',
            index: s.uploadedFiles,
            totalFiles: s.totalFiles,
            timestamp: Date.now(),
          });
          continue;
        }
        const fullFingerprint = await this.buildFingerprint(
          file,
          s.hashStrategy,
          s.hashStrategy === EFileHashStrategy.EAGER ||
            s.hashStrategy === EFileHashStrategy.ON_DEMAND
        );
        s.currentFile = file.name;
        s.updatedAt = new Date();
        this.socketService?.emit('upload_progress', {
          uploadId: s.id,
          fileName: file.name,
          fileIndex: s.uploadedFiles,
          totalFiles: s.totalFiles,
          uploadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          eta: 0,
        });
        try {
          await this.telegramService.uploadFile(file, s.topicId, s.channelId);
          s.uploadedFiles += 1;
          s.realUploaded += 1;
          s.progress = Math.round((s.uploadedFiles / s.totalFiles) * 100);
          try {
            await this.storageService.saveUploadSession({
              id: s.id,
              folderPath: s.folderPath,
              topicId: s.topicId,
              status: s.status,
              totalFiles: s.totalFiles,
              uploadedFiles: s.uploadedFiles,
              currentFile: s.currentFile,
              progress: s.progress,
              startedAt: s.startedAt,
              updatedAt: new Date(),
              completedAt: s.completedAt,
              error: s.error,
              realUploadedFiles: s.realUploaded,
              skippedFilesCount: s.skipped,
              conflictsSkipped: s.conflictsSkipped,
              conflictsRenamed: s.conflictsRenamed,
              conflictsLogged: s.conflictsLogged,
            });
          } catch (persistErr) {
            this.logger.debug('Upload persist failed (non-fatal)', {
              sessionId: s.id,
              error: persistErr,
            });
          }
          try {
            await this.storageService.upsertFileRecord({
              id: `${s.topicId}:${file.name}`,
              folderPath: s.folderPath,
              topicId: s.topicId,
              fileName: file.name,
              size: fullFingerprint.size,
              mtimeMs: fullFingerprint.mtimeMs,
              hash: fullFingerprint.hash,
              uploadedAt: new Date(),
              updatedAt: new Date(),
            });
          } catch (e) {
            this.logger.error('upsertFileRecord failed', { file: file.name, error: e });
          }
          this.socketService?.emit('upload_progress', {
            uploadId: s.id,
            fileName: file.name,
            fileIndex: s.uploadedFiles,
            totalFiles: s.totalFiles,
            uploadedBytes: 0,
            totalBytes: 0,
            speed: 0,
            eta: 0,
          });
          this.socketService?.emit('upload_file_event', {
            uploadId: s.id,
            topicId: s.topicId,
            fileName: file.name,
            action: 'uploaded',
            index: s.uploadedFiles,
            totalFiles: s.totalFiles,
            timestamp: Date.now(),
          });
        } catch (err) {
          s.failedFiles.push(file.name);
          this.logger.error('File upload failed', { file: file.name, error: err });
          this.socketService?.emit('upload_progress', {
            uploadId: s.id,
            fileName: file.name,
            fileIndex: s.uploadedFiles,
            totalFiles: s.totalFiles,
            uploadedBytes: 0,
            totalBytes: 0,
            speed: 0,
            eta: 0,
          });
          this.socketService?.emit('upload_file_event', {
            uploadId: s.id,
            topicId: s.topicId,
            fileName: file.name,
            action: 'failed',
            reason: 'error',
            index: s.uploadedFiles,
            totalFiles: s.totalFiles,
            error: (err as Error).message,
            timestamp: Date.now(),
          });
        }
      }
      if (s.status === EUploadStatus.UPLOADING) {
        if (s.failedFiles.length === 0) {
          s.status = EUploadStatus.COMPLETED;
        } else {
          if (s.uploadedFiles > 0) {
            s.status = EUploadStatus.PARTIAL;
          } else {
            s.status = EUploadStatus.FAILED;
          }
        }
        s.completedAt = new Date();
        this.socketService?.emit('upload_complete', {
          uploadId: s.id,
          topicId: s.topicId,
          totalFiles: s.totalFiles,
          uploadedFiles: s.uploadedFiles,
          failedFiles: s.failedFiles.length,
          hasFailures: s.failedFiles.length > 0,
          durationMs: s.startedAt ? Date.now() - s.startedAt.getTime() : 0,
          timestamp: Date.now(),
          realUploadedFiles: s.realUploaded,
          skippedFilesCount: s.skipped,
          conflictsSkipped: s.conflictsSkipped,
          conflictsRenamed: s.conflictsRenamed,
          conflictsLogged: s.conflictsLogged,
        });
        // Try to refresh topic files list for the UI
        try {
          const records = await this.storageService.getTopicFileRecords(s.topicId);
          const files: ITopicFileInfo[] = records.map(r => ({
            id: r.id, // using composite id as file id
            name: r.fileName,
            size: r.size,
            mimeType: '', // not stored in IFileRecord
            uploadedAt: r.uploadedAt,
            messageId: 0, // not stored in IFileRecord
          }));
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore – cast through shared EventPayloadMap at callsite elsewhere
          this.socketService?.emit('topic_files_snapshot', {
            topicId: s.topicId,
            files,
          });
        } catch (e) {
          this.logger.debug('topic_files_snapshot emit after completion failed', {
            topicId: s.topicId,
            error: e,
          });
        }
        this.socketService?.emit('upload_progress', {
          uploadId: s.id,
          fileName: s.currentFile || '',
          fileIndex: s.uploadedFiles,
          totalFiles: s.totalFiles,
          uploadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          eta: 0,
        });
      }
      s.updatedAt = new Date();
    } catch (err) {
      s.status = EUploadStatus.FAILED;
      s.error = (err as Error).message;
      s.completedAt = new Date();
      s.updatedAt = new Date();
      this.socketService?.emit('upload_error', {
        uploadId: s.id,
        topicId: s.topicId,
        error: (err as Error).message,
        timestamp: Date.now(),
      });
    }
  }

  private toResult(sessionId: string): IUploadResult {
    const s = this.getSession(sessionId);
    return {
      uploadId: s.id,
      status: s.status,
      totalFiles: s.totalFiles,
      uploadedFiles: s.uploadedFiles,
      realUploadedFiles: s.realUploaded,
      skippedFilesCount: s.skipped,
      failedFiles: s.failedFiles,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      hasFailures: s.failedFiles.length > 0,
      conflictsSkipped: s.conflictsSkipped,
      conflictsRenamed: s.conflictsRenamed,
      conflictsLogged: s.conflictsLogged,
    };
  }

  private async collectFiles(folderPath: string, subset?: string[]): Promise<IFileInfo[]> {
    const entries = await readdir(folderPath, { withFileTypes: true });
    const result: IFileInfo[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      // Skip hidden dotfiles and macOS Finder metadata
      if (entry.name.startsWith('.') || entry.name === '.DS_Store') continue;
      if (subset && subset.length > 0 && !subset.includes(entry.name)) continue;
      const full = join(folderPath, entry.name);
      try {
        const stats = await stat(full);
        result.push({
          id: `${stats.ino}-${stats.size}`,
          name: entry.name,
          path: full,
          size: stats.size,
          hash: '',
          mimeType: 'application/octet-stream',
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        });
      } catch (err) {
        this.logger.warn('Could not stat file', { file: full, error: err });
      }
    }
    // Alphabetical order by file name (locale-aware basic)
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }

  private ensurePersistenceLoop(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = undefined;
    }
    if (this.scheduler && !this.persistenceScheduled) {
      this.persistenceScheduled = true;
      this.scheduler.scheduleTask(
        this.persistenceTaskId,
        'Upload Session Persistence',
        this.options.persistIntervalMs,
        async () => {
          await this.persistSessions();
          if (!this.hasActiveSessions()) {
            this.scheduler.cancelTask(this.persistenceTaskId);
            this.persistenceScheduled = false;
          }
        }
      );
    }
  }

  private hasActiveSessions(): boolean {
    for (const s of this.sessions.values()) {
      if (
        s.status === EUploadStatus.PENDING ||
        s.status === EUploadStatus.UPLOADING ||
        s.status === EUploadStatus.PAUSED
      ) {
        return true;
      }
    }
    return false;
  }

  private async persistSessions(): Promise<void> {
    for (const s of this.sessions.values()) {
      const last = this.lastPersisted.get(s.id);
      if (last && s.updatedAt <= last) continue;
      try {
        await this.storageService.saveUploadSession(s);
        this.lastPersisted.set(s.id, new Date());
      } catch (err) {
        this.logger.error('Failed to persist session', { sessionId: s.id, error: err });
      }
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('UploadOrchestrator shutdown initiated');
    try {
      await this.persistSessions();
    } catch (err) {
      this.logger.error('Failed to flush sessions during shutdown', { error: err });
    }
    if (this.persistenceScheduled) {
      this.scheduler.cancelTask(this.persistenceTaskId);
      this.persistenceScheduled = false;
    }
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = undefined;
    }
    this.logger.info('UploadOrchestrator shutdown complete');
  }

  private async buildFingerprint(
    file: IFileInfo,
    strategy: TFileHashStrategy,
    forceHash: boolean
  ): Promise<{ size: number; mtimeMs: number; hash?: string }> {
    const mtimeMs = file.updatedAt.getTime();
    const cacheKey = `${file.path}:${strategy}`;
    const cached = this.fingerprintCache.get(cacheKey);
    if (cached && cached.size === file.size && cached.mtimeMs === mtimeMs) {
      if (
        strategy === EFileHashStrategy.EAGER ||
        (strategy === EFileHashStrategy.ON_DEMAND && forceHash)
      ) {
        if (forceHash && !cached.hash) {
          const hash = await this.computeFileHash(file.path);
          const enriched = { ...cached, hash };
          this.fingerprintCache.set(cacheKey, enriched);
          return enriched;
        }
      }
      return cached;
    }
    const base = { size: file.size, mtimeMs } as { size: number; mtimeMs: number; hash?: string };
    if (
      strategy === EFileHashStrategy.EAGER ||
      (strategy === EFileHashStrategy.ON_DEMAND && forceHash)
    ) {
      try {
        base.hash = await this.computeFileHash(file.path);
      } catch (e) {
        this.logger.warn('Hash computation failed', { file: file.path, error: e });
      }
    }
    this.fingerprintCache.set(cacheKey, base);
    return base;
  }

  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      import('fs')
        .then(fsMod => {
          const stream = fsMod.createReadStream(filePath);
          stream.on('data', chunk => hash.update(chunk));
          stream.on('error', reject);
          stream.on('end', () => resolve(hash.digest('hex')));
        })
        .catch(reject);
    });
  }

  private async buildQuickFingerprint(
    file: IFileInfo
  ): Promise<{ size: number; mtimeMs: number; hash?: string }> {
    return this.buildFingerprint(file, EFileHashStrategy.NONE, false);
  }

  /** Recover sessions persisted in uploading/pending state on previous shutdown. */
  async recoverDanglingSessions(): Promise<void> {
    this.logger.info('Recover dangling sessions: start');
    let sessions: IUploadSession[] = [];
    try {
      sessions = await this.storageService.getUploadSessions();
    } catch (e) {
      this.logger.error('Failed to load sessions for recovery', { error: e });
      return;
    }
    const candidates = sessions.filter(
      s => s.status === EUploadStatus.UPLOADING || s.status === EUploadStatus.PENDING
    );
    for (const s of candidates) {
      const newStatus = s.uploadedFiles > 0 ? EUploadStatus.PARTIAL : EUploadStatus.FAILED;
      const updated: IUploadSession = {
        ...s,
        status: newStatus,
        updatedAt: new Date(),
        completedAt: s.uploadedFiles > 0 ? s.completedAt : new Date(),
        error: s.uploadedFiles === 0 ? 'Interrupted before progress' : s.error,
      };
      try {
        await this.storageService.saveUploadSession(updated);
        const internal: InternalSession = {
          id: updated.id,
          folderPath: updated.folderPath,
          topicId: updated.topicId,
          channelId: 'unknown',
          status: updated.status,
          totalFiles: updated.totalFiles,
          uploadedFiles: updated.uploadedFiles,
          currentFile: updated.currentFile,
          progress: updated.progress,
          startedAt: updated.startedAt,
          updatedAt: updated.updatedAt,
          failedFiles: [],
          conflictPolicy: EUploadConflictPolicy.SKIP,
          hashStrategy: EFileHashStrategy.NONE,
          realUploaded: updated.realUploadedFiles || 0,
          skipped: updated.skippedFilesCount || 0,
          conflictsSkipped: updated.conflictsSkipped || 0,
          conflictsRenamed: updated.conflictsRenamed || 0,
          conflictsLogged: updated.conflictsLogged || 0,
        };
        this.sessions.set(updated.id, internal);
        this.socketService?.emit('upload_progress', {
          uploadId: updated.id,
          fileName: updated.currentFile || '',
          fileIndex: updated.uploadedFiles,
          totalFiles: updated.totalFiles,
          uploadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          eta: 0,
        });
        this.logger.info('Recovered dangling session', { id: updated.id, status: updated.status });
      } catch (e) {
        this.logger.error('Failed to mark dangling session', { id: s.id, error: e });
      }
    }
    this.logger.info('Recover dangling sessions: done', { count: candidates.length });
  }

  /** Returns shallow copy of public sessions for snapshotting */
  async listSessions(): Promise<IUploadSession[]> {
    const arr: IUploadSession[] = [];
    for (const s of this.sessions.values()) {
      arr.push({
        id: s.id,
        folderPath: s.folderPath,
        topicId: s.topicId,
        status: s.status,
        totalFiles: s.totalFiles,
        uploadedFiles: s.uploadedFiles,
        currentFile: s.currentFile,
        progress: s.progress,
        startedAt: s.startedAt,
        updatedAt: s.updatedAt,
        completedAt: s.completedAt,
        error: s.error,
        realUploadedFiles: s.realUploaded,
        skippedFilesCount: s.skipped,
        conflictsSkipped: s.conflictsSkipped,
        conflictsRenamed: s.conflictsRenamed,
        conflictsLogged: s.conflictsLogged,
      });
    }
    return arr;
  }
}

// Legacy alias removed (SyncService). If external code relied on it, reintroduce explicitly elsewhere.
