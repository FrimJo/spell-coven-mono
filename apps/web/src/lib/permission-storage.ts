/**
 * Permission Storage - Manages user's media permission dialog preferences
 *
 * Stores ONLY when users decline our custom permission dialog, not acceptance.
 * Browser's Permissions API is the source of truth for actual permission state.
 *
 * Two types of decline:
 * - "remind-later": Temporary decline, ask again after REMIND_AFTER_DAYS
 * - "dont-ask": Permanent decline, don't show dialog again
 */

const STORAGE_KEY = 'spell-coven:media-permission-prefs'

/** Days to wait before showing dialog again after "remind later" */
const REMIND_AFTER_DAYS = 7

export type DeclineType = 'remind-later' | 'dont-ask'

export interface PermissionPrefs {
  /** Camera permission decline info */
  camera?: {
    declinedAt: number
    type: DeclineType
  }
  /** Microphone permission decline info */
  microphone?: {
    declinedAt: number
    type: DeclineType
  }
}

/**
 * Load permission preferences from localStorage
 */
function loadPrefs(): PermissionPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    return JSON.parse(stored) as PermissionPrefs
  } catch {
    return {}
  }
}

/**
 * Save permission preferences to localStorage
 */
function savePrefs(prefs: PermissionPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch (error) {
    console.error('[permission-storage] Failed to save preferences:', error)
  }
}

/**
 * Check if enough time has passed since a "remind later" decline
 */
function hasRemindPeriodExpired(declinedAt: number): boolean {
  const now = Date.now()
  const daysSinceDecline = (now - declinedAt) / (1000 * 60 * 60 * 24)
  return daysSinceDecline >= REMIND_AFTER_DAYS
}

/**
 * Record that user declined the permission dialog
 */
export function recordDecline(
  permission: 'camera' | 'microphone',
  type: DeclineType,
): void {
  const prefs = loadPrefs()
  prefs[permission] = {
    declinedAt: Date.now(),
    type,
  }
  savePrefs(prefs)
  console.log(`[permission-storage] Recorded ${type} decline for ${permission}`)
}

/**
 * Check if we should show the custom permission dialog
 *
 * Returns true if:
 * - User never declined, OR
 * - User chose "remind later" and enough time has passed
 *
 * Returns false if:
 * - User chose "don't ask again", OR
 * - User chose "remind later" but not enough time has passed
 */
export function shouldShowPermissionDialog(
  permission: 'camera' | 'microphone',
): boolean {
  const prefs = loadPrefs()
  const decline = prefs[permission]

  if (!decline) {
    // Never declined - show dialog
    return true
  }

  if (decline.type === 'dont-ask') {
    // User explicitly chose not to be asked again
    return false
  }

  if (decline.type === 'remind-later') {
    // Check if remind period has expired
    return hasRemindPeriodExpired(decline.declinedAt)
  }

  return true
}

/**
 * Clear decline preferences (e.g., user wants to try again)
 */
export function clearDeclinePrefs(permission?: 'camera' | 'microphone'): void {
  if (permission) {
    const prefs = loadPrefs()
    delete prefs[permission]
    savePrefs(prefs)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
  console.log(
    `[permission-storage] Cleared decline prefs${permission ? ` for ${permission}` : ''}`,
  )
}

/**
 * Get the current decline state for a permission
 */
export function getDeclineState(
  permission: 'camera' | 'microphone',
): { type: DeclineType; daysRemaining: number } | null {
  const prefs = loadPrefs()
  const decline = prefs[permission]

  if (!decline) return null

  if (decline.type === 'dont-ask') {
    return { type: 'dont-ask', daysRemaining: Infinity }
  }

  const daysSinceDecline =
    (Date.now() - decline.declinedAt) / (1000 * 60 * 60 * 24)
  const daysRemaining = Math.max(0, REMIND_AFTER_DAYS - daysSinceDecline)

  return { type: 'remind-later', daysRemaining: Math.ceil(daysRemaining) }
}
