# syntax=docker/dockerfile:1.7
# Build the @repo/api service for Railway deployment.
# Multi-stage: stage 1 installs full deps + builds with tsc,
# stage 2 ships only production deps + compiled dist + card index.

# ---------- Stage 1: builder ----------
FROM node:22-slim AS builder

# bun for workspace-aware install
RUN npm install -g bun@1.3.8

WORKDIR /app

# Copy lockfile + root manifest
COPY package.json bun.lock ./

# Copy workspace package manifests so bun resolves the graph correctly.
# Only the api app + its workspace deps are needed.
COPY apps/api/package.json ./apps/api/package.json
COPY packages/card-detection/package.json ./packages/card-detection/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Full install (includes devDeps like tsc, tsx, @types/*).
# Skip the root postinstall (sherif) — not needed in Docker.
ENV CI=1
RUN bun install --frozen-lockfile

# Copy sources needed to build the api
COPY packages/typescript-config ./packages/typescript-config
COPY packages/card-detection ./packages/card-detection
COPY apps/api ./apps/api

# Build the api (tsc -> apps/api/dist)
RUN cd apps/api && bun run build

# ---------- Stage 2: runtime ----------
FROM node:22-slim AS runtime

# sharp ships prebuilt binaries for linux-x64; runtime needs libvips deps already in node:slim.
# bun is needed to resolve workspace deps without devDeps.
RUN npm install -g bun@1.3.8

WORKDIR /app

ENV NODE_ENV=production
ENV CI=1

# Manifests
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/card-detection/package.json ./packages/card-detection/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Production-only install (skips devDeps like tsc, jest, tsx)
RUN bun install --frozen-lockfile --production

# Copy built JS + workspace package source (card-detection ships .ts via main:./src/index.ts;
# the api compiles against it but at runtime imports the published path. Keep src for resolution.)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY packages/card-detection ./packages/card-detection
COPY packages/typescript-config ./packages/typescript-config

# Static card index — loaded relative to process.cwd() by the detection service.
COPY static ./static

# Railway injects PORT — do NOT hardcode. EXPOSE is documentation only.
EXPOSE 4001

CMD ["node", "apps/api/dist/index.js"]
