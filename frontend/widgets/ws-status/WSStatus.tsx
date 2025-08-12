'use client';
import { useSocket } from '@/shared/lib/providers/SocketProvider';

export function WSStatus() {
  const { connected, lastMessage } = useSocket();
  const dotClass = connected ? 'bg-green-500' : 'bg-amber-500';
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span>WS: {connected ? 'connected' : 'connecting...'}</span>
      </div>
      {lastMessage && <div className="mt-1 max-w-[260px] truncate">{String(lastMessage.type)}</div>}
    </div>
  );
}
