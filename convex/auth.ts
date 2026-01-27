/**
 * Convex Auth Configuration
 *
 * Sets up authentication providers:
 * - Discord OAuth for production/development
 * - Password provider for e2e tests (when CONVEX_AUTH_TEST_MODE=true)
 *
 * @see https://labs.convex.dev/auth
 */

import Discord from '@auth/core/providers/discord'
import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'

// process.env is available at runtime in Convex
declare const process: { env: Record<string, string | undefined> }

// Use Password provider in test mode to avoid Discord OAuth UI (and hCaptcha)
const isTestMode = process.env.CONVEX_AUTH_TEST_MODE === 'true'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: isTestMode ? [Password] : [Discord],
})
