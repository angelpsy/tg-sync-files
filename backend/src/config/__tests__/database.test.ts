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
    it('should generate URL with all required fields', () => {
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';
      process.env.POSTGRES_DB = 'testdb';
      process.env.POSTGRES_HOST = 'testhost';
      process.env.POSTGRES_PORT = '5433';

      const url = generateDatabaseUrl();
      expect(url).toBe('postgresql://testuser:testpass@testhost:5433/testdb');
    });

    it('should use default host and port', () => {
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';
      process.env.POSTGRES_DB = 'testdb';

      const url = generateDatabaseUrl();
      expect(url).toBe('postgresql://testuser:testpass@localhost:5432/testdb');
    });

    it('should throw error when POSTGRES_USER is missing', () => {
      process.env.POSTGRES_PASSWORD = 'testpass';
      process.env.POSTGRES_DB = 'testdb';

      expect(() => generateDatabaseUrl()).toThrow('POSTGRES_USER environment variable is required');
    });

    it('should throw error when POSTGRES_PASSWORD is missing', () => {
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_DB = 'testdb';

      expect(() => generateDatabaseUrl()).toThrow(
        'POSTGRES_PASSWORD environment variable is required'
      );
    });

    it('should throw error when POSTGRES_DB is missing', () => {
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';

      expect(() => generateDatabaseUrl()).toThrow('POSTGRES_DB environment variable is required');
    });
  });

  describe('getDatabaseConfig', () => {
    it('should use DATABASE_URL when provided', () => {
      process.env.DATABASE_URL = 'postgresql://custom:url@host:5432/db';

      const config = getDatabaseConfig();
      expect(config.url).toBe('postgresql://custom:url@host:5432/db');
    });

    it('should generate URL when DATABASE_URL is not provided', () => {
      delete process.env.DATABASE_URL;
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';
      process.env.POSTGRES_DB = 'testdb';

      const config = getDatabaseConfig();
      expect(config.url).toBe('postgresql://testuser:testpass@localhost:5432/testdb');
    });

    it('should throw wrapped error when configuration fails', () => {
      delete process.env.DATABASE_URL;
      delete process.env.POSTGRES_USER;

      expect(() => getDatabaseConfig()).toThrow(
        'Database configuration failed: POSTGRES_USER environment variable is required'
      );
    });
  });
});
