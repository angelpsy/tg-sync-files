# Telegram File Sync — Experimental MVP

## IMPORTANT DISCLAIMER

This repository's code was generated and/or heavily assisted by AI. It is
experimental and intended as a working MVP. The code likely contains errors,
inaccuracies, incomplete edge-case handling, and security issues. Use it for
learning and prototyping only — do not run it in production without a full
security review and thorough testing.

## What this project is

Telegram File Sync is an experimental application that synchronizes files
between Telegram and local/cloud storage. It provides a web UI and a backend
service that interacts with Telegram via MTProto (gramJS), stores metadata in
PostgreSQL (Prisma), and uses WebSocket (Socket.IO) for realtime updates. The
project follows Feature-Sliced Design and Clean Architecture principles.

## High-level architecture and tech stack

- Frontend: Next.js (TypeScript), shadcn/ui, Tailwind CSS
- Backend: Node.js (TypeScript), Express / Socket.IO
- Database: PostgreSQL with Prisma ORM
- Telegram integration: gramJS (MTProto)
- Realtime: WebSockets (Socket.IO)

## Key folders

- `backend/` — backend service source, API, WebSocket server, Prisma config
- `frontend/` — Next.js frontend and UI components
- `prisma/` — Prisma schema and migrations
- `docs/` — design docs and the project specification (see
  `docs/specification.md`)

## Quick start (developer)

These are minimal steps to run the project locally for development. This repo
uses pnpm workspaces.

1. Install dependencies

```bash
pnpm install
```

2. Prepare environment

- Create a `.env` in the repository root containing required environment
  variables (database URL, Telegram credentials, etc.). The project expects
  environment variables to be declared at the repo root.

3. Run services

- Backend (from repo root or `backend/`):

```bash
pnpm --filter ./backend... dev
# or: cd backend && pnpm dev
```

- Frontend (from repo root or `frontend/`):

```bash
pnpm --filter ./frontend... dev
# or: cd frontend && pnpm dev
```

## Notes

- The above commands assume existing scripts in the package.json files — check
  `package.json` at the repo root and in `backend/` and `frontend/` for exact
  script names.
- All environment variables must be provided in the root `.env` file. Do not
  commit secrets.

## Documentation and specification

See `docs/specification.md` for a detailed specification and design notes. Other
docs and the architecture overview live in the `docs/` folder.

## Known limitations

- AI-authored code: the repository was written with heavy AI assistance and is
  known to contain bugs and incomplete implementations.
- Security, concurrency, and edge cases may be unhandled. Treat this as an MVP
  prototype.

## Contributing

Contributions are welcome. If you open a PR, please include tests, a clear
description of the change, and keep the scope small. For larger design changes,
open an issue first to discuss.

## License

See the repository license file if present. If there is no license yet, assume
no permission is granted for commercial use until a license is added.

## Contact

For questions or to discuss the project, check the repository issues or contact
the maintainers listed in the project metadata.

-- This README was added automatically; update it as the project matures.
