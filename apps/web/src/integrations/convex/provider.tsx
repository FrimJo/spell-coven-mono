/**
 * Convex Provider
 *
 * Provides Convex client and auth context to the app.
 */

import type { ReactNode } from 'react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'

import { convex } from './client'

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
