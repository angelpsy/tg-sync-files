'use client';
import type { IUploadCompleteEvent, IUploadProgress, IUploadSession } from '@/types/file-sync';
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
    const offSnap = on('upload_sessions_snapshot', payload => {
      const nextById = new Map<string, IUploadSession>();
      const nextByFolder = new Map<string, string[]>();
      for (const s of payload.sessions || []) {
        nextById.set(s.id, s);
        const arr = nextByFolder.get(s.folderPath) || [];
        arr.push(s.id);
        nextByFolder.set(s.folderPath, arr);
      }
      setState({ byId: nextById, byFolder: nextByFolder });
    });
    // Live events (best effort)
    const offStart = on('upload_start', ev => {
      setState(prev => {
        const byId = new Map(prev.byId);
        const byFolder = new Map(prev.byFolder);
        const s: IUploadSession = {
          id: ev.uploadId,
          folderPath: ev.folderPath,
          topicId: ev.topicId,
          status: 'uploading',
          totalFiles: ev.totalFiles,
          uploadedFiles: 0,
          currentFile: '',
          progress: 0,
          startedAt: new Date(),
          updatedAt: new Date(),
        } as IUploadSession;
        byId.set(s.id, s);
        const arr = byFolder.get(s.folderPath) || [];
        if (!arr.includes(s.id)) arr.push(s.id);
        byFolder.set(s.folderPath, arr);
        return { byId, byFolder };
      });
    });
    const offProg = on('upload_progress', ev => {
      lastProgress.current.set(ev.uploadId, ev);
      setState(prev => {
        const byId = new Map(prev.byId);
        const s = byId.get(ev.uploadId);
        if (s) {
          const uploadedFiles = Math.max(ev.fileIndex, s.uploadedFiles);
          const progress = Math.round((uploadedFiles / (s.totalFiles || 1)) * 100);
          byId.set(ev.uploadId, {
            ...s,
            uploadedFiles,
            currentFile: ev.fileName,
            progress,
            updatedAt: new Date(),
          } as IUploadSession);
        }
        return { ...prev, byId };
      });
    });
    const offDone = on('upload_complete', (ev: IUploadCompleteEvent) => {
      setState(prev => {
        const byId = new Map(prev.byId);
        const s = byId.get(ev.uploadId);
        if (s) {
          byId.set(ev.uploadId, {
            ...s,
            status: ev.hasFailures ? 'partial' : 'completed',
            uploadedFiles: ev.uploadedFiles,
            progress: 100,
            updatedAt: new Date(),
            completedAt: new Date(),
          } as IUploadSession);
        }
        return { ...prev, byId };
      });
    });
    const offErr = on('upload_error', () => {
      // Snapshot will reflect final state; keep minimal here
    });

    // Request initial snapshot on mount
    emit('request_upload_sessions', {});

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
      // pick most recently updated
      const sorted = [...ids]
        .map(id => state.byId.get(id))
        .filter((s): s is IUploadSession => !!s)
        .sort(
          (a, b) => (new Date(b.updatedAt).getTime() || 0) - (new Date(a.updatedAt).getTime() || 0)
        );
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
  } as const;
}
