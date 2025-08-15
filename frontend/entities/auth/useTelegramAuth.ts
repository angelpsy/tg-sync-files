'use client';
import type { ITelegramUserMinimal } from '@/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

type AuthStep = 'idle' | 'pending_code' | 'pending_password' | 'success' | 'error';
type User = ITelegramUserMinimal;

export function useTelegramAuth() {
  const [step, setStep] = useState<AuthStep>('idle');
  const [maskedPhone, setMaskedPhone] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [user, setUser] = useState<User | undefined>(undefined);

  useEffect(() => {
    const offs = [
      on('auth_pending_code', p => {
        setStep('pending_code');
        setMaskedPhone(p?.maskedPhone);
        setError(undefined);
      }),
      on('auth_pending_password', p => {
        setStep('pending_password');
        setMaskedPhone(p?.maskedPhone);
        setError(undefined);
      }),
      on('auth_success', p => {
        setStep('success');
        setMaskedPhone(p?.maskedPhone);
        setError(undefined);
      }),
      on('auth_error', p => {
        setStep('error');
        setError(p?.message || 'Authentication error');
      }),
      on('auth_state', s => {
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
    emit('auth_init', { phone });
  }, []);
  const submitCode = useCallback((code: string) => {
    emit('auth_code', { code });
  }, []);
  const submitPassword = useCallback((password: string) => {
    emit('auth_password', { password });
  }, []);

  const logout = useCallback(() => {
    emit('auth_logout', {} as never);
  }, []);

  // Ask server for current auth state on mount
  useEffect(() => {
    emit('request_auth_state', {} as never);
  }, []);

  return useMemo(
    () => ({ step, maskedPhone, error, user, start, submitCode, submitPassword, logout }),
    [step, maskedPhone, error, user, start, submitCode, submitPassword, logout]
  );
}
