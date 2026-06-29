#!/bin/bash

set -e

# Resolve repository root regardless of where script is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Production Startup Script
echo "🏗️ Starting production environment..."

# 1. Install dependencies (frozen-lockfile)
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# 2. Sync SQLite schema and generate Prisma Client
echo "🧬 Synchronizing SQLite schema..."
pnpm --filter backend prisma:sqlite:sync

# 3. Build the project
echo "🛠️ Building project..."
pnpm build

# 4. Start production environment
echo "🚀 Starting production environment (Backend + Frontend)..."
# Use concurrently via pnpm so it works without hardcoded node_modules path
pnpm exec concurrently \
  -n "BACKEND,FRONTEND" \
  -c "magenta,blue" \
  "pnpm --filter backend start" \
  "pnpm --filter frontend start"
