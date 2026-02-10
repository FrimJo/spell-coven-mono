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
import z from 'zod'

export { previewLogin } from './previewLogin'

let providers: [typeof Discord] | [typeof Password]
const e2eEnabledSchema = z.coerce.boolean().safeParse(process.env.E2E_TEST)
const isE2ePreview = e2eEnabledSchema.data ?? false

// Only add Discord provider when not running e2e tests
if (isE2ePreview) {
  providers = [Password]
} else {
  providers = [Discord]
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: providers,
})
