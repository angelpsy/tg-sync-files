'use client';
import type {
  ITelegramAuthCodeDelivery,
  ITelegramQrAuthToken,
  ITelegramUserMinimal,
} from '@/types';
import { WSEvent } from '@/types/websocket/events';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { emit, on } from '@/shared/api/ws/events';

type AuthStep = 'idle' | 'pending_qr' | 'pending_code' | 'pending_password' | 'success' | 'error';
type User = ITelegramUserMinimal;

export function useTelegramAuthQuery() {
  const [step, setStep] = useState<AuthStep>('idle');
  const [maskedPhone, setMaskedPhone] = useState<string | undefined>(undefined);
  const [delivery, setDelivery] = useState<ITelegramAuthCodeDelivery | undefined>(undefined);
  const [qrAuth, setQrAuth] = useState<ITelegramQrAuthToken | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [user, setUser] = useState<User | undefined>(undefined);

  useEffect(() => {
    const offs = [
      on(WSEvent.AUTH_PENDING_CODE, p => {
        setStep('pending_code');
        setMaskedPhone(p?.maskedPhone);
        setDelivery(p?.delivery);
        setQrAuth(undefined);
        setError(undefined);
      }),
      on(WSEvent.AUTH_QR_CODE, p => {
        setStep('pending_qr');
        setQrAuth(p);
        setDelivery(undefined);
        setError(undefined);
      }),
      on(WSEvent.AUTH_PENDING_PASSWORD, p => {
        setStep('pending_password');
        setMaskedPhone(p?.maskedPhone);
        setQrAuth(undefined);
        setError(undefined);
      }),
      on(WSEvent.AUTH_SUCCESS, p => {
        setStep('success');
        setMaskedPhone(p?.maskedPhone);
        setDelivery(undefined);
        setQrAuth(undefined);
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
  const startQr = useCallback(() => {
    emit(WSEvent.AUTH_QR_INIT, {} as never);
  }, []);
  const cancelQr = useCallback(() => {
    emit(WSEvent.AUTH_QR_CANCEL, {} as never);
  }, []);
  const submitCode = useCallback((code: string) => {
    emit(WSEvent.AUTH_CODE, { code });
  }, []);
  const resendCode = useCallback(() => {
    emit(WSEvent.AUTH_RESEND_CODE, {} as never);
  }, []);
  const submitPassword = useCallback((password: string) => {
    emit(WSEvent.AUTH_PASSWORD, { password });
  }, []);

  const logout = useCallback(() => {
    emit(WSEvent.AUTH_LOGOUT, {} as never);
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setDelivery(undefined);
    setQrAuth(undefined);
    setError(undefined);
  }, []);

  // Ask server for current auth state on mount
  useEffect(() => {
    emit(WSEvent.REQUEST_AUTH_STATE, {} as never);
  }, []);

  return useMemo(
    () => ({
      step,
      maskedPhone,
      delivery,
      qrAuth,
      error,
      user,
      start,
      startQr,
      cancelQr,
      resendCode,
      submitCode,
      submitPassword,
      logout,
      reset,
    }),
    [
      step,
      maskedPhone,
      delivery,
      qrAuth,
      error,
      user,
      start,
      startQr,
      cancelQr,
      resendCode,
      submitCode,
      submitPassword,
      logout,
      reset,
    ]
  );
}
