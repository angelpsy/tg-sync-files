'use client';

import type { FileSyncEvent, WSMessage } from '@/types';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

export default function HomePage() {
  const [, setSocket] = useState<Socket | null>(null);
  const [syncEvents, setSyncEvents] = useState<FileSyncEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('disconnected');

  useEffect(() => {
    const wsEndpoint = process.env.NEXT_PUBLIC_WS_ENDPOINT;

    if (!wsEndpoint) {
      console.error('NEXT_PUBLIC_WS_ENDPOINT environment variable is not defined');
      setConnectionStatus('disconnected');
      return;
    }

    const newSocket = io(wsEndpoint);

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setConnectionStatus('disconnected');
    });

    newSocket.on('message', (message: WSMessage) => {
      console.log('Received message:', message);

      if (
        message.type === 'file_sync_start' ||
        message.type === 'file_sync_progress' ||
        message.type === 'file_sync_complete' ||
        message.type === 'file_sync_error'
      ) {
        setSyncEvents(prev => [...prev, message.payload as FileSyncEvent]);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Telegram FileSync</h1>
        <p className="text-lg text-gray-600 mb-6">Monitor and sync files to Telegram channels</p>

        <div className="flex items-center justify-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-green-500'
                : connectionStatus === 'connecting'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
          ></div>
          <span className="text-sm font-medium">WebSocket: {connectionStatus}</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">File Sync Events</h2>

        {syncEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No sync events yet. Start watching for file changes...
          </p>
        ) : (
          <div className="space-y-3">
            {syncEvents
              .slice(-10)
              .reverse()
              .map((event, index) => (
                <div key={`${event.id}-${index}`} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{event.fileName}</p>
                      <p className="text-sm text-gray-600">{event.filePath}</p>
                      <p className="text-xs text-gray-500">Channel: {event.channelId}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                          event.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : event.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : event.status === 'syncing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {event.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  {event.error && <p className="text-sm text-red-600 mt-2">{event.error}</p>}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
