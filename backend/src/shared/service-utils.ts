import type { EventPayloadMap, ISocketService, TEventName } from '../../../types/index.js';

export function hasDestroy(svc: unknown): svc is { destroy: () => Promise<void> } {
  return (
    typeof svc === 'object' &&
    svc !== null &&
    'destroy' in svc &&
    typeof (svc as { destroy: unknown }).destroy === 'function'
  );
}

export function hasHealthProvider(
  svc: ISocketService
): svc is ISocketService & { setHealthProvider: (fn: () => unknown) => void } {
  return typeof (svc as { setHealthProvider?: unknown }).setHealthProvider === 'function';
}

export function hasShutdown(
  svc: ISocketService
): svc is ISocketService & { shutdown: () => Promise<void> } {
  return typeof (svc as { shutdown?: unknown }).shutdown === 'function';
}

export function hasInbound(svc: ISocketService): svc is ISocketService & {
  onInbound: <E extends TEventName>(
    event: E,
    handler: (clientId: string, payload: EventPayloadMap[E]) => void
  ) => void;
} {
  return typeof (svc as { onInbound?: unknown }).onInbound === 'function';
}
