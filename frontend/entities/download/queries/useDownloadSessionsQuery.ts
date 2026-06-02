'use client';
import type {
  IDownloadCompleteEvent,
  IDownloadProgress,
  IDownloadSession,
} from '@/types/file-sync';
import { EOperationStatus } from '@/types/file-sync/enums';
import { WSEvent } from '@/types/websocket/events';
import { useEffect, useMemo, useRef, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

type SessionsState = {
  byId: Map<string, IDownloadSession>;
  byTopic: Map<string, string[]>; // topicId -> [sessionIds]
};

export function useDownloadSessionsQuery() {
  const [state, setState] = useState<SessionsState>({ byId: new Map(), byTopic: new Map() });
  const lastProgress = useRef<Map<string, IDownloadProgress>>(new Map());

  useEffect(() => {
    // Snapshot
    const offSnap = on(WSEvent.DOWNLOAD_SESSIONS_SNAPSHOT, payload => {
      const nextById = new Map<string, IDownloadSession>();
      const nextByTopic = new Map<string, string[]>();
      for (const s of payload.sessions || []) {
        nextById.set(s.id, s);
        const arr = nextByTopic.get(s.topicId) || [];
        arr.push(s.id);
        nextByTopic.set(s.topicId, arr);
      }
      setState({ byId: nextById, byTopic: nextByTopic });
    });

    // Live events (best effort)
    const offStart = on(WSEvent.DOWNLOAD_START, ev => {
      setState(prev => {
        const byId = new Map(prev.byId);
        const byTopic = new Map(prev.byTopic);
        const s: IDownloadSession = {
          id: ev.downloadId,
          topicId: ev.topicId,
          channelId: ev.channelId,
          targetPath: ev.targetPath,
          status: EOperationStatus.IN_PROGRESS,
          totalFiles: ev.totalFiles,
          downloadedFiles: 0,
          currentFile: '',
          progress: 0,
          startedAt: new Date(),
          updatedAt: new Date(),
          selectedFiles: ev.selectedFiles || [],
        };
        byId.set(s.id, s);
        const arr = byTopic.get(s.topicId) || [];
        if (!arr.includes(s.id)) arr.push(s.id);
        byTopic.set(s.topicId, arr);
        return { byId, byTopic };
      });
    });

    const offProg = on(WSEvent.DOWNLOAD_PROGRESS, ev => {
      lastProgress.current.set(ev.downloadId, ev);
      setState(prev => {
        const byId = new Map(prev.byId);
        const s = byId.get(ev.downloadId);
        if (s) {
          const downloadedFiles = Math.max(ev.fileIndex, s.downloadedFiles);
          const progress = Math.round((downloadedFiles / (s.totalFiles || 1)) * 100);
          byId.set(ev.downloadId, {
            ...s,
            downloadedFiles,
            currentFile: ev.fileName,
            progress,
            updatedAt: new Date(),
          });
        }
        return { ...prev, byId };
      });
    });

    const offDone = on(WSEvent.DOWNLOAD_COMPLETE, (ev: IDownloadCompleteEvent) => {
      setState(prev => {
        const byId = new Map(prev.byId);
        const s = byId.get(ev.downloadId);
        if (s) {
          byId.set(ev.downloadId, {
            ...s,
            status: ev.hasFailures ? EOperationStatus.PARTIAL : EOperationStatus.COMPLETED,
            downloadedFiles: ev.downloadedFiles,
            progress: 100,
            updatedAt: new Date(),
            completedAt: new Date(),
          });
        }
        return { ...prev, byId };
      });
    });

    const offErr = on(WSEvent.DOWNLOAD_ERROR, () => {
      // Snapshot will reflect final state; keep minimal here
    });

    // Request initial snapshot on mount
    emit(WSEvent.REQUEST_DOWNLOAD_SESSIONS, {});

    return () => {
      offSnap();
      offStart();
      offProg();
      offDone();
      offErr();
    };
  }, []);

  const latestByTopic = useMemo(() => {
    const out = new Map<string, IDownloadSession | undefined>();
    state.byTopic.forEach((ids, topic) => {
      // pick most recently updated
      const sorted = [...ids]
        .map(id => state.byId.get(id))
        .filter((s): s is IDownloadSession => !!s)
        .sort(
          (a, b) => (new Date(b.updatedAt).getTime() || 0) - (new Date(a.updatedAt).getTime() || 0)
        );
      out.set(topic, sorted[0]);
    });
    return out;
  }, [state]);

  return {
    sessionsByTopic: latestByTopic,
    getByTopic(topicId: string) {
      return latestByTopic.get(topicId);
    },
    raw: state,
  } as const;
}
