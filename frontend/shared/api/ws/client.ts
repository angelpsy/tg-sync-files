import type { EventPayloadMap, TEventName } from '@/types/websocket/events';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

import type { IWSMessage } from './protocol';
import { isWSMessage } from './protocol';

export interface WSClientOptions {
  url: string;
  authToken?: string;
}

export type MessageHandler = (msg: IWSMessage<unknown>) => void;

class WSClient {
  private socket: Socket | null = null;
  private onMessageHandlers = new Set<MessageHandler>();
  private onConnectHandlers = new Set<() => void>();
  private onDisconnectHandlers = new Set<(reason?: string) => void>();
  private onAnyHandlers = new Set<(event: string, payload: unknown) => void>();
  private onOutgoingHandlers = new Set<(event: string, payload: unknown) => void>();
  private messagesIn = 0;
  private messagesOut = 0;

  /** Emit a typed event to the server */
  emit<E extends TEventName>(event: E, payload: EventPayloadMap[E]): void {
    this.messagesOut += 1;
    this.onOutgoingHandlers.forEach(h => h(event as string, payload as unknown));
    this.socket?.emit(event as string, payload as unknown);
  }

  /** Subscribe to a typed event from the server; returns unsubscribe */
  onEvent<E extends TEventName>(
    event: E,
    handler: (payload: EventPayloadMap[E]) => void
  ): () => void {
    const wrapped = (payload: unknown) => handler(payload as EventPayloadMap[E]);
    this.socket?.on(event as string, wrapped as (...args: any[]) => void);
    return () => this.socket?.off(event as string, wrapped as (...args: any[]) => void);
  }

  connect(opts: WSClientOptions) {
    if (this.socket) return;
    // socket.io prefers http(s) base; normalize ws(s) to http(s)
    const base = opts.url.replace(/^wss?:\/\//, m => (m === 'wss://' ? 'https://' : 'http://'));
    this.socket = io(base, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: opts.authToken ? { token: opts.authToken } : undefined,
    });

    this.socket.on('connect', () => this.onConnectHandlers.forEach(h => h()));
    this.socket.on('disconnect', reason => this.onDisconnectHandlers.forEach(h => h(reason)));
    this.socket.on('connect_error', () =>
      this.onDisconnectHandlers.forEach(h => h('connect_error'))
    );

    this.socket.on('message', (data: unknown) => {
      if (isWSMessage(data)) {
        this.onMessageHandlers.forEach(h => h(data));
      }
    });

    // Any incoming event observer and counter
    this.socket.onAny((event: string, ...args: unknown[]) => {
      const payload = args[0];
      this.messagesIn += 1;
      this.onAnyHandlers.forEach(h => h(event, payload));
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  onMessage(handler: MessageHandler) {
    this.onMessageHandlers.add(handler);
    return () => this.onMessageHandlers.delete(handler);
  }

  onConnect(handler: () => void) {
    this.onConnectHandlers.add(handler);
    return () => this.onConnectHandlers.delete(handler);
  }

  onDisconnect(handler: (reason?: string) => void) {
    this.onDisconnectHandlers.add(handler);
    return () => this.onDisconnectHandlers.delete(handler);
  }

  /** Subscribe to ANY incoming event */
  onAny(handler: (event: string, payload: unknown) => void) {
    this.onAnyHandlers.add(handler);
    return () => this.onAnyHandlers.delete(handler);
  }

  /** Subscribe to ANY outgoing emit (via wsClient.emit) */
  onOutgoing(handler: (event: string, payload: unknown) => void) {
    this.onOutgoingHandlers.add(handler);
    return () => this.onOutgoingHandlers.delete(handler);
  }

  /** Stats snapshot */
  getStats() {
    return { messagesIn: this.messagesIn, messagesOut: this.messagesOut } as const;
  }
}

export const wsClient = new WSClient();
