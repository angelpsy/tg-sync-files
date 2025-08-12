'use client';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import type { HealthPayload } from '@/shared/api/http/health';
import { getHealth } from '@/shared/api/http/health';

export function HealthInline() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getHealth()
      .then(res => {
        if (mounted) setData(res);
      })
      .catch(e => setError(String(e)));
    const id = setInterval(() => {
      getHealth()
        .then(res => {
          if (mounted) setData(res);
        })
        .catch(e => setError(String(e)));
    }, 30000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (error) return <span className="text-xs text-destructive">health: error</span>;
  if (!data) return <span className="text-xs text-muted-foreground">health: …</span>;

  const uptimeSec = Number.isFinite(data.uptimeMs) ? Math.floor(data.uptimeMs / 1000) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>ver {data.version}</span>
      <Badge variant="outline" className="text-xs">
        {data.service}
      </Badge>
      <span title={data.timestamp}>uptime {uptimeSec}s</span>
    </div>
  );
}
