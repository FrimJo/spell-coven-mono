/**
 * @deprecated This file is no longer used. Authentication is now handled via
 * Supabase Auth with Discord OAuth. See:
 * - src/lib/supabase/auth.ts
 * - src/contexts/AuthContext.tsx
 *
 * This file is kept for reference only and can be safely deleted.
 *
 * ---
 * Temporary User Identity System (DEPRECATED)
 *
 * Generates random user ID and username, stored in localStorage.
 */

interface TempUser {
  id: string
  username: string
}

const STORAGE_KEY = 'temp-user-identity'

/**
 * Generate a random GUID (UUID v4)
 */
function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Generate a random username
 */
function generateUsername(): string {
  const adjectives = [
    'Swift',
    'Brave',
    'Clever',
    'Mighty',
    'Silent',
    'Wise',
    'Bold',
    'Noble',
    'Fierce',
    'Quick',
  ]
  const nouns = [
    'Mage',
    'Wizard',
    'Sorcerer',
    'Enchanter',
    'Warlock',
    'Summoner',
    'Conjurer',
    'Mystic',
    'Sage',
    'Oracle',
  ]

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const number = Math.floor(Math.random() * 1000)

  return `${adjective}${noun}${number}`
}

/**
 * Get or create temporary user identity
 *
 * If user identity exists in localStorage, return it.
 * Otherwise, generate new identity and store it.
 */
export function getTempUser(): TempUser {
  // Check if running in browser
  if (typeof window === 'undefined') {
    // Server-side: return placeholder
    return {
      id: 'server-placeholder',
      username: 'ServerUser',
    }
  }

  // Try to get existing identity
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const user = JSON.parse(stored) as TempUser
      // Validate stored data
      if (user.id && user.username) {
        console.log('[TempUser] Using existing identity:', user.username)
        return user
      }
    } catch (error) {
      console.error('[TempUser] Failed to parse stored identity:', error)
      // Fall through to generate new identity
    }
  }

  // Generate new identity
  const user: TempUser = {
    id: generateGuid(),
    username: generateUsername(),
  }

  // Store in localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    console.log('[TempUser] Generated new identity:', user.username, user.id)
  } catch (error) {
    console.error('[TempUser] Failed to store identity:', error)
  }

  return user
}

/**
 * Clear temporary user identity (for testing)
 */
export function clearTempUser(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
    console.log('[TempUser] Cleared identity')
  }
}

/**
 * Update username (keep same user ID)
 */
export function updateTempUsername(newUsername: string): TempUser {
  const user = getTempUser()
  user.username = newUsername

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      console.log('[TempUser] Updated username to:', newUsername)
    } catch (error) {
      console.error('[TempUser] Failed to update username:', error)
    }
  }

  return user
}
