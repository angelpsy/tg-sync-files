#!/bin/bash

set -e

# Resolve repository root regardless of where script is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Development Startup Script
echo "🚀 Starting development environment..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# 2. Sync SQLite schema and generate Prisma Client
echo "🧬 Synchronizing SQLite schema..."
pnpm --filter backend prisma:sqlite:sync

# 3. Start development servers
echo "📡 Starting servers..."
pnpm dev
