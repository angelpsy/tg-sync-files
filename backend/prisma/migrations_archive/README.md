# Migration archive

This folder stores historical migration files that are no longer used by the
runtime bootstrap.

- Active mode: SQLite + `prisma db push`
- Archived mode: PostgreSQL `migrate deploy` history

Archived migrations are kept for traceability and should not be executed in the
current SQLite setup.
