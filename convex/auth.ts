/**
 * Convex Auth Configuration
 *
 * Sets up authentication providers:
 * - Discord OAuth for production/development
 * - Password provider for e2e tests (when CONVEX_AUTH_TEST_MODE=true)
 *
 * @see https://labs.convex.dev/auth
 */

import type { AuthProviderConfig } from '@convex-dev/auth/server'
import Discord from '@auth/core/providers/discord'
import { convexAuth } from '@convex-dev/auth/server'
import z from 'zod'

export { previewLogin } from './previewLogin'

const providers: AuthProviderConfig[] = []

// Only add Discord provider when not running e2e tests
if (!z.coerce.boolean().safeParse(process.env.E2E_TEST).success) {
  providers.push(Discord)
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: providers,
})
