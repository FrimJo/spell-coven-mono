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
    VITE_SUPPORT_URL: z.url().optional(),
    VITE_CAMERA_FOCUS_CONTROLS_ENABLED: z.coerce.boolean().default(false),
    VITE_PREVIEW_AUTH: z.coerce.boolean().default(false),
    VITE_SENTRY_DSN: z.url().optional(),
    VITE_SENTRY_ENVIRONMENT: z.string().optional(),
    VITE_SENTRY_RELEASE: z.string().optional(),
    VITE_SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
    VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE: z.string().optional(),
    VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE: z.string().optional(),
    /**
     * Exposes per-room media diagnostics on `window.__spellCovenMediaDiagnostics`
     * for the e2e harness. Defaults off (fail-closed); the e2e build sets
     * `VITE_MEDIA_DIAGNOSTICS=1` explicitly so prod never ships the hook.
     */
    VITE_MEDIA_DIAGNOSTICS: z.coerce.boolean().default(false),
  },

  /**
   * Runtime environment variables
   *
   * Client variables come from import.meta.env (Vite exposes VITE_* vars)
   */
  runtimeEnv: {
    VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
    VITE_BASE_URL: import.meta.env.VITE_BASE_URL,
    VITE_SUPPORT_URL: import.meta.env.VITE_SUPPORT_URL,
    VITE_PREVIEW_AUTH: import.meta.env.VITE_PREVIEW_AUTH,
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
    VITE_SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT,
    VITE_SENTRY_RELEASE:
      import.meta.env.VITE_SENTRY_RELEASE ??
      import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ??
      import.meta.env.VITE_GITHUB_SHA ??
      import.meta.env.VITE_BUILD_NUMBER,
    VITE_SENTRY_TRACES_SAMPLE_RATE: import.meta.env
      .VITE_SENTRY_TRACES_SAMPLE_RATE,
    VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE: import.meta.env
      .VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE,
    VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE: import.meta.env
      .VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE,
    VITE_MEDIA_DIAGNOSTICS: import.meta.env.VITE_MEDIA_DIAGNOSTICS,
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
    VITE_SUPPORT_URL: env.VITE_SUPPORT_URL,
    VITE_CAMERA_FOCUS_CONTROLS_ENABLED: env.VITE_CAMERA_FOCUS_CONTROLS_ENABLED,
    VITE_PREVIEW_AUTH: env.VITE_PREVIEW_AUTH,
    VITE_SENTRY_DSN: env.VITE_SENTRY_DSN,
    VITE_SENTRY_ENVIRONMENT: env.VITE_SENTRY_ENVIRONMENT,
    VITE_SENTRY_RELEASE: env.VITE_SENTRY_RELEASE,
    VITE_SENTRY_TRACES_SAMPLE_RATE: env.VITE_SENTRY_TRACES_SAMPLE_RATE,
    VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE:
      env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE,
    VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE:
      env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE,
    VITE_MEDIA_DIAGNOSTICS: env.VITE_MEDIA_DIAGNOSTICS,
  }
}

/**
 * Feature flags
 */
export const isCameraFocusControlsEnabled =
  env.VITE_CAMERA_FOCUS_CONTROLS_ENABLED

/**
 * Whether to publish media diagnostics to `window` for the e2e harness.
 */
export const isMediaDiagnosticsEnabled = env.VITE_MEDIA_DIAGNOSTICS

const phoneCameraPairingVercelEnvironments = new Set([
  'preview',
  'develop',
  'development',
])

export const isPhoneCameraPairingEnabled =
  !import.meta.env.PROD ||
  phoneCameraPairingVercelEnvironments.has(__VERCEL_ENV__ ?? '')
