/**
 * WebSocket domain models
 */

import type { TWSConnectionStatus, TWSMessageType } from './enums';

/**
 * WebSocket message structure
 */
export interface IWSMessage<T = unknown> {
  type: TWSMessageType;
  payload: T;
  timestamp: number;
  id?: string;
}

/**
 * WebSocket connection info
 */
export interface IWSConnectionInfo {
  id: string;
  status: TWSConnectionStatus;
  connectedAt: Date;
  lastPing?: Date;
  userAgent?: string;
  ip?: string;
}

/**
 * WebSocket error payload
 */
export interface IWSErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
