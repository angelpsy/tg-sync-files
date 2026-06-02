'use client';
import { EUploadStatus } from '@/types/file-sync/enums';
import type { IUploadCompleteEvent, IUploadProgress, IUploadSession, IUploadStartEvent } from '@/types/file-sync';
import { WSEvent } from '@/types/websocket/events';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  cancelUpload,
  pauseUpload,
  requestUploadSessions,
  resumeUpload,
} from '../commands/uploadCommands';
import { on } from '@/shared/api/ws/events';

type SessionsState = {
  byId: Map<string, IUploadSession>;
  byFolder: Map<string, string[]>;
};

export function useUploadSessionsQuery() {
  const [state, setState] = useState<SessionsState>({ byId: new Map(), byFolder: new Map() });
  const lastProgress = useRef<Map<string, IUploadProgress>>(new Map());

  useEffect(() => {
    const offSnap = on(WSEvent.UPLOAD_SESSIONS_SNAPSHOT, payload => {
      const nextById = new Map<string, IUploadSession>();
      const nextByFolder = new Map<string, string[]>();

      for (const session of payload.sessions || []) {
        nextById.set(session.id, session);
        const ids = nextByFolder.get(session.folderPath) || [];
        ids.push(session.id);
        nextByFolder.set(session.folderPath, ids);
      }

      setState({ byId: nextById, byFolder: nextByFolder });
    });

    const offStart = on(WSEvent.UPLOAD_START, event => {
      const startEvent: IUploadStartEvent = event;

      setState(prev => {
        const byId = new Map(prev.byId);
        const byFolder = new Map(prev.byFolder);

        const session: IUploadSession = {
          id: startEvent.uploadId,
          folderPath: startEvent.folderPath,
          topicId: startEvent.topicId,
          status: EUploadStatus.UPLOADING,
          totalFiles: startEvent.totalFiles,
          uploadedFiles: 0,
          currentFile: '',
          progress: 0,
          startedAt: new Date(),
          updatedAt: new Date(),
        };

        byId.set(session.id, session);
        const ids = [...(byFolder.get(session.folderPath) || [])];
        if (!ids.includes(session.id)) ids.push(session.id);
        byFolder.set(session.folderPath, ids);

        return { byId, byFolder };
      });
    });

    const offProgress = on(WSEvent.UPLOAD_PROGRESS, event => {
      const progressEvent: IUploadProgress = event;

      lastProgress.current.set(progressEvent.uploadId, progressEvent);
      setState(prev => {
        const byId = new Map(prev.byId);
        const existing = byId.get(progressEvent.uploadId);
        if (!existing) return prev;

        const uploadedFiles = Math.max(progressEvent.fileIndex, existing.uploadedFiles);
        const progress = Math.round((uploadedFiles / (existing.totalFiles || 1)) * 100);

        byId.set(progressEvent.uploadId, {
          ...existing,
          uploadedFiles,
          currentFile: progressEvent.fileName,
          progress,
          updatedAt: new Date(),
        });

        return { ...prev, byId };
      });
    });

    const offComplete = on(WSEvent.UPLOAD_COMPLETE, event => {
      const completeEvent: IUploadCompleteEvent = event;

      setState(prev => {
        const byId = new Map(prev.byId);
        const existing = byId.get(completeEvent.uploadId);
        if (!existing) return prev;

        byId.set(completeEvent.uploadId, {
          ...existing,
          status: completeEvent.hasFailures ? EUploadStatus.PARTIAL : EUploadStatus.COMPLETED,
          uploadedFiles: completeEvent.uploadedFiles,
          progress: 100,
          updatedAt: new Date(),
          completedAt: new Date(),
        });

        return { ...prev, byId };
      });
    });

    const offError = on(WSEvent.UPLOAD_ERROR, () => {
      // Snapshot remains source of truth for terminal states
    });

    requestUploadSessions();

    return () => {
      offSnap();
      offStart();
      offProgress();
      offComplete();
      offError();
    };
  }, []);

  const latestByFolder = useMemo(() => {
    const out = new Map<string, IUploadSession | undefined>();
    state.byFolder.forEach((ids, folderPath) => {
      const sorted = ids
        .map(id => state.byId.get(id))
        .filter((session): session is IUploadSession => !!session)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      out.set(folderPath, sorted[0]);
    });
    return out;
  }, [state]);

  return {
    sessionsByFolder: latestByFolder,
    getByFolder(folderPath: string) {
      return latestByFolder.get(folderPath);
    },
    raw: state,
    pause: pauseUpload,
    resume: resumeUpload,
    cancel: cancelUpload,
  } as const;
}
