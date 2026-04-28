/**
 * Database configuration utilities
 */

import { resolve } from 'path';

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

/**
 * Get database configuration for Prisma
 */
export function getDatabaseConfig() {
  return {
    url: generateDatabaseUrl(),
  };
}
