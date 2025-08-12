export interface HealthPayload {
  status: 'healthy' | 'ok';
  service: string;
  version: string;
  uptimeMs: number;
  timestamp: string;
}

interface HealthEnvelope {
  success: boolean;
  data: HealthPayload;
}

export async function getHealth(): Promise<HealthPayload> {
  const res = await fetch('/api/health', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  const body = (await res.json()) as HealthEnvelope;
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new Error('Invalid health response');
  }
  return body.data;
}

export function useHealth(): Promise<HealthPayload> {
  return getHealth();
}
