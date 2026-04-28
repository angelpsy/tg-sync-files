#!/bin/bash

# Development Startup Script
echo "🚀 Starting development environment..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# 2. Generate Prisma Client
echo "💎 Generating Prisma Client..."
pnpm -r prisma:generate

# 3. Start development servers
echo "📡 Starting servers..."
pnpm dev
