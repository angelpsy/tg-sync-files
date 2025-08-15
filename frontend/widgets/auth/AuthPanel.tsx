'use client';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTelegramAuth } from '@/entities/auth/useTelegramAuth';

export function AuthPanel() {
  const { step, maskedPhone, error, user, start, submitCode, submitPassword, logout } =
    useTelegramAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

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
              placeholder="Phone number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <Button size="sm" onClick={() => start(phone)} disabled={!phone}>
              Send code
            </Button>
          </div>
        )}

        {step === 'pending_code' && (
          <div className="flex items-center gap-2">
            <input
              className="flex-1 border rounded px-2 py-1 bg-background"
              placeholder={`Code for ${maskedPhone || 'phone'}`}
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            <Button size="sm" onClick={() => submitCode(code)} disabled={!code}>
              Confirm
            </Button>
          </div>
        )}

        {step === 'pending_password' && (
          <div className="flex items-center gap-2">
            <input
              className="flex-1 border rounded px-2 py-1 bg-background"
              placeholder="2FA Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <Button size="sm" onClick={() => submitPassword(password)} disabled={!password}>
              Sign in
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
        {step === 'error' && <div className="text-red-600">{error}</div>}
      </CardContent>
    </Card>
  );
}
