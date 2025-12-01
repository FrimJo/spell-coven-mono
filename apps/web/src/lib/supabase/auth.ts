/**
 * Supabase Auth utilities
 *
 * Handles Discord OAuth authentication with Supabase.
 */

import type { Session, User } from '@supabase/supabase-js'

import { supabase } from './client'

export type { Session, User }

export interface AuthUser {
  id: string
  username: string
  avatar: string | null
  email: string | null
}

/**
 * Parse Supabase user into our AuthUser format
 */
export function parseAuthUser(user: User): AuthUser {
  // Discord provides user data in user_metadata
  const metadata = user.user_metadata || {}

  // Discord username from OAuth
  const username =
    metadata.full_name ||
    metadata.name ||
    metadata.preferred_username ||
    metadata.custom_claims?.global_name ||
    `User${user.id.slice(0, 6)}`

  // Discord avatar URL
  const avatar = metadata.avatar_url || metadata.picture || null

  return {
    id: user.id,
    username,
    avatar,
    email: user.email || null,
  }
}

/**
 * Sign in with Discord OAuth
 */
export async function signInWithDiscord(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: window.location.origin,
      scopes: 'identify',
    },
  })

  if (error) {
    console.error('[Auth] Discord sign in error:', error)
    throw error
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('[Auth] Sign out error:', error)
    throw error
  }
}

/**
 * Get the current session
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.error('[Auth] Get session error:', error)
    return null
  }

  return data.session
}

/**
 * Get the current user
 */
export async function getUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    console.error('[Auth] Get user error:', error)
    return null
  }

  return data.user
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })

  return () => subscription.unsubscribe()
}
