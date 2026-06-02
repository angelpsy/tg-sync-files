'use client';

import {
  getStatusBadgeClass,
  getStatusText,
  isInProgress,
  isPending,
} from '@/shared/lib/status/operationStatus';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useDownloadSessionsQuery } from '@/entities/download';

interface DownloadProgressWidgetProps {
  className?: string;
}

export function DownloadProgressWidget({ className }: DownloadProgressWidgetProps) {
  const { raw } = useDownloadSessionsQuery();

  const activeSessions = Array.from(raw.byId.values()).filter(
    session => isInProgress(session.status) || isPending(session.status)
  );

  const formatElapsedTime = (startedAt: Date) => {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

    if (elapsed < 60) return `${elapsed}s`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (activeSessions.length === 0) {
    return (
      <Card className={`p-4 ${className || ''}`}>
        <h3 className="font-semibold mb-2">Download Progress</h3>
        <p className="text-gray-500">No active downloads</p>
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className || ''}`}>
      <div className="space-y-4">
        <h3 className="font-semibold">Download Progress ({activeSessions.length})</h3>

        <div className="space-y-3">
          {activeSessions.map(session => (
            <div key={session.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusBadgeClass(session.status)}>
                    {getStatusText(session.status)}
                  </Badge>
                  <span className="text-sm font-medium">Topic: {session.topicId}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatElapsedTime(session.startedAt)}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>
                    {session.downloadedFiles} / {session.totalFiles} files
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${session.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{session.progress}%</span>
                  <span>{session.currentFile || 'Preparing...'}</span>
                </div>
              </div>

              <div className="text-xs text-gray-600">
                <div>Target: {session.targetPath}</div>
                {session.selectedFiles && session.selectedFiles.length > 0 && (
                  <div>Selected: {session.selectedFiles.length} files</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
