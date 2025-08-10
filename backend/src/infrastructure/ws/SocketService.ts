import { createServer, type Server as HttpServer } from 'node:http';

import { Server as IOServer, type Socket } from 'socket.io';

import { serviceLoggers } from '../../../../shared/logger';

import type {
  IFileSyncEvent,
  ISocketService,
  ISyncDiffResult,
  IUploadCompleteEvent,
  IUploadErrorEvent,
  IUploadFileEvent,
  IUploadProgress,
  IUploadStartEvent,
  IWSConnectionInfo,
  IWSMessage,
} from '@/types';
import type { IChannelStatus } from '@/types/telegram';

interface SocketServiceOptions {
  port: number; // if 0 use random free port (main HTTP server not yet integrated)
  corsOrigins?: string[];
}

/**
 * SocketService – minimal socket.io based implementation of ISocketService.
 */
export class SocketService implements ISocketService {
  private readonly logger = serviceLoggers.socket;
  private io?: IOServer;
  private server?: HttpServer;
  private opts: SocketServiceOptions;
  private connectionHandlers: Array<(c: IWSConnectionInfo) => void> = [];
  private disconnectionHandlers: Array<(c: IWSConnectionInfo) => void> = [];
  private messageHandlers: Array<(clientId: string, msg: IWSMessage<unknown>) => void> = [];
  private clientConnectHandlers: Array<(clientId: string) => void> = [];

  constructor(opts: SocketServiceOptions) {
    this.opts = opts;
  }

  async initialize(): Promise<void> {
    if (this.io) return;
    this.server = createServer();
    this.io = new IOServer(this.server, {
      cors: { origin: this.opts.corsOrigins || ['*'] },
    });
    this.io.on('connection', socket => this.handleConnection(socket));
    await new Promise<void>(resolve => this.server && this.server.listen(this.opts.port, resolve));
    const address = this.server.address();
    this.logger.info('SocketService listening', { address });
  }

  private handleConnection(socket: Socket): void {
    const info: IWSConnectionInfo = {
      id: socket.id,
      connectedAt: new Date(),
      ip: socket.handshake.address || '',
      userAgent: socket.handshake.headers['user-agent'] || '',
    } as IWSConnectionInfo;
    this.logger.info('Client connected', { id: socket.id });
    this.connectionHandlers.forEach(h => h(info));
    this.clientConnectHandlers.forEach(h => h(socket.id));

    socket.on('message', (msg: IWSMessage<unknown>) => {
      this.messageHandlers.forEach(h => h(socket.id, msg));
    });
    socket.on('disconnect', reason => {
      this.disconnectionHandlers.forEach(h => h(info));
      this.logger.info('Client disconnected', { id: socket.id, reason });
    });
  }

  async broadcast<T>(message: IWSMessage<T>): Promise<void> {
    this.io?.emit('message', message);
  }

  async sendToClient<T>(clientId: string, message: IWSMessage<T>): Promise<void> {
    this.io?.to(clientId).emit('message', message);
  }

  async getConnectedClients(): Promise<IWSConnectionInfo[]> {
    if (!this.io) return [];
    const sockets = await this.io.fetchSockets();
    return sockets.map(s => ({
      id: s.id,
      connectedAt: new Date(s.handshake.issued || Date.now()),
      ip: s.handshake.address || '',
      userAgent: s.handshake.headers['user-agent'] || '',
    })) as IWSConnectionInfo[];
  }

  async disconnectClient(clientId: string): Promise<void> {
    const sock = this.io?.sockets.sockets.get(clientId);
    if (sock) sock.disconnect(true);
  }

  onConnection(handler: (connectionInfo: IWSConnectionInfo) => void): void {
    this.connectionHandlers.push(handler);
  }
  onDisconnection(handler: (connectionInfo: IWSConnectionInfo) => void): void {
    this.disconnectionHandlers.push(handler);
  }
  onMessage<T>(handler: (clientId: string, message: IWSMessage<T>) => void): void {
    // store as unknown but call generically
    this.messageHandlers.push(handler as (c: string, m: IWSMessage<unknown>) => void);
  }

  emitFileSync(event: IFileSyncEvent): void {
    this.io?.emit('file_sync_event', event);
  }
  emitUploadProgress(progress: IUploadProgress): void {
    this.io?.emit('upload_progress', progress);
  }
  emitChannelStatus(status: IChannelStatus): void {
    this.io?.emit('channel_status', status);
  }
  emitUploadStart(event: IUploadStartEvent): void {
    this.io?.emit('upload_start', event);
  }
  emitUploadComplete(event: IUploadCompleteEvent): void {
    this.io?.emit('upload_complete', event);
  }
  emitUploadError(event: IUploadErrorEvent): void {
    this.io?.emit('upload_error', event);
  }
  emitUploadFileEvent(event: IUploadFileEvent): void {
    this.io?.emit('upload_file_event', event);
  }
  emitSyncDiff(diff: ISyncDiffResult): void {
    this.io?.emit('sync_diff', diff);
  }
  onClientConnect(handler: (clientId: string) => void): void {
    this.clientConnectHandlers.push(handler);
  }

  async shutdown(): Promise<void> {
    this.logger.info('SocketService shutting down');
    await new Promise<void>(resolve => this.io?.close(() => resolve()));
    if (this.server) await new Promise<void>(resolve => this.server?.close(() => resolve()));
  }
}
