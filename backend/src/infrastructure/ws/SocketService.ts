import { createServer, type Server as HttpServer } from 'node:http';

import { Server as IOServer, type Socket } from 'socket.io';

import { serviceLoggers } from '../../../../shared/logger';

import type { ISocketService, IWSConnectionInfo, IWSMessage } from '@/types';
import {
  WS_PROTOCOL_VERSION,
  type EventPayloadMap,
  type TEventName,
} from '@/types/websocket/events.js';

interface SocketServiceOptions {
  port: number; // if 0 use random free port (main HTTP server not yet integrated)
  corsOrigins?: string[];
  maxHttpBufferSize?: number;
  rateLimit?: { windowMs: number; max: number; banAfter?: number };
}

/**
 * SocketService – minimal socket.io based implementation of ISocketService.
 */
export class SocketService implements ISocketService {
  private readonly logger = serviceLoggers.socket;
  private io?: IOServer;
  private server?: HttpServer;
  private opts: SocketServiceOptions;
  private connectionHandlers = new Set<(c: IWSConnectionInfo) => void>();
  private disconnectionHandlers = new Set<(c: IWSConnectionInfo) => void>();
  private messageHandlers = new Set<(clientId: string, msg: IWSMessage<unknown>) => void>();
  private clientConnectHandlers = new Set<(clientId: string) => void>();

  private startedAt: Date = new Date();
  private messagesIn = 0;
  private messagesOut = 0;
  private errors = 0;
  private rateLimitDrops = 0;
  private draining = false;
  private perSocketWindows = new Map<string, number[]>(); // timestamps ms
  private healthProvider?: () => unknown;

  constructor(opts: SocketServiceOptions) {
    this.opts = opts;
  }

  async initialize(): Promise<void> {
    if (this.io) return;
    this.server = createServer();
    this.server.on('request', (req, res) => {
      if (!req.url) return;
      if (req.url === '/health') {
        const payload = {
          status: 'ok',
          ...(this.healthProvider ? { data: this.healthProvider() } : {}),
        };
        const body = JSON.stringify(payload);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        });
        res.end(body);
      }
    });
    this.io = new IOServer(this.server, {
      cors: { origin: this.opts.corsOrigins || ['*'] },
      maxHttpBufferSize: this.opts.maxHttpBufferSize ?? 1_000_000,
    });
    this.io.engine.on('connection_error', err => {
      this.errors++;
      this.logger.error('WS engine connection error', { error: err.message });
    });
    this.io.on('connection', socket => this.handleConnection(socket));
    await new Promise<void>(resolve => this.server && this.server.listen(this.opts.port, resolve));
    const address = this.server.address();
    this.logger.info('SocketService listening', { address });
  }

  private handleConnection(socket: Socket): void {
    if (this.draining) {
      socket.disconnect(true);
      return;
    }

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
      this.messagesIn++;
      if (this.enforceRateLimit(socket.id)) return;
      try {
        this.messageHandlers.forEach(h => h(socket.id, msg));
      } catch (e) {
        this.errors++;
        this.logger.error('Message handler error', { error: e });
      }
    });
    socket.on('disconnect', reason => {
      this.disconnectionHandlers.forEach(h => h(info));
      this.logger.info('Client disconnected', { id: socket.id, reason });
      this.perSocketWindows.delete(socket.id);
    });
  }

  async broadcast<T>(message: IWSMessage<T>): Promise<void> {
    if (!this.io) return;
    if ((await this.getConnectedClients()).length === 0) return; // skip empty
    this.io.emit('message', { protocolVersion: WS_PROTOCOL_VERSION, ...message });
    this.messagesOut++;
  }

  async sendToClient<T>(clientId: string, message: IWSMessage<T>): Promise<void> {
    if (!this.io) return;
    this.io.to(clientId).emit('message', { protocolVersion: WS_PROTOCOL_VERSION, ...message });
    this.messagesOut++;
  }

  emit<E extends TEventName>(event: E, payload: EventPayloadMap[E]): void {
    if (!this.io) return;
    if (this.io.engine.clientsCount === 0) return;
    this.io.emit(event, payload);
    this.messagesOut++;
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
    this.connectionHandlers.add(handler);
  }
  offConnection(handler: (connectionInfo: IWSConnectionInfo) => void): void {
    this.connectionHandlers.delete(handler);
  }
  onDisconnection(handler: (connectionInfo: IWSConnectionInfo) => void): void {
    this.disconnectionHandlers.add(handler);
  }
  offDisconnection(handler: (connectionInfo: IWSConnectionInfo) => void): void {
    this.disconnectionHandlers.delete(handler);
  }
  onMessage<T>(handler: (clientId: string, message: IWSMessage<T>) => void): void {
    this.messageHandlers.add(handler as (c: string, m: IWSMessage<unknown>) => void);
  }
  offMessage<T>(handler: (clientId: string, message: IWSMessage<T>) => void): void {
    this.messageHandlers.delete(handler as (c: string, m: IWSMessage<unknown>) => void);
  }

  onClientConnect(handler: (clientId: string) => void): void {
    this.clientConnectHandlers.add(handler);
  }
  offClientConnect(handler: (clientId: string) => void): void {
    this.clientConnectHandlers.delete(handler);
  }

  setHealthProvider(fn: () => unknown): void {
    this.healthProvider = fn;
  }

  getStats() {
    const uptimeMs = Date.now() - this.startedAt.getTime();
    return {
      connections: this.io?.engine.clientsCount ?? 0,
      messagesIn: this.messagesIn,
      messagesOut: this.messagesOut,
      startedAt: this.startedAt,
      uptimeMs,
      errors: this.errors,
      rateLimitDrops: this.rateLimitDrops,
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('SocketService shutting down', this.getStats());
    this.draining = true;
    await new Promise<void>(resolve => this.io?.close(() => resolve()));
    if (this.server) await new Promise<void>(resolve => this.server?.close(() => resolve()));
  }

  private enforceRateLimit(clientId: string): boolean {
    const rl = this.opts.rateLimit;
    if (!rl) return false;
    const now = Date.now();
    const windowStart = now - rl.windowMs;
    let arr = this.perSocketWindows.get(clientId);
    if (!arr) {
      arr = [];
      this.perSocketWindows.set(clientId, arr);
    }
    // prune
    while (arr.length && arr[0] < windowStart) arr.shift();
    if (arr.length >= rl.max) {
      this.rateLimitDrops++;
      if (rl.banAfter && arr.length >= rl.banAfter) {
        const sock = this.io?.sockets.sockets.get(clientId);
        sock?.disconnect(true);
      }
      return true; // drop
    }
    arr.push(now);
    return false;
  }
}
