/**
 * Auth Context - Provides authentication state throughout the app
 *
 * Supports both Supabase Auth and Convex Auth with Discord OAuth provider.
 * Set USE_CONVEX_AUTH to switch between implementations.
 */

import type { AuthUser } from '@/lib/supabase/auth'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import {
  getSession,
  onAuthStateChange,
  parseAuthUser,
  signInWithDiscord,
  signOut,
} from '@/lib/supabase/auth'
import { useConvexAuthHook } from '@/hooks/useConvexAuth'

// ============================================================================
// Feature Flag - Toggle between Supabase and Convex Auth
// ============================================================================

/**
 * Feature flag to control auth implementation
 *
 * When true: Uses Convex Auth with Discord OAuth
 * When false: Uses Supabase Auth with Discord OAuth (legacy)
 *
 * Set to false to revert to Supabase auth if issues arise.
 */
const USE_CONVEX_AUTH = true

// ============================================================================
// Types
// ============================================================================

interface AuthContextValue {
  /** Current authenticated user, null if not logged in */
  user: AuthUser | null
  /** Current Supabase session (null when using Convex Auth) */
  session: Session | null
  /** Whether auth state is still loading */
  isLoading: boolean
  /** Whether user is authenticated */
  isAuthenticated: boolean
  /** Sign in with Discord */
  signIn: () => Promise<void>
  /** Sign out */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

// ============================================================================
// Supabase Auth Provider (Legacy)
// ============================================================================

function SupabaseAuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    getSession().then((initialSession) => {
      setSession(initialSession)
      setIsLoading(false)
      console.log(
        '[Auth/Supabase] Initial session:',
        initialSession ? 'authenticated' : 'not authenticated',
      )
    })

    // Subscribe to auth changes
    const unsubscribe = onAuthStateChange((newSession) => {
      console.log(
        '[Auth/Supabase] Auth state changed:',
        newSession ? 'authenticated' : 'not authenticated',
      )
      setSession(newSession)
      setIsLoading(false)
    })

    return unsubscribe
  }, [])

  const user = session?.user ? parseAuthUser(session.user) : null

  const handleSignIn = async () => {
    try {
      await signInWithDiscord()
    } catch (error) {
      console.error('[Auth/Supabase] Sign in failed:', error)
      throw error
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      setSession(null)
    } catch (error) {
      console.error('[Auth/Supabase] Sign out failed:', error)
      throw error
    }
  }

  const value: AuthContextValue = {
    user,
    session,
    isLoading,
    isAuthenticated: !!session,
    signIn: handleSignIn,
    signOut: handleSignOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ============================================================================
// Convex Auth Provider
// ============================================================================

function ConvexAuthProviderInner({ children }: AuthProviderProps) {
  const { user, isLoading, isAuthenticated, signIn, signOut } =
    useConvexAuthHook()

  useEffect(() => {
    console.log(
      '[Auth/Convex] Auth state:',
      isAuthenticated ? 'authenticated' : 'not authenticated',
      isLoading ? '(loading)' : '',
    )
  }, [isAuthenticated, isLoading])

  // Map Convex user to AuthUser type for compatibility
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
    session: null, // Convex doesn't have a session object like Supabase
    isLoading,
    isAuthenticated,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ============================================================================
// Main Auth Provider
// ============================================================================

export function AuthProvider({ children }: AuthProviderProps) {
  if (USE_CONVEX_AUTH) {
    console.log('[Auth] Using Convex Auth')
    return <ConvexAuthProviderInner>{children}</ConvexAuthProviderInner>
  }

  console.log('[Auth] Using Supabase Auth (legacy)')
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
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
