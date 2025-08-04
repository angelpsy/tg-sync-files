/**
 * Database configuration utilities
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root .env file
config({ path: resolve(process.cwd(), '../.env') });

/**
 * Generate PostgreSQL connection URL from environment variables
 * @throws {Error} When POSTGRES_USER, POSTGRES_PASSWORD, or POSTGRES_DB are not provided
 * @returns PostgreSQL connection string
 */
export function generateDatabaseUrl(): string {
  const {
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST = 'localhost',
    POSTGRES_PORT = '5432',
    POSTGRES_DB
  } = process.env;

  // Validate critical fields
  if (!POSTGRES_USER) {
    throw new Error('POSTGRES_USER environment variable is required');
  }
  
  if (!POSTGRES_PASSWORD) {
    throw new Error('POSTGRES_PASSWORD environment variable is required');
  }
  
  if (!POSTGRES_DB) {
    throw new Error('POSTGRES_DB environment variable is required');
  }

  return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
}

/**
 * Get database configuration for Prisma
 */
export function getDatabaseConfig() {
  try {
    return {
      url: process.env.DATABASE_URL || generateDatabaseUrl()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database configuration error';
    throw new Error(`Database configuration failed: ${message}`);
  }
}
