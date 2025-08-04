# Frontend Next.js BFF Dockerfile
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

# Copy frontend package.json
COPY frontend/package.json ./frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./frontend/

# Add build args for Next.js environment variables
ARG NEXT_PUBLIC_WS_ENDPOINT
ARG FRONTEND_PORT
ENV NEXT_PUBLIC_WS_ENDPOINT=$NEXT_PUBLIC_WS_ENDPOINT
ENV FRONTEND_PORT=$FRONTEND_PORT

# Build Next.js application
WORKDIR /app/frontend
RUN pnpm build

# Expose frontend port
EXPOSE $FRONTEND_PORT

# Start Next.js server (BFF API only)
CMD ["sh", "-c", "pnpm start -p $FRONTEND_PORT"]
