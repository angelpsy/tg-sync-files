/**
 * Telegram domain models
 */

import type { TChannelConnectionStatus } from './enums.js';

/**
 * Telegram channel configuration
 */
export interface ITelegramChannel {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Topic within a channel
 */
export interface ITopic {
  id: string;
  name: string;
  channelId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Telegram session data
 */
export interface ITelegramSession {
  id: string;
  stringSession: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Channel status for WebSocket events
 */
export interface IChannelStatus {
  channelId: string;
  isConnected: boolean;
  lastSync?: Date;
  error?: string;
  status: TChannelConnectionStatus;
}
