/**
 * WebSocket domain interfaces
 */

// Legacy specific event payload types removed from interface surface; use EventPayloadMap instead

import type { EventPayloadMap, TEventName } from './events.js';
import type { IWSConnectionInfo, IWSMessage } from './models.js';

/**
 * Socket Service Interface
 * Manages WebSocket connections and real-time communication
 */
export interface ISocketService {
  /**
   * Initializes WebSocket server
   */
  initialize(): Promise<void>;

  /**
   * Broadcasts message to all connected clients
   */
  broadcast<T>(message: IWSMessage<T>): Promise<void>;

  /**
   * Sends message to specific client
   */
  sendToClient<T>(clientId: string, message: IWSMessage<T>): Promise<void>;

  /** Generic emit by event name */
  emit<E extends TEventName>(event: E, payload: EventPayloadMap[E]): void;

  /**
   * Gets connected clients
   */
  getConnectedClients(): Promise<IWSConnectionInfo[]>;

  /**
   * Disconnects client
   */
  disconnectClient(clientId: string): Promise<void>;

  /**
   * Sets up event handlers
   */
  onConnection(handler: (connectionInfo: IWSConnectionInfo) => void): void;
  onDisconnection(handler: (connectionInfo: IWSConnectionInfo) => void): void;
  onMessage<T>(handler: (clientId: string, message: IWSMessage<T>) => void): void;
  offConnection(handler: (connectionInfo: IWSConnectionInfo) => void): void;
  offDisconnection(handler: (connectionInfo: IWSConnectionInfo) => void): void;
  offMessage<T>(handler: (clientId: string, message: IWSMessage<T>) => void): void;

  /**
   * Subscribes to client connections
   */
  onClientConnect(handler: (clientId: string) => void): void;
  offClientConnect(handler: (clientId: string) => void): void;

  /** Returns runtime stats */
  getStats(): {
    connections: number;
    messagesIn: number;
    messagesOut: number;
    startedAt: Date;
    uptimeMs: number;
    errors: number;
    rateLimitDrops: number;
  };

  /**
   * Shuts down WebSocket server
   */
  shutdown(): Promise<void>;
}
