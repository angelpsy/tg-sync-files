# Frontend Next.js BFF Dockerfile
FROM node:24-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy root package.json and workspace files
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Copy shared types
COPY types/ ./types/

# Copy frontend package.json
COPY frontend/package.json ./frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./frontend/

# Build Next.js application
WORKDIR /app/frontend
RUN pnpm build

# Expose frontend port
EXPOSE 3000

# Start Next.js server (BFF API only)
CMD ["pnpm", "start"]
