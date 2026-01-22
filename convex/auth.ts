/**
 * Convex Auth Configuration
 *
 * Sets up Discord OAuth provider for authentication.
 * @see https://labs.convex.dev/auth
 */

import Discord from '@auth/core/providers/discord'
import { convexAuth } from '@convex-dev/auth/server'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Discord],
})
