/**
 * Database configuration tests
 */

import { generateDatabaseUrl, getDatabaseConfig } from '../database';

describe('Database Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('generateDatabaseUrl', () => {
    it('should use DATABASE_URL when provided', () => {
      process.env.DATABASE_URL = 'file:./custom.sqlite';

      const url = generateDatabaseUrl();
      expect(url).toBe('file:./custom.sqlite');
    });

    it('should use sqlite default when DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL;

      const url = generateDatabaseUrl();
      expect(url).toBe('file:./dev.db');
    });
  });

  describe('getDatabaseConfig', () => {
    it('should return DATABASE_URL in config', () => {
      process.env.DATABASE_URL = 'file:./runtime.db';

      const config = getDatabaseConfig();
      expect(config.url).toBe('file:./runtime.db');
    });

    it('should return sqlite default in config', () => {
      delete process.env.DATABASE_URL;

      const config = getDatabaseConfig();
      expect(config.url).toBe('file:./dev.db');
    });
  });
});
