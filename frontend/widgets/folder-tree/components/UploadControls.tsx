'use client';
import type { IUploadSession } from '@/types/file-sync';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { isInProgress, isPaused } from '@/shared/lib/status/operationStatus';
import type { TopicOption } from './types';

type UploadControlsProps = {
  folderPath: string;
  directFiles: string[];
  selectedChannelId?: string;
  topics: TopicOption[];
  activeSession?: IUploadSession;
  onStartUpload: (command: {
    folderPath: string;
    channelId: string;
    existingTopicId?: string;
    newTopicName?: string;
    selectedFiles?: string[];
  }) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
};

export function UploadControls({
  folderPath,
  directFiles,
  selectedChannelId,
  topics,
  activeSession,
  onStartUpload,
  onPause,
  onResume,
  onCancel,
}: UploadControlsProps) {
  const [topicChoice, setTopicChoice] = useState<string>('__new__');
  const [newTopicName, setNewTopicName] = useState<string>(folderPath.split('/').pop() || 'New');
  const [useAllFiles, setUseAllFiles] = useState<boolean>(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const canStart =
    !!selectedChannelId && (topicChoice !== '__new__' || newTopicName.trim().length > 0);
  const topicOptions = useMemo(
    () => [{ id: '__new__', title: '— New topic —' }, ...topics],
    [topics]
  );

  const toggleFile = (name: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const startUpload = () => {
    if (!selectedChannelId) return;

    const topicPart =
      topicChoice === '__new__'
        ? { newTopicName: newTopicName.trim() }
        : { existingTopicId: topicChoice };

    const filesPart = useAllFiles ? {} : { selectedFiles: Array.from(selectedFiles) };

    onStartUpload({
      folderPath,
      channelId: selectedChannelId,
      ...topicPart,
      ...filesPart,
    });
  };

  return (
    <div className="my-3 p-3 border rounded-lg bg-muted/20 shadow-sm border-dashed border-muted-foreground/30">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Topic</span>
          <select
            className="border rounded px-2 py-1 bg-background text-foreground text-xs focus:ring-1 focus:ring-primary min-w-[140px]"
            value={topicChoice}
            onChange={e => setTopicChoice(e.target.value)}
          >
            {topicOptions.map(topic => (
              <option key={topic.id} value={topic.id}>
                {topic.title || topic.name}
              </option>
            ))}
          </select>
        </label>

        {topicChoice === '__new__' && (
          <input
            type="text"
            className="border rounded px-2 py-1 bg-background text-foreground min-w-[160px] text-xs focus:ring-1 focus:ring-primary"
            placeholder="New topic name"
            value={newTopicName}
            onChange={e => setNewTopicName(e.target.value)}
          />
        )}

        <div className="flex items-center gap-4 border-l pl-3 ml-1">
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              className="size-3 rounded-sm border-primary text-primary focus:ring-primary"
              checked={useAllFiles}
              onChange={e => setUseAllFiles(e.target.checked)}
            />
            <span className="font-semibold">All files</span>
          </label>

          <Button
            size="sm"
            variant="default"
            className="shadow-sm h-7 text-xs px-4"
            disabled={!canStart || (activeSession ? isInProgress(activeSession.status) : false)}
            onClick={startUpload}
          >
            {activeSession && isInProgress(activeSession.status) ? 'Uploading...' : 'Start'}
          </Button>
        </div>

        {activeSession && (
          <div className="ml-auto flex items-center gap-3 bg-background/50 rounded-md px-3 py-1 border shadow-xs border-primary/20">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase text-primary/60 tracking-wider">Progress</span>
              <span className="text-xs font-mono font-bold text-primary tabular-nums">
                {activeSession.uploadedFiles}/{activeSession.totalFiles} • {activeSession.progress}%
              </span>
            </div>

            <div className="flex gap-1 border-l pl-2">
              {isInProgress(activeSession.status) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] font-black text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                  onClick={() => onPause(activeSession.id)}
                >
                  PAUSE
                </Button>
              ) : isPaused(activeSession.status) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] font-black text-green-600 hover:text-green-700 hover:bg-green-100"
                  onClick={() => onResume(activeSession.id)}
                >
                  RESUME
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] font-black text-red-600 hover:text-red-700 hover:bg-red-100"
                onClick={() => onCancel(activeSession.id)}
              >
                STOP
              </Button>
            </div>
          </div>
        )}
      </div>

      {!useAllFiles && (
        <div className="mt-3 bg-background/40 rounded-md p-2 border border-dashed animate-in fade-in slide-in-from-top-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
              Select specific files:
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-bold">
              {selectedFiles.size} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {directFiles.length === 0 ? (
              <span className="text-[10px] text-muted-foreground italic pl-1">No direct files in this folder</span>
            ) : (
              directFiles.map(fileName => (
                <label
                  key={fileName}
                  className={`inline-flex items-center gap-1.5 text-[11px] border rounded-full px-3 py-0.5 cursor-pointer transition-all ${selectedFiles.has(fileName) ? 'bg-primary/10 border-primary/50 text-primary font-bold shadow-sm' : 'hover:bg-muted font-medium border-muted-foreground/30'}`}
                >
                  <input
                    type="checkbox"
                    className="size-3 rounded-full border-primary/50 text-primary"
                    checked={selectedFiles.has(fileName)}
                    onChange={() => toggleFile(fileName)}
                  />
                  <span className="truncate max-w-[200px]" title={fileName}>
                    {fileName}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
