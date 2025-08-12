/**
 * WS protocol helpers for frontend
 */

import { EWSConnectionStatus, EWSMessageType } from '@/types/websocket/enums';
import { WS_PROTOCOL_VERSION } from '@/types/websocket/events';
import type { IWSMessage } from '@/types/websocket/models';

export type { IWSMessage };

/**
 * Build a typed WS message
 */
export function buildMessage<T>(type: keyof typeof EWSMessageType, payload: T): IWSMessage<T> {
  return {
    type: EWSMessageType[type],
    payload,
    timestamp: Date.now(),
    protocolVersion: WS_PROTOCOL_VERSION,
  } as IWSMessage<T>;
}

/**
 * Guard to ensure incoming data looks like a message
 */
export function isWSMessage(value: unknown): value is IWSMessage<unknown> {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.type === 'string' && 'payload' in v && typeof v.timestamp === 'number';
}

export const ConnectionStatus = EWSConnectionStatus;
