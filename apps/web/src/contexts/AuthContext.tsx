/**
 * Auth Context - Provides authentication state throughout the app
 *
 * Uses Supabase Auth with Discord OAuth provider.
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

interface AuthContextValue {
  /** Current authenticated user, null if not logged in */
  user: AuthUser | null
  /** Current Supabase session */
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

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    getSession().then((initialSession) => {
      setSession(initialSession)
      setIsLoading(false)
      console.log(
        '[Auth] Initial session:',
        initialSession ? 'authenticated' : 'not authenticated',
      )
    })

    // Subscribe to auth changes
    const unsubscribe = onAuthStateChange((newSession) => {
      console.log(
        '[Auth] Auth state changed:',
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
      console.error('[Auth] Sign in failed:', error)
      throw error
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      setSession(null)
    } catch (error) {
      console.error('[Auth] Sign out failed:', error)
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
