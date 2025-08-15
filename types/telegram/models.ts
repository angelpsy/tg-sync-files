/**
 * Telegram domain models
 */

import type { TChannelConnectionStatus } from './enums.js';

/** Telegram channel configuration */
export interface ITelegramChannel {
  id: string;
  title: string;
  name?: string; // Alias for title for backward compatibility
  username?: string;
  accessHash?: string;
  isGroup: boolean;
  isForum: boolean;
  participantsCount: number;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Forum topic inside a channel */
export interface ITopic {
  id: string;
  channelId: string;
  title: string;
  name?: string; // Alias for title for backward compatibility
  iconColor?: number;
  iconEmojiId?: string;
  isGeneral: boolean;
  isClosed: boolean;
  isHidden: boolean;
  totalMessages: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Persisted Telegram MTProto session */
export interface ITelegramSession {
  id: string;
  sessionData: string; // Renamed from stringSession
  stringSession?: string; // For backward compatibility
  phoneNumber?: string;
  isActive: boolean;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal user info for UI */
export interface ITelegramUserMinimal {
  id: string;
  username?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
}

/** Channel connection / sync status */
export interface IChannelStatus {
  channelId: string;
  isConnected: boolean;
  lastSync?: Date;
  error?: string;
  status: TChannelConnectionStatus;
}
