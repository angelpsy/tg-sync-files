'use client';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTelegramAuth } from '@/entities/auth/useTelegramAuth';

export function AuthPanel() {
  const { step, maskedPhone, error, user, start, submitCode, submitPassword, logout, reset } =
    useTelegramAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    console.log('AuthPanel: handleStart clicked', { phone });
    if (!phone.trim()) {
      console.warn('AuthPanel: phone is empty');
      return;
    }
    setIsLoading(true);
    console.log('AuthPanel: calling start(phone)');
    start(phone);
    // Success/error will be handled via events in hook,
    // but we can clear loading on step change or error.
  };

  const handleSubmitCode = () => {
    console.log('AuthPanel: handleSubmitCode clicked', { code });
    if (!code.trim()) {
      console.warn('AuthPanel: code is empty');
      return;
    }
    setIsLoading(true);
    console.log('AuthPanel: calling submitCode(code)');
    submitCode(code);
  };

  const handleSubmitPassword = () => {
    console.log('AuthPanel: handleSubmitPassword clicked');
    if (!password.trim()) {
      console.warn('AuthPanel: password is empty');
      return;
    }
    setIsLoading(true);
    console.log('AuthPanel: calling submitPassword(password)');
    submitPassword(password);
  };

  // Clear loading when step or error changes
  useEffect(() => {
    setIsLoading(false);
  }, [step, error]);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Telegram Authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {step === 'idle' && (
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
        )}

        {step === 'pending_code' && (
          <div className="space-y-2">
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
