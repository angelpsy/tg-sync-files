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

  /** Emit a typed event to the server */
  emit<E extends TEventName>(event: E, payload: EventPayloadMap[E]): void {
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
}

export const wsClient = new WSClient();
