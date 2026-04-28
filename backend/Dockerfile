# Backend WebSocket Server Dockerfile
FROM node:24-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy root package.json and workspace files
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy shared types
COPY types/ ./types/

# Copy backend package.json
COPY backend/package.json ./backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy backend source code
COPY backend/ ./backend/

# Generate Prisma client
WORKDIR /app/backend
RUN pnpm prisma:sqlite:generate

# Build TypeScript
RUN pnpm build

# Expose WebSocket port
EXPOSE 4000

# Start WebSocket server
CMD ["sh", "-c", "pnpm prisma:sqlite:sync && pnpm start:ws"]
