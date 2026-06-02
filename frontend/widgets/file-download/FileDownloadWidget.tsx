'use client';

import type { ITopicFileInfo } from '@/types/file-sync';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDownloadCommand } from '@/entities/download';

interface FileDownloadWidgetProps {
  topicId: string;
  channelId: string;
  files: ITopicFileInfo[];
  className?: string;
}

export function FileDownloadWidget({
  topicId,
  channelId,
  files,
  className,
}: FileDownloadWidgetProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [targetPath, setTargetPath] = useState('/Users/Downloads/telegram-files');
  const [isLoading, setIsLoading] = useState(false);
  const { startDownload } = useDownloadCommand();

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.name));
    }
  };

  const handleFileToggle = (fileName: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileName) ? prev.filter(f => f !== fileName) : [...prev, fileName]
    );
  };

  const handleStartDownload = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one file to download');
      return;
    }

    if (!targetPath.trim()) {
      alert('Please specify target path');
      return;
    }

    setIsLoading(true);
    try {
      startDownload({
        topicId,
        channelId,
        targetPath: targetPath.trim(),
        selectedFiles,
        overwriteExisting: false,
      });
      // Reset selection after starting download
      setSelectedFiles([]);
    } catch (error) {
      console.error('Failed to start download:', error);
      alert('Failed to start download');
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  if (files.length === 0) {
    return (
      <Card className={`p-4 ${className || ''}`}>
        <h3 className="font-semibold mb-2">Download Files</h3>
        <p className="text-gray-500">No files found in this topic</p>
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className || ''}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Download Files ({files.length})</h3>
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            {selectedFiles.length === files.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Target Folder:</label>
          <input
            type="text"
            value={targetPath}
            onChange={e => setTargetPath(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="/path/to/download/folder"
          />
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          <label className="block text-sm font-medium">Select Files:</label>
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedFiles.includes(file.name)}
                onChange={() => handleFileToggle(file.name)}
                className="h-4 w-4 text-blue-600"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(file.size)} • {file.mimeType || 'Unknown type'}
                  {file.uploadedAt && (
                    <span> • {new Date(file.uploadedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-gray-600">
            {selectedFiles.length} of {files.length} files selected
          </span>
          <Button
            onClick={handleStartDownload}
            disabled={isLoading || selectedFiles.length === 0}
            className="px-6"
          >
            {isLoading ? 'Starting...' : 'Start Download'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
