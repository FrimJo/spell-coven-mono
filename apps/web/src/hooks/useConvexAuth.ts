/**
 * Convex Auth Hook
 *
 * Provides authentication using Convex Auth with Discord OAuth.
 *
 * @see https://labs.convex.dev/auth
 */

import { useCallback } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '@convex/_generated/api'
import { useConvexAuth, useQuery } from 'convex/react'

/**
 * User profile shape (compatible with existing AuthUser type)
 */
export interface ConvexAuthUser {
  /** User's unique ID (from Convex Auth) */
  id: string
  /** User's display name (Discord username) */
  username: string
  /** User's avatar URL */
  avatar: string | null
  /** User's email address */
  email: string | null
}

/**
 * Hook return type matching AuthContextValue interface
 */
export interface UseConvexAuthReturn {
  /** Current authenticated user, null if not logged in */
  user: ConvexAuthUser | null
  /** Whether auth state is still loading */
  isLoading: boolean
  /** Whether user is authenticated */
  isAuthenticated: boolean
  /** Sign in with Discord */
  signIn: () => Promise<void>
  /** Sign out */
  signOut: () => Promise<void>
}

/**
 * Hook to use Convex Auth with Discord OAuth
 *
 * @example
 * ```tsx
 * const { user, isLoading, isAuthenticated, signIn, signOut } = useConvexAuth()
 *
 * if (isLoading) return <Loading />
 * if (!isAuthenticated) return <button onClick={signIn}>Sign in with Discord</button>
 * return <div>Welcome, {user.username}!</div>
 * ```
 */
export function useConvexAuthHook(): UseConvexAuthReturn {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth()
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions()

  // Query the current user profile from Convex
  // This will return undefined while loading, null if not authenticated
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : 'skip',
  )

  // Determine overall loading state
  // We're loading if auth is loading OR if we're authenticated but user data hasn't loaded yet
  const isLoading =
    isAuthLoading || (isAuthenticated && currentUser === undefined)

  // Build user object from Convex user data
  const user: ConvexAuthUser | null =
    currentUser && isAuthenticated
      ? {
          id: currentUser._id,
          username: currentUser.name ?? currentUser.email ?? 'Unknown',
          avatar: currentUser.image ?? null,
          email: currentUser.email ?? null,
        }
      : null

  // Sign in with Discord OAuth
  const signIn = useCallback(async () => {
    try {
      await convexSignIn('discord')
      // redirectTo is handled by Convex Auth based on SITE_URL config
    } catch (error) {
      console.error('[ConvexAuth] Sign in failed:', error)
      throw error
    }
  }, [convexSignIn])

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await convexSignOut()
    } catch (error) {
      console.error('[ConvexAuth] Sign out failed:', error)
      throw error
    }
  }, [convexSignOut])

  return {
    user,
    isLoading,
    isAuthenticated,
    signIn,
    signOut,
  }
}
