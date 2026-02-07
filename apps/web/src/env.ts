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
 * const convexUrl = env.VITE_CONVEX_URL
 * ```
 */
export const env = createEnv({
  /**
   * Client-side environment variables (public, prefixed with VITE_)
   */
  clientPrefix: 'VITE_',
  client: {
    // Convex
    VITE_CONVEX_URL: z.url().min(1, 'VITE_CONVEX_URL is required'),

    // App config
    VITE_BASE_URL: z.url().optional().default('https://localhost:1234'),
    VITE_EMBEDDINGS_VERSION: z
      .string()
      .min(1, 'Embeddings version is required'),
    VITE_BLOB_STORAGE_URL: z.url().min(1, 'Blob storage URL is required'),
    VITE_SUPPORT_URL: z.url().optional(),
    VITE_CAMERA_FOCUS_CONTROLS_ENABLED: z.coerce.boolean().default(false),

    // Sentry
    VITE_SENTRY_RELEASE: z.string().min(1, 'SENTRY_RELEASE is required'),
    VITE_SENTRY_ORG: z.string().min(1, 'SENTRY_ORG is required'),
    VITE_SENTRY_PROJECT: z.string().min(1, 'SENTRY_PROJECT is required'),
    VITE_GITHUB_SHA: z.string().min(1, 'VITE_GITHUB_SHA is required'),
    VITE_VERCEL_GIT_COMMIT_SHA: z
      .string()
      .min(1, 'VITE_VERCEL_GIT_COMMIT_SHA is required'),
    VITE_BUILD_NUMBER: z.string().min(1, 'VITE_BUILD_NUMBER is required'),
  },
  server: {
    SENTRY_AUTH_TOKEN: z.string().min(1, 'SENTRY_AUTH_TOKEN is required'),
  },

  /**
   * Runtime environment variables
   *
   * Client variables come from import.meta.env (Vite exposes VITE_* vars)
   */
  runtimeEnv: {
    VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
    VITE_BASE_URL: import.meta.env.VITE_BASE_URL,
    VITE_EMBEDDINGS_VERSION: import.meta.env.VITE_EMBEDDINGS_VERSION,
    VITE_BLOB_STORAGE_URL: import.meta.env.VITE_BLOB_STORAGE_URL,
    VITE_SUPPORT_URL: import.meta.env.VITE_SUPPORT_URL,
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
    VITE_CONVEX_URL: env.VITE_CONVEX_URL,
    VITE_BASE_URL: env.VITE_BASE_URL,
    VITE_EMBEDDINGS_VERSION: env.VITE_EMBEDDINGS_VERSION,
    VITE_BLOB_STORAGE_URL: env.VITE_BLOB_STORAGE_URL,
    VITE_SUPPORT_URL: env.VITE_SUPPORT_URL,
    VITE_CAMERA_FOCUS_CONTROLS_ENABLED: env.VITE_CAMERA_FOCUS_CONTROLS_ENABLED,
  }
}

/**
 * Feature flags
 */
export const isCameraFocusControlsEnabled =
  env.VITE_CAMERA_FOCUS_CONTROLS_ENABLED
