import { resolve } from 'path';

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load .env early (idempotent if already loaded elsewhere)
dotenvConfig({ path: resolve(process.cwd(), '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  BACKEND_WS_PORT: z.string().optional(),
  TELEGRAM_API_ID: z.string().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  WATCH_PATHS: z.string().optional(),
});

export type RawEnv = z.infer<typeof EnvSchema>;

export interface AppConfig {
  env: string;
  wsPort: number;
  telegramApiId?: number;
  telegramApiHash?: string;
  watchPaths: string[];
}

export function loadConfig(): AppConfig {
  const parsed = EnvSchema.parse(process.env as Record<string, string | undefined>);
  const wsPort = parsed.BACKEND_WS_PORT ? parseInt(parsed.BACKEND_WS_PORT, 10) : 0;
  const telegramApiId = parsed.TELEGRAM_API_ID ? parseInt(parsed.TELEGRAM_API_ID, 10) : undefined;
  const telegramApiHash = parsed.TELEGRAM_API_HASH;
  const watchPaths = parsed.WATCH_PATHS
    ? parsed.WATCH_PATHS.split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : [];
  return {
    env: parsed.NODE_ENV,
    wsPort: Number.isFinite(wsPort) ? wsPort : 0,
    telegramApiId: telegramApiId && Number.isFinite(telegramApiId) ? telegramApiId : undefined,
    telegramApiHash,
    watchPaths,
  };
}
