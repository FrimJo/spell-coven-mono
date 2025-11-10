# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo files
COPY package.json bun.lockb ./
COPY apps/peerjs-server ./apps/peerjs-server
COPY packages ./packages

# Install dependencies
RUN npm install --frozen-lockfile

# Build TypeScript
WORKDIR /app/apps/peerjs-server
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
COPY apps/peerjs-server/package.json ./apps/peerjs-server/package.json
COPY packages ./packages

# Install production dependencies only
RUN npm install --frozen-lockfile --production

# Copy built application
COPY --from=builder /app/apps/peerjs-server/dist ./apps/peerjs-server/dist

WORKDIR /app/apps/peerjs-server

# Expose port
EXPOSE 9000

# Start the server
CMD ["node", "dist/index.js"]
