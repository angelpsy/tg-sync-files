'use client';
import type { ITelegramUserMinimal } from '@/types';
import { WSEvent } from '@/types/websocket/events';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

type AuthStep = 'idle' | 'pending_code' | 'pending_password' | 'success' | 'error';
type User = ITelegramUserMinimal;

export function useTelegramAuthQuery() {
  const [step, setStep] = useState<AuthStep>('idle');
  const [maskedPhone, setMaskedPhone] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [user, setUser] = useState<User | undefined>(undefined);

  useEffect(() => {
    const offs = [
      on(WSEvent.AUTH_PENDING_CODE, p => {
        setStep('pending_code');
        setMaskedPhone(p?.maskedPhone);
        setError(undefined);
      }),
      on(WSEvent.AUTH_PENDING_PASSWORD, p => {
        setStep('pending_password');
        setMaskedPhone(p?.maskedPhone);
        setError(undefined);
      }),
      on(WSEvent.AUTH_SUCCESS, p => {
        setStep('success');
        setMaskedPhone(p?.maskedPhone);
        setError(undefined);
      }),
      on(WSEvent.AUTH_ERROR, p => {
        setStep('error');
        setError(p?.message || 'Authentication error');
      }),
      on(WSEvent.AUTH_STATE, s => {
        if (s?.isAuthenticated) {
          setStep('success');
          setUser(s.user);
        } else {
          setUser(undefined);
        }
      }),
    ];
    return () => offs.forEach(off => off());
  }, []);

  const start = useCallback((phone: string) => {
    emit(WSEvent.AUTH_INIT, { phone });
  }, []);
  const submitCode = useCallback((code: string) => {
    emit(WSEvent.AUTH_CODE, { code });
  }, []);
  const submitPassword = useCallback((password: string) => {
    emit(WSEvent.AUTH_PASSWORD, { password });
  }, []);

  const logout = useCallback(() => {
    emit(WSEvent.AUTH_LOGOUT, {} as never);
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setError(undefined);
  }, []);

  // Ask server for current auth state on mount
  useEffect(() => {
    emit(WSEvent.REQUEST_AUTH_STATE, {} as never);
  }, []);

  return useMemo(
    () => ({ step, maskedPhone, error, user, start, submitCode, submitPassword, logout, reset }),
    [step, maskedPhone, error, user, start, submitCode, submitPassword, logout, reset]
  );
}
