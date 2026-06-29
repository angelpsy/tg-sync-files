import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

import type { PrismaClient } from '@prisma/client';

interface LoggerLike {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

function resolveBackendRoot(): string {
  const candidates = [process.cwd(), resolve(process.cwd(), 'backend')];
  const found = candidates.find(candidate =>
    existsSync(resolve(candidate, 'prisma', 'schema.prisma'))
  );
  return found ?? process.cwd();
}

export function runPrismaDbPush(logger: LoggerLike): void {
  const backendRoot = resolveBackendRoot();
  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(pnpmCmd, ['prisma:sqlite:sync'], {
    cwd: backendRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    throw new Error(
      `Prisma db push failed: ${stderr || stdout || 'unknown error (exit code non-zero)'}`
    );
  }

  logger.info('Prisma schema synchronized', {
    cwd: backendRoot,
    output: (result.stdout ?? '').trim(),
  });
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: unknown }).code;
  if (maybeCode === 'P2021') return true;
  const maybeMessage = (error as { message?: unknown }).message;
  const maybeMetaMessage = (error as { meta?: { message?: unknown } }).meta?.message;
  const messages = [maybeMessage, maybeMetaMessage].filter(
    (message): message is string => typeof message === 'string'
  );

  return messages.some(
    message =>
      message.includes('does not exist in the current database') ||
      message.includes('no such table:')
  );
}

export async function ensureDatabaseSchema(
  prisma: PrismaClient,
  logger: LoggerLike
): Promise<void> {
  await prisma.$connect();

  try {
    // Check if a known table exists
    await prisma.$queryRawUnsafe('SELECT 1 FROM telegram_sessions LIMIT 1');
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }

    logger.warn('Database tables are missing, running Prisma db push');
    await prisma.$disconnect();
    runPrismaDbPush(logger);
    await prisma.$connect();
  }
}
