'use client';
import type { ITelegramAuthCodeDelivery } from '@/types';
import { QrCode, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTelegramAuthQuery } from '@/entities/auth';

function getDeliveryMessage(delivery: ITelegramAuthCodeDelivery | undefined, maskedPhone?: string) {
  const target = maskedPhone ? ` for ${maskedPhone}` : '';

  switch (delivery?.type) {
    case 'app':
      return `Telegram sent this code to an already logged-in Telegram app${target}, not by SMS.`;
    case 'sms':
      return `Check SMS${target}.`;
    case 'call':
      return `Telegram will call${target}.`;
    case 'flash_call':
      return `Watch for an incoming Telegram flash call${target}.`;
    case 'missed_call':
      return `Check the missed call from Telegram${target}.`;
    case 'email':
      return `Check email${delivery.pattern ? ` (${delivery.pattern})` : ''}.`;
    case 'email_setup':
      return 'Telegram requires email setup before this login can continue.';
    case 'fragment_sms':
      return `Check Fragment SMS${target}.`;
    case 'firebase_sms':
      return `Check SMS on the device with this phone number${target}.`;
    case 'sms_word':
      return 'Enter the word sent by SMS.';
    case 'sms_phrase':
      return 'Enter the phrase sent by SMS.';
    default:
      return `Code requested${target}. Check Telegram app first, then SMS.`;
  }
}

function getNextDeliveryMessage(delivery: ITelegramAuthCodeDelivery | undefined) {
  if (!delivery) return undefined;
  if (delivery.resendUnavailable) {
    return 'Telegram rejected another code for this login attempt. The current code is only available inside Telegram app sessions.';
  }
  if (!delivery.nextLabel) {
    return 'Telegram did not report an automatic fallback method for this attempt.';
  }
  const waitText =
    typeof delivery.timeoutSec === 'number' ? ` in about ${delivery.timeoutSec}s` : '';
  return `Next available method: ${delivery.nextLabel}${waitText}.`;
}

export function AuthPanel() {
  const {
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
  } = useTelegramAuthQuery();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const nextDeliveryMessage = getNextDeliveryMessage(delivery);
  const isResendUnavailable = Boolean(delivery?.resendUnavailable);
  const qrExpiresIn =
    qrAuth?.expiresAt !== undefined
      ? Math.max(0, Math.ceil((Date.parse(qrAuth.expiresAt) - now) / 1000))
      : undefined;

  const handleStart = async () => {
    if (!phone.trim()) {
      return;
    }
    setIsLoading(true);
    start(phone);
    // Success/error will be handled via events in hook,
    // but we can clear loading on step change or error.
  };

  const handleStartQr = () => {
    setIsLoading(true);
    startQr();
  };

  const handleCancelQr = () => {
    cancelQr();
    reset();
  };

  const handleSubmitCode = () => {
    if (!code.trim()) {
      return;
    }
    setIsLoading(true);
    submitCode(code);
  };

  const handleResendCode = () => {
    setIsLoading(true);
    resendCode();
  };

  const handleSubmitPassword = () => {
    if (!password.trim()) {
      return;
    }
    setIsLoading(true);
    submitPassword(password);
  };

  // Clear loading when step or error changes
  useEffect(() => {
    setIsLoading(false);
  }, [step, error, qrAuth?.url]);

  useEffect(() => {
    if (step !== 'pending_qr' || !qrAuth?.url) {
      setQrDataUrl(undefined);
      return;
    }

    let isActive = true;
    QRCode.toDataURL(qrAuth.url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 224,
    })
      .then(dataUrl => {
        if (isActive) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (isActive) setQrDataUrl(undefined);
      });

    return () => {
      isActive = false;
    };
  }, [qrAuth?.url, step]);

  useEffect(() => {
    if (step !== 'pending_qr') return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step, qrAuth?.expiresAt]);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Telegram Authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {step === 'idle' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 border rounded px-2 py-1 bg-background"
                placeholder="Phone (e.g. +123456789)"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={isLoading}
              />
              <Button size="sm" onClick={handleStart} disabled={isLoading || !phone}>
                {isLoading ? 'Sending...' : 'Send code'}
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={handleStartQr}
              disabled={isLoading}
              title="Sign in by scanning a Telegram QR code"
            >
              <QrCode className="h-3.5 w-3.5" />
              {isLoading ? 'Preparing...' : 'QR login'}
            </Button>
          </div>
        )}

        {step === 'pending_qr' && (
          <div className="space-y-3">
            <div className="flex flex-col items-start gap-3 sm:flex-row">
              <div className="flex h-60 w-60 shrink-0 items-center justify-center rounded border bg-white p-2">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Telegram QR login" className="h-56 w-56" />
                ) : (
                  <span className="text-xs text-muted-foreground">Generating QR...</span>
                )}
              </div>
              <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                <div className="text-sm text-foreground">Scan this QR in Telegram.</div>
                <div>Telegram app: Settings, Devices, Link Desktop Device.</div>
                {typeof qrExpiresIn === 'number' && <div>Expires in: {qrExpiresIn}s</div>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={handleStartQr}
                disabled={isLoading}
                title="Request a fresh QR login token"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {isLoading ? 'Refreshing...' : 'Refresh QR'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancelQr}>
                Back to phone entry
              </Button>
            </div>
          </div>
        )}

        {step === 'pending_code' && (
          <div className="space-y-2">
            <div className="text-xs leading-relaxed text-muted-foreground">
              <div className="text-foreground">{getDeliveryMessage(delivery, maskedPhone)}</div>
              {typeof delivery?.length === 'number' && (
                <div>Expected code length: {delivery.length}</div>
              )}
              {nextDeliveryMessage && <div>{nextDeliveryMessage}</div>}
            </div>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 border rounded px-2 py-1 bg-background"
                placeholder={`Code for ${maskedPhone || 'phone'}`}
                value={code}
                onChange={e => setCode(e.target.value)}
                disabled={isLoading}
              />
              <Button size="sm" onClick={handleSubmitCode} disabled={isLoading || !code}>
                {isLoading ? 'Confirming...' : 'Confirm'}
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={handleResendCode}
              disabled={isLoading || isResendUnavailable}
              title="Ask Telegram to send a new login code for this auth attempt"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {isLoading ? 'Requesting...' : 'Request code again'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={reset}>
              Back to phone entry
            </Button>
          </div>
        )}

        {step === 'pending_password' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 border rounded px-2 py-1 bg-background"
                placeholder="2FA Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <Button size="sm" onClick={handleSubmitPassword} disabled={isLoading || !password}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={reset}>
              Back to phone entry
            </Button>
          </div>
        )}

        {step === 'success' && (
          <div className="flex items-center justify-between text-green-600">
            <div>
              Authenticated: {user?.displayName || maskedPhone}
              {user?.username ? ` (@${user.username})` : ''}
            </div>
            <Button size="sm" variant="outline" onClick={logout}>
              Logout
            </Button>
          </div>
        )}
        {step === 'error' && (
          <div className="space-y-2">
            <div className="text-red-500 font-medium">{error}</div>
            <Button size="sm" variant="outline" onClick={reset} className="h-7 text-xs">
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
