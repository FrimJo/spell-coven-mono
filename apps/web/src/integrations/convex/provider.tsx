/**
 * Convex Provider
 *
 * Provides Convex client and auth context to the app.
 */

import type { ReactNode } from 'react'
import { env } from '@/env'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexReactClient } from 'convex/react'

/**
 * Convex client instance
 *
 * Single instance shared across the app.
 */
const convex = new ConvexReactClient(env.VITE_CONVEX_URL)

interface ConvexProviderProps {
  children: ReactNode
}

/**
 * Convex provider component
 *
 * Wraps the app with ConvexAuthProvider which provides:
 * - Convex client for queries/mutations
 * - Auth state (useConvexAuth, useAuthActions)
 */
export function ConvexProvider({ children }: ConvexProviderProps) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>
}

/**
 * Export the client for direct access if needed
 */
export { convex }
