/**
 * WebSocket domain interfaces
 */

import type { IFileSyncEvent, IUploadProgress } from '../file-sync/index.js';
import type { IChannelStatus } from '../telegram/index.js';

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

  /**
   * Emits file sync event
   */
  emitFileSync(event: IFileSyncEvent): void;

  /**
   * Emits upload progress
   */
  emitUploadProgress(progress: IUploadProgress): void;

  /**
   * Emits channel status
   */
  emitChannelStatus(status: IChannelStatus): void;

  /**
   * Subscribes to client connections
   */
  onClientConnect(handler: (clientId: string) => void): void;

  /**
   * Shuts down WebSocket server
   */
  shutdown(): Promise<void>;
}
