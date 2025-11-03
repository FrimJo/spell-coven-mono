/**
 * Environment Variables Configuration
 *
 * Centralized environment variable validation using Zod.
 * This ensures all required environment variables are present and valid
 * at runtime, with proper TypeScript types.
 */

import { z } from 'zod'

// ============================================================================
// Schema Definition
// ============================================================================

const envSchema = z.object({
  // Discord Configuration
  VITE_DISCORD_CLIENT_ID: z.string().min(1, 'Discord Client ID is required'),
  VITE_DISCORD_GUILD_ID: z.string().min(1, 'Discord Guild ID is required'),
  DISCORD_BOT_TOKEN: z.string().min(1, 'Discord Bot Token is required'),
  DISCORD_BOT_USER_ID: z.string().min(1, 'Discord Bot User ID is required'),
  DISCORD_CLIENT_SECRET: z.string().min(1, 'Discord Client Secret is required'),

  // Hub & WebSocket Configuration
  HUB_SECRET: z.string().min(32, 'Hub Secret must be at least 32 characters'),
  ROOM_TOKEN_SECRET: z
    .string()
    .min(32, 'Room Token Secret must be at least 32 characters'),
  WS_AUTH_SECRET: z.string().optional(),

  // Gateway Configuration
  GATEWAY_WS_URL: z.url().optional().default('ws://localhost:8080'),
  LINK_TOKEN: z.string().optional(),

  // JWT Configuration
  JWT_ISSUER: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),
  JWT_PUBLIC_JWK_URL: z.url().optional(),

  // Application Configuration
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
})

// ============================================================================
// Type Inference
// ============================================================================

export type Env = z.infer<typeof envSchema>

// ============================================================================
// Validation & Export
// ============================================================================

/**
 * Parse and validate environment variables
 *
 * @throws {ZodError} if validation fails
 */
function parseEnv(): Env {
  try {
    return envSchema.parse(import.meta.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map((err: z.ZodIssue) => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n')

      throw new Error(
        `❌ Environment variable validation failed:\n${missingVars}\n\n` +
          `Please check your .env.development file and ensure all required variables are set.`,
      )
    }
    throw error
  }
}

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
export const env = parseEnv()

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
