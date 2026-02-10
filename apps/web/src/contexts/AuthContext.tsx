/**
 * Auth Context - Provides authentication state throughout the app
 *
 * Uses Convex Auth with Discord OAuth provider.
 */

import type { ReactNode } from 'react'
import { createContext, useContext, useEffect } from 'react'
import { useConvexAuthHook } from '@/hooks/useConvexAuth'

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  id: string
  username: string
  avatar: string | null
  email: string | null
}

interface AuthContextValue {
  /** Current authenticated user, null if not logged in */
  user: AuthUser | null
  /** Whether auth state is still loading */
  isLoading: boolean
  /** Whether user is authenticated */
  isAuthenticated: boolean
  /** Sign in with Discord */
  signIn: () => Promise<void>
  /** Sign in using preview login code */
  signInWithPreviewCode: (code: string) => Promise<void>
  /** Sign out */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

// ============================================================================
// Auth Provider
// ============================================================================

export function AuthProvider({ children }: AuthProviderProps) {
  const {
    user,
    isLoading,
    isAuthenticated,
    signIn,
    signInWithPreviewCode,
    signOut,
  } = useConvexAuthHook()

  useEffect(() => {
    console.log(
      '[Auth] Auth state:',
      isAuthenticated ? 'authenticated' : 'not authenticated',
      isLoading ? '(loading)' : '',
    )
  }, [isAuthenticated, isLoading])

  // Map Convex user to AuthUser type
  const mappedUser: AuthUser | null = user
    ? {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        email: user.email,
      }
    : null

  const value: AuthContextValue = {
    user: mappedUser,
    isLoading,
    isAuthenticated,
    signIn,
    signInWithPreviewCode,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
