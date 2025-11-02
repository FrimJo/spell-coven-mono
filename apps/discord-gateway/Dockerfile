# Discord Gateway Service Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
COPY apps/discord-gateway/package.json ./apps/discord-gateway/
COPY packages/discord-gateway/package.json ./packages/discord-gateway/
COPY packages/discord-integration/package.json ./packages/discord-integration/

# Install dependencies
RUN npm install -g bun
RUN bun install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build packages first
RUN cd packages/discord-integration && bun run build
RUN cd packages/discord-gateway && bun run build

# Build the gateway service
RUN cd apps/discord-gateway && bun run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/apps/discord-gateway/dist ./dist
COPY --from=builder /app/apps/discord-gateway/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose WebSocket port
EXPOSE 8080

# Run the service
CMD ["node", "dist/index.js"]
