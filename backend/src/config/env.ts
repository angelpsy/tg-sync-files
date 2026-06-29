import { homedir } from 'os';
import { resolve } from 'path';

import { config as dotenvConfig } from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { z } from 'zod';

// Load + expand .env early (idempotent if already loaded elsewhere)
// Monorepo policy: use root .env (one level up from backend/)
const envResult = dotenvConfig({ path: resolve(process.cwd(), '../.env') });
dotenvExpand.expand(envResult);

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  BACKEND_WS_PORT: z.string().optional(),
  TELEGRAM_API_ID: z.string().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  TELEGRAM_CHANNEL_IDS: z.string().optional(),
  WATCH_PATHS: z.string().optional(),
  WATCH_DIR: z.string().optional(), // legacy / single dir variant
});

export type RawEnv = z.infer<typeof EnvSchema>;

export interface AppConfig {
  env: string;
  wsPort: number;
  telegramApiId?: number;
  telegramApiHash?: string;
  watchPaths: string[];
  channelIds?: string[];
}

function expandHomeDir(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return resolve(homedir(), path.slice(2));
  return path;
}

function normalizeWatchPath(path: string): string {
  const expanded = expandHomeDir(path.trim());
  return resolve(expanded);
}

function parseWatchPaths(value: string): string[] {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(normalizeWatchPath);
}

export function loadConfig(): AppConfig {
  const parsed = EnvSchema.parse(process.env as Record<string, string | undefined>);
  const wsPort = parsed.BACKEND_WS_PORT ? parseInt(parsed.BACKEND_WS_PORT, 10) : 0;
  const telegramApiId = parsed.TELEGRAM_API_ID ? parseInt(parsed.TELEGRAM_API_ID, 10) : undefined;
  const telegramApiHash = parsed.TELEGRAM_API_HASH;
  let watchPaths: string[] = [];
  const channelIds = parsed.TELEGRAM_CHANNEL_IDS
    ? parsed.TELEGRAM_CHANNEL_IDS.split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : undefined;
  if (parsed.WATCH_PATHS) {
    watchPaths = parseWatchPaths(parsed.WATCH_PATHS);
  } else if (parsed.WATCH_DIR) {
    watchPaths = parseWatchPaths(parsed.WATCH_DIR);
  }
  return {
    env: parsed.NODE_ENV,
    wsPort: Number.isFinite(wsPort) ? wsPort : 0,
    telegramApiId: telegramApiId && Number.isFinite(telegramApiId) ? telegramApiId : undefined,
    telegramApiHash,
    watchPaths,
    channelIds,
  };
}
