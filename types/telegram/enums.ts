/**
 * Telegram domain enums
 */

/**
 * Telegram session status
 */
export const ETelegramSessionStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  EXPIRED: 'expired',
  CONNECTING: 'connecting',
  ERROR: 'error',
} as const;

export type TTelegramSessionStatus =
  (typeof ETelegramSessionStatus)[keyof typeof ETelegramSessionStatus];

/**
 * Channel connection status
 */
export const EChannelConnectionStatus = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  ERROR: 'error',
} as const;

export type TChannelConnectionStatus =
  (typeof EChannelConnectionStatus)[keyof typeof EChannelConnectionStatus];
