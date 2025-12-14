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
 * const supabaseUrl = env.VITE_SUPABASE_URL
 * ```
 */
export const env = createEnv({
  /**
   * Client-side environment variables (public, prefixed with VITE_)
   */
  clientPrefix: 'VITE_',
  client: {
    VITE_SUPABASE_URL: z.url().min(1, 'VITE_SUPABASE_URL is required'),
    VITE_SUPABASE_ANON_KEY: z
      .string()
      .min(1, 'VITE_SUPABASE_ANON_KEY is required'),
    VITE_BASE_URL: z.url().optional().default('https://localhost:1234'),
    VITE_EMBEDDINGS_VERSION: z.string().optional().default('v1.3'),
    VITE_EMBEDDINGS_FORMAT: z
      .enum(['float32', 'float16'])
      .optional()
      .default('float32'),
    VITE_QUERY_CONTRAST: z.string().optional().default('1.5'),
    VITE_BLOB_STORAGE_URL: z.url().min(1, 'Blob storage URL is required'),
  },

  /**
   * Runtime environment variables
   *
   * Client variables come from import.meta.env (Vite exposes VITE_* vars)
   */
  runtimeEnv: {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
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
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
    VITE_BASE_URL: env.VITE_BASE_URL,
    VITE_EMBEDDINGS_VERSION: env.VITE_EMBEDDINGS_VERSION,
    VITE_EMBEDDINGS_FORMAT: env.VITE_EMBEDDINGS_FORMAT,
    VITE_QUERY_CONTRAST: env.VITE_QUERY_CONTRAST,
    VITE_BLOB_STORAGE_URL: env.VITE_BLOB_STORAGE_URL,
  }
}
