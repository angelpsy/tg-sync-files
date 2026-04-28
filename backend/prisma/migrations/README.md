# SQLite mode note

This project runs Prisma in **SQLite sync mode** (`prisma db push`) instead of
`prisma migrate deploy`.

- Runtime bootstrap uses `pnpm prisma:sqlite:sync`.
- Docker startup uses `pnpm prisma:sqlite:sync`.
- Historical PostgreSQL migration files were moved to:
  `backend/prisma/migrations_archive/postgresql/`.

If you need schema changes, update `schema.prisma` and run:

```bash
pnpm --filter backend prisma:sqlite:sync
```
