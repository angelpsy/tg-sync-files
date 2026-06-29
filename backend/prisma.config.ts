import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';

const backendRoot = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_SQLITE_URL = 'file:./dev.db';

function normalizeSqliteDatabaseUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const sqlitePath = databaseUrl.replace(/^file:/, '');
  if (sqlitePath === ':memory:' || isAbsolute(sqlitePath)) {
    return databaseUrl;
  }

  return `file:${resolve(backendRoot, 'prisma', sqlitePath)}`;
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_SQLITE_URL;
  return normalizeSqliteDatabaseUrl(databaseUrl);
}

const schemaPath = 'prisma/schema.prisma';

if (!existsSync(resolve(backendRoot, schemaPath))) {
  throw new Error(`Prisma schema not found at ${schemaPath}`);
}

export default defineConfig({
  schema: schemaPath,
  datasource: {
    url: getDatabaseUrl(),
  },
});
