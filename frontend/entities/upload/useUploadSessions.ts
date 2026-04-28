'use client';
import type {
  IUploadCompleteEvent,
  IUploadProgress,
  IUploadSession,
  TUploadStatus,
} from '@/types/file-sync';
import { WSEvent } from '@/types/websocket/events';
import { useEffect, useMemo, useRef, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

type SessionsState = {
  byId: Map<string, IUploadSession>;
  byFolder: Map<string, string[]>; // folderPath -> [sessionIds]
};

export function useUploadSessions() {
  const [state, setState] = useState<SessionsState>({ byId: new Map(), byFolder: new Map() });
  const lastProgress = useRef<Map<string, IUploadProgress>>(new Map());

  useEffect(() => {
    // Snapshot
    const offSnap = on(WSEvent.UPLOAD_SESSIONS_SNAPSHOT, payload => {
      const nextById = new Map<string, IUploadSession>();
      const nextByFolder = new Map<string, string[]>();
      for (const s of (payload as { sessions: IUploadSession[] }).sessions || []) {
        nextById.set(s.id, s);
        const arr = nextByFolder.get(s.folderPath) || [];
        arr.push(s.id);
        nextByFolder.set(s.folderPath, arr);
      }
      setState({ byId: nextById, byFolder: nextByFolder });
    });

    // Live events
    const offStart = on(WSEvent.UPLOAD_START, ev => {
      const payload = ev as {
        uploadId: string;
        folderPath: string;
        topicId: string;
        totalFiles: number;
      };
      setState(prev => {
        const byId = new Map(prev.byId);
        const byFolder = new Map(prev.byFolder);
        const s: IUploadSession = {
          id: payload.uploadId,
          folderPath: payload.folderPath,
          topicId: payload.topicId,
          status: 'in_progress' as TUploadStatus,
          totalFiles: payload.totalFiles,
          uploadedFiles: 0,
          currentFile: '',
          progress: 0,
          startedAt: new Date(),
          updatedAt: new Date(),
        };
        byId.set(s.id, s);
        const arr = [...(byFolder.get(s.folderPath) || [])];
        if (!arr.includes(s.id)) arr.push(s.id);
        byFolder.set(s.folderPath, arr);
        return { byId, byFolder };
      });
    });

    const offProg = on(WSEvent.UPLOAD_PROGRESS, ev => {
      const payload = ev as IUploadProgress;
      lastProgress.current.set(payload.uploadId, payload);
      setState(prev => {
        const byId = new Map(prev.byId);
        const s = byId.get(payload.uploadId);
        if (s) {
          const uploadedFiles = Math.max(payload.fileIndex, s.uploadedFiles);
          const progress = Math.round((uploadedFiles / (s.totalFiles || 1)) * 100);
          byId.set(payload.uploadId, {
            ...s,
            uploadedFiles,
            currentFile: payload.fileName,
            progress,
            updatedAt: new Date(),
          });
        }
        return { ...prev, byId };
      });
    });

    const offDone = on(WSEvent.UPLOAD_COMPLETE, ev => {
      const payload = ev as IUploadCompleteEvent;
      setState(prev => {
        const byId = new Map(prev.byId);
        const s = byId.get(payload.uploadId);
        if (s) {
          byId.set(payload.uploadId, {
            ...s,
            status: (payload.hasFailures ? 'partial' : 'completed') as TUploadStatus,
            uploadedFiles: payload.uploadedFiles,
            progress: 100,
            updatedAt: new Date(),
            completedAt: new Date(),
          });
        }
        return { ...prev, byId };
      });
    });

    const offErr = on(WSEvent.UPLOAD_ERROR, () => {
      // Snapshot will reflect final state
    });

    // Request initial snapshot on mount
    emit(WSEvent.REQUEST_UPLOAD_SESSIONS, {});

    return () => {
      offSnap();
      offStart();
      offProg();
      offDone();
      offErr();
    };
  }, []);

  const latestByFolder = useMemo(() => {
    const out = new Map<string, IUploadSession | undefined>();
    state.byFolder.forEach((ids, folder) => {
      const sorted = ids
        .map(id => state.byId.get(id))
        .filter((s): s is IUploadSession => !!s)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      out.set(folder, sorted[0]);
    });
    return out;
  }, [state]);

  return {
    sessionsByFolder: latestByFolder,
    getByFolder(folderPath: string) {
      return latestByFolder.get(folderPath);
    },
    raw: state,
    pause(id: string) {
      emit(WSEvent.PAUSE_UPLOAD, { uploadId: id });
    },
    resume(id: string) {
      emit(WSEvent.RESUME_UPLOAD, { uploadId: id });
    },
    cancel(id: string) {
      emit(WSEvent.CANCEL_UPLOAD, { uploadId: id });
    },
  } as const;
}
