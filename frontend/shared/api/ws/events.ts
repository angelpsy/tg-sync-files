import type { EventPayloadMap, TEventName } from '@/types/websocket/events';

import { wsClient } from './client';

export type Unsubscribe = () => void;

export function on<E extends TEventName>(
  event: E,
  handler: (payload: EventPayloadMap[E]) => void
): Unsubscribe {
  return wsClient.onEvent(event, handler);
}

export function emit<E extends TEventName>(event: E, payload: EventPayloadMap[E]): void {
  wsClient.emit(event, payload);
}
