/**
 * Environment Variables Configuration
 * 
 * Centralized environment variable validation using @t3-oss/env-core.
 * This ensures all required environment variables are present and valid
 * at runtime, with proper TypeScript types.
 * 
 * @see https://env.t3.gg/docs/core
 */

import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

/**
 * Validated environment variables
 * 
 * Access environment variables through this object for type safety:
 * ```typescript
 * import { env } from '@/env'
 * 
 * const guildId = env.VITE_DISCORD_GUILD_ID
 * const botToken = env.DISCORD_BOT_TOKEN
 * ```
 */
export const env = createEnv({
  /**
   * Server-side environment variables (secrets, not exposed to client)
   */
  server: {
    // Discord Configuration
    DISCORD_BOT_TOKEN: z.string().min(1, 'Discord Bot Token is required'),
    DISCORD_BOT_USER_ID: z.string().min(1, 'Discord Bot User ID is required'),
    DISCORD_CLIENT_SECRET: z.string().min(1, 'Discord Client Secret is required'),

    // Hub & WebSocket Configuration
    HUB_SECRET: z.string().min(32, 'Hub Secret must be at least 32 characters'),
    ROOM_TOKEN_SECRET: z.string().min(32, 'Room Token Secret must be at least 32 characters'),
    WS_AUTH_SECRET: z.string().optional(),

    // Gateway Configuration
    GATEWAY_WS_URL: z.string().url().optional().default('ws://localhost:8080'),
    LINK_TOKEN: z.string().optional(),

    // JWT Configuration
    JWT_ISSUER: z.string().optional(),
    JWT_AUDIENCE: z.string().optional(),
    JWT_PUBLIC_JWK_URL: z.string().url().optional(),

    // Admin Configuration
    ADMIN_CLEANUP_SECRET: z.string().optional(),

    // Logging
    LOG_LEVEL: z
      .enum(['debug', 'info', 'warn', 'error'])
      .optional()
      .default('info'),

    // Development
    WS_PORT: z.string().optional().default('4321'),

    // Blob Storage
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
  },

  /**
   * Client-side environment variables (public, prefixed with VITE_)
   * These are available on both client and server
   */
  clientPrefix: 'VITE_',
  client: {
    VITE_DISCORD_CLIENT_ID: z.string().min(1, 'Discord Client ID is required'),
    VITE_DISCORD_GUILD_ID: z.string().min(1, 'Discord Guild ID is required'),
    VITE_BASE_URL: z.string().url().optional().default('http://localhost:1234'),
    VITE_EMBEDDINGS_VERSION: z.string().optional().default('v1.3'),
    VITE_EMBEDDINGS_FORMAT: z
      .enum(['float32', 'float16'])
      .optional()
      .default('float32'),
    VITE_QUERY_CONTRAST: z.string().optional().default('1.5'),
    VITE_BLOB_STORAGE_URL: z
      .string()
      .url()
      .min(1, 'Blob storage URL is required'),
  },

  /**
   * Runtime environment variables
   * 
   * For TanStack Start, we need to manually specify which variables to read from.
   * - Client variables come from import.meta.env (Vite exposes VITE_* vars)
   * - Server variables come from process.env
   */
  runtimeEnv: {
    // Server-only variables (from process.env)
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_BOT_USER_ID: process.env.DISCORD_BOT_USER_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    HUB_SECRET: process.env.HUB_SECRET,
    ROOM_TOKEN_SECRET: process.env.ROOM_TOKEN_SECRET,
    WS_AUTH_SECRET: process.env.WS_AUTH_SECRET,
    GATEWAY_WS_URL: process.env.GATEWAY_WS_URL,
    LINK_TOKEN: process.env.LINK_TOKEN,
    JWT_ISSUER: process.env.JWT_ISSUER,
    JWT_AUDIENCE: process.env.JWT_AUDIENCE,
    JWT_PUBLIC_JWK_URL: process.env.JWT_PUBLIC_JWK_URL,
    ADMIN_CLEANUP_SECRET: process.env.ADMIN_CLEANUP_SECRET,
    LOG_LEVEL: process.env.LOG_LEVEL,
    WS_PORT: process.env.WS_PORT,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,

    // Client variables (from import.meta.env - Vite exposes these)
    VITE_DISCORD_CLIENT_ID: import.meta.env.VITE_DISCORD_CLIENT_ID,
    VITE_DISCORD_GUILD_ID: import.meta.env.VITE_DISCORD_GUILD_ID,
    VITE_BASE_URL: import.meta.env.VITE_BASE_URL,
    VITE_EMBEDDINGS_VERSION: import.meta.env.VITE_EMBEDDINGS_VERSION,
    VITE_EMBEDDINGS_FORMAT: import.meta.env.VITE_EMBEDDINGS_FORMAT,
    VITE_QUERY_CONTRAST: import.meta.env.VITE_QUERY_CONTRAST,
    VITE_BLOB_STORAGE_URL: import.meta.env.VITE_BLOB_STORAGE_URL,
  },

  /**
   * Treat empty strings as undefined
   * 
   * This solves issues where empty env vars in .env files (e.g., `PORT=`)
   * would be treated as empty strings instead of undefined, breaking defaults.
   */
  emptyStringAsUndefined: true,
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if running in production
 */
export const isProduction = import.meta.env.PROD

/**
 * Check if running in development
 */
export const isDevelopment = import.meta.env.DEV

/**
 * Check if running on server
 */
export const isServer = typeof window === 'undefined'

/**
 * Check if running on client
 */
export const isClient = typeof window !== 'undefined'

/**
 * Get a safe subset of environment variables for client-side use
 * (only VITE_* prefixed variables)
 */
export function getClientEnv() {
  return {
    VITE_DISCORD_CLIENT_ID: env.VITE_DISCORD_CLIENT_ID,
    VITE_DISCORD_GUILD_ID: env.VITE_DISCORD_GUILD_ID,
    VITE_BASE_URL: env.VITE_BASE_URL,
    VITE_EMBEDDINGS_VERSION: env.VITE_EMBEDDINGS_VERSION,
    VITE_EMBEDDINGS_FORMAT: env.VITE_EMBEDDINGS_FORMAT,
    VITE_QUERY_CONTRAST: env.VITE_QUERY_CONTRAST,
    VITE_BLOB_STORAGE_URL: env.VITE_BLOB_STORAGE_URL,
  }
}
