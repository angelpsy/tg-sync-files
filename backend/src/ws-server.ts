/**
 * WebSocket server for Telegram FileSync
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Server } from 'socket.io';
import { createServer } from 'node:http';

// Load environment variables from root .env file
config({ path: resolve(process.cwd(), '../.env') });

// Temporary types for testing (will be moved to shared types later)
interface FileSyncEvent {
  id: string;
  fileName: string;
  filePath: string;
  channelId: string;
  status: 'pending' | 'syncing' | 'completed' | 'error';
  timestamp: Date;
  error?: string;
}

interface WSMessage<T = any> {
  type: 'file_sync_start' | 'file_sync_progress' | 'file_sync_complete' | 'file_sync_error' | 'channel_status_update';
  payload: T;
  timestamp: number;
}

const PORT = process.env.BACKEND_WS_PORT;

if (!PORT) {
  console.error('❌ BACKEND_WS_PORT environment variable is not defined');
  process.exit(1);
}

const portNumber = parseInt(PORT, 10);
if (isNaN(portNumber)) {
  console.error('❌ BACKEND_WS_PORT must be a valid number');
  process.exit(1);
}

// Parse CORS origins from environment
const getCorsOrigins = (): string[] => {
  const corsOrigins = process.env.CORS_ORIGINS;
  if (!corsOrigins) {
    console.error('❌ CORS_ORIGINS environment variable is not defined');
    process.exit(1);
  }
  return corsOrigins.split(',').map(origin => origin.trim());
};

// Create HTTP server
const server = createServer();

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: getCorsOrigins(),
    methods: ["GET", "POST"]
  }
});

console.log('🚀 Starting WebSocket server...');
console.log('📡 CORS origins:', getCorsOrigins());

// Connection handling
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Send welcome message
  const welcomeMessage: WSMessage = {
    type: 'channel_status_update',
    payload: {
      message: 'Connected to Telegram FileSync WebSocket server',
      timestamp: new Date().toISOString()
    },
    timestamp: Date.now()
  };
  
  socket.emit('message', welcomeMessage);

  // Simulate file sync events for testing
  const simulateFileEvents = () => {
    const events: FileSyncEvent[] = [
      {
        id: `event-${Date.now()}-1`,
        fileName: 'document.pdf',
        filePath: '/test-files/document.pdf',
        channelId: '-1001234567890',
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: `event-${Date.now()}-2`,
        fileName: 'image.jpg',
        filePath: '/test-files/image.jpg',
        channelId: '-1009876543210',
        status: 'syncing',
        timestamp: new Date()
      },
      {
        id: `event-${Date.now()}-3`,
        fileName: 'video.mp4',
        filePath: '/test-files/video.mp4',
        channelId: '-1001234567890',
        status: 'completed',
        timestamp: new Date()
      }
    ];

    events.forEach((event, index) => {
      setTimeout(() => {
        const message: WSMessage<FileSyncEvent> = {
          type: index === 0 ? 'file_sync_start' : 
                index === 1 ? 'file_sync_progress' : 'file_sync_complete',
          payload: event,
          timestamp: Date.now()
        };
        
        socket.emit('message', message);
        console.log(`📤 Sent ${message.type} event for ${event.fileName}`);
      }, (index + 1) * 2000); // Send events every 2 seconds
    });

    // Send an error event after 10 seconds
    setTimeout(() => {
      const errorEvent: FileSyncEvent = {
        id: `event-${Date.now()}-error`,
        fileName: 'corrupted.zip',
        filePath: '/test-files/corrupted.zip',
        channelId: '-1001234567890',
        status: 'error',
        timestamp: new Date(),
        error: 'File is corrupted or too large for Telegram'
      };

      const errorMessage: WSMessage<FileSyncEvent> = {
        type: 'file_sync_error',
        payload: errorEvent,
        timestamp: Date.now()
      };

      socket.emit('message', errorMessage);
      console.log(`❌ Sent error event for ${errorEvent.fileName}`);
    }, 10000);
  };

  // Start simulating events 3 seconds after connection
  setTimeout(simulateFileEvents, 3000);

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`❌ Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  // Handle custom events from client
  socket.on('ping', (data) => {
    console.log(`🏓 Received ping:`, data);
    socket.emit('pong', { message: 'pong', timestamp: Date.now() });
  });
});

// Start server
server.listen(portNumber, () => {
  console.log(`🎯 WebSocket server running on http://localhost:${portNumber}`);
  console.log(`📡 Ready to accept connections from frontend...`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down WebSocket server...');
  server.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down WebSocket server...');
  server.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});
