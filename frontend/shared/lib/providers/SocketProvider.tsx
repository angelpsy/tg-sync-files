'use client';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { wsClient } from '@/shared/api/ws/client';
import type { IWSMessage } from '@/shared/api/ws/protocol';

interface SocketContextValue {
  connected: boolean;
  lastMessage?: IWSMessage<unknown>;
}

const SocketContext = createContext<SocketContextValue>({ connected: false });

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<IWSMessage<unknown>>();

  useEffect(() => {
    const raw = process.env.NEXT_PUBLIC_WS_ENDPOINT;
    const url = !raw || /\$\{[^}]+\}/.test(raw) ? 'ws://localhost:4000' : raw;
    wsClient.connect({ url });

    const offMsg = wsClient.onMessage(msg => setLastMessage(msg));
    const offCon = wsClient.onConnect(() => setConnected(true));
    const offDis = wsClient.onDisconnect(() => setConnected(false));

    return () => {
      offMsg();
      offCon();
      offDis();
      wsClient.disconnect();
    };
  }, []);

  const value = useMemo(() => ({ connected, lastMessage }), [connected, lastMessage]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
