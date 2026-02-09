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
import { AuthProviderConfig, convexAuth } from '@convex-dev/auth/server'

const providers: AuthProviderConfig[] = [Discord]

if (process.env.CONVEX_AUTH_TEST_MODE === 'true') {
  providers.push(Password)
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: providers,
})
