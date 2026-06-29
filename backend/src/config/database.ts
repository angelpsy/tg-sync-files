/**
 * Database configuration utilities
 */

import { existsSync } from 'fs';
import { isAbsolute, resolve } from 'path';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { config } from 'dotenv';

// Load environment variables from root .env file
config({ path: resolve(process.cwd(), '../.env') });

const DEFAULT_SQLITE_URL = 'file:./dev.db';

/**
 * Returns SQLite URL for Prisma.
 * Uses DATABASE_URL when provided, otherwise falls back to local file DB.
 */
export function generateDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || DEFAULT_SQLITE_URL;
}

function resolveBackendRoot(): string {
  const candidates = [process.cwd(), resolve(process.cwd(), 'backend')];
  const found = candidates.find(candidate =>
    existsSync(resolve(candidate, 'prisma', 'schema.prisma'))
  );
  return found ?? process.cwd();
}

export function normalizeSqliteDatabaseUrl(databaseUrl = generateDatabaseUrl()): string {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const sqlitePath = databaseUrl.replace(/^file:/, '');
  if (sqlitePath === ':memory:' || isAbsolute(sqlitePath)) {
    return databaseUrl;
  }

  return `file:${resolve(resolveBackendRoot(), 'prisma', sqlitePath)}`;
}

export function createPrismaAdapter() {
  return new PrismaBetterSqlite3({ url: normalizeSqliteDatabaseUrl() });
}

/**
 * Get database configuration for Prisma
 */
export function getDatabaseConfig() {
  return {
    url: normalizeSqliteDatabaseUrl(),
  };
}
