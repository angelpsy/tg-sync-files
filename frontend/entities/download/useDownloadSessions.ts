'use client';
import type {
  IDownloadCompleteEvent,
  IDownloadProgress,
  IDownloadSession,
} from '@/types/file-sync';
import { useEffect, useMemo, useRef, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

type SessionsState = {
  byId: Map<string, IDownloadSession>;
  byTopic: Map<string, string[]>; // topicId -> [sessionIds]
};

export function useDownloadSessions() {
  const [state, setState] = useState<SessionsState>({ byId: new Map(), byTopic: new Map() });
  const lastProgress = useRef<Map<string, IDownloadProgress>>(new Map());

  useEffect(() => {
    // Snapshot
    const offSnap = on('download_sessions_snapshot', payload => {
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
    const offStart = on('download_start', ev => {
      setState(prev => {
        const byId = new Map(prev.byId);
        const byTopic = new Map(prev.byTopic);
        const s: IDownloadSession = {
          id: ev.downloadId,
          topicId: ev.topicId,
          channelId: ev.channelId,
          targetPath: ev.targetPath,
          status: 'in_progress',
          totalFiles: ev.totalFiles,
          downloadedFiles: 0,
          currentFile: '',
          progress: 0,
          startedAt: new Date(),
          updatedAt: new Date(),
          selectedFiles: ev.selectedFiles || [],
        } as IDownloadSession;
        byId.set(s.id, s);
        const arr = byTopic.get(s.topicId) || [];
        if (!arr.includes(s.id)) arr.push(s.id);
        byTopic.set(s.topicId, arr);
        return { byId, byTopic };
      });
    });

    const offProg = on('download_progress', ev => {
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
          } as IDownloadSession);
        }
        return { ...prev, byId };
      });
    });

    const offDone = on('download_complete', (ev: IDownloadCompleteEvent) => {
      setState(prev => {
        const byId = new Map(prev.byId);
        const s = byId.get(ev.downloadId);
        if (s) {
          byId.set(ev.downloadId, {
            ...s,
            status: ev.hasFailures ? 'partial' : 'completed',
            downloadedFiles: ev.downloadedFiles,
            progress: 100,
            updatedAt: new Date(),
            completedAt: new Date(),
          } as IDownloadSession);
        }
        return { ...prev, byId };
      });
    });

    const offErr = on('download_error', () => {
      // Snapshot will reflect final state; keep minimal here
    });

    // Request initial snapshot on mount
    emit('request_download_sessions', {});

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
