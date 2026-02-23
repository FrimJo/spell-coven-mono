/**
 * Theme Context - Provides dark/light mode theming throughout the app
 *
 * Supports light, dark, and system preference modes.
 * Also supports MTG color themes (White, Blue, Black, Red, Green).
 * Persists preference to cookies (no localStorage).
 */

import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import bSvgRaw from '@/assets/b.svg?raw'
import gSvgRaw from '@/assets/g.svg?raw'
import rSvgRaw from '@/assets/r.svg?raw'
import uSvgRaw from '@/assets/u.svg?raw'
import wSvgRaw from '@/assets/w.svg?raw'

/** Prepare raw SVG for inline use: currentColor fill and full size in container */
function svgForInline(raw: string) {
  return raw
    .replace(/fill="#444"/, 'fill="currentColor"')
    .replace(/width="32" height="32"/, 'width="100%" height="100%"')
}

// ============================================================================
// Cookie contract
// Keep cookie names and valid-value lists in sync with the bootstrap script
// in __root.tsx (they are duplicated there as string literals).
// ============================================================================

export const THEME_COOKIE = 'sc-theme'
export const MTG_THEME_COOKIE = 'sc-mtg-theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const VALID_THEMES = ['light', 'dark', 'system'] as const
const VALID_MTG_THEMES = [
  'none',
  'white',
  'blue',
  'black',
  'red',
  'green',
] as const

// ============================================================================
// Types (derived from the valid-value tuples above)
// ============================================================================

export type Theme = (typeof VALID_THEMES)[number]
export type ResolvedTheme = 'light' | 'dark'

/** MTG color themes based on the five colors of Magic */
export type MtgColorTheme = (typeof VALID_MTG_THEMES)[number]

const DEFAULT_THEME: Theme = 'dark'
const DEFAULT_MTG_THEME: MtgColorTheme = 'none'

/** Extract a single cookie value from a raw Cookie header string. */
export function parseCookieValue(
  cookieHeader: string,
  name: string,
): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match?.[1] != null ? decodeURIComponent(match[1]) : null
}

/** Parse both theme cookies from a raw Cookie header string. */
export function parseThemeFromCookies(cookieHeader: string): {
  theme: Theme
  mtgTheme: MtgColorTheme
} {
  const rawTheme = parseCookieValue(cookieHeader, THEME_COOKIE)
  const rawMtgTheme = parseCookieValue(cookieHeader, MTG_THEME_COOKIE)

  const theme = VALID_THEMES.includes(rawTheme as Theme)
    ? (rawTheme as Theme)
    : DEFAULT_THEME
  const mtgTheme = VALID_MTG_THEMES.includes(rawMtgTheme as MtgColorTheme)
    ? (rawMtgTheme as MtgColorTheme)
    : DEFAULT_MTG_THEME

  return { theme, mtgTheme }
}

/** Read theme preferences from `document.cookie` (client only). */
function readThemeFromClientCookies(): {
  theme: Theme
  mtgTheme: MtgColorTheme
} {
  if (typeof document === 'undefined')
    return { theme: DEFAULT_THEME, mtgTheme: DEFAULT_MTG_THEME }
  return parseThemeFromCookies(document.cookie)
}

/** Write a theme cookie on the client. */
function setThemeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

/** Icon color per MTG theme (matches mana symbol identity) */
const MTG_THEME_COLORS: Record<Exclude<MtgColorTheme, 'none'>, string> = {
  white: '#d4af37',
  blue: '#4da6ff',
  black: '#5c3d99',
  red: '#c62828',
  green: '#4caf50',
}

/** Information about MTG color themes */
export const MTG_THEMES = {
  none: {
    label: 'Default',
    iconSvg: null,
    iconColor: null,
    description: 'Standard theme',
  },
  white: {
    label: 'White',
    iconSvg: svgForInline(wSvgRaw),
    iconColor: MTG_THEME_COLORS.white,
    description: 'Order, Light, Structure',
  },
  blue: {
    label: 'Blue',
    iconSvg: svgForInline(uSvgRaw),
    iconColor: MTG_THEME_COLORS.blue,
    description: 'Knowledge, Control, Precision',
  },
  black: {
    label: 'Black',
    iconSvg: svgForInline(bSvgRaw),
    iconColor: MTG_THEME_COLORS.black,
    description: 'Power, Death, Ambition',
  },
  red: {
    label: 'Red',
    iconSvg: svgForInline(rSvgRaw),
    iconColor: MTG_THEME_COLORS.red,
    description: 'Chaos, Speed, Emotion',
  },
  green: {
    label: 'Green',
    iconSvg: svgForInline(gSvgRaw),
    iconColor: MTG_THEME_COLORS.green,
    description: 'Growth, Nature, Strength',
  },
} as const

interface ThemeContextValue {
  /** Current theme setting (light, dark, or system) */
  theme: Theme
  /** Resolved theme after applying system preference */
  resolvedTheme: ResolvedTheme
  /** Set theme to a specific value */
  setTheme: (theme: Theme) => void
  /** Toggle between light and dark (skips system) */
  toggleTheme: () => void
  /** Current MTG color theme */
  mtgTheme: MtgColorTheme
  /** Set MTG color theme */
  setMtgTheme: (theme: MtgColorTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// ============================================================================
// Theme Provider
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode
  /** Initial theme from server/loader so SSR and client first paint match. */
  defaultTheme?: Theme
  /** Initial MTG theme from server/loader so SSR and client first paint match. */
  defaultMtgTheme?: MtgColorTheme
}

/**
 * Get the system's color scheme preference
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

/**
 * Apply the theme class to the document
 */
function applyThemeToDocument(resolvedTheme: ResolvedTheme) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  if (resolvedTheme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

/**
 * Apply the MTG color theme to the document
 */
function applyMtgThemeToDocument(mtgTheme: MtgColorTheme) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  if (mtgTheme === 'none') {
    root.removeAttribute('data-mtg-theme')
  } else {
    root.setAttribute('data-mtg-theme', mtgTheme)
  }
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  defaultMtgTheme,
}: ThemeProviderProps) {
  // Use loader/snapshot values when provided so server and client first paint match (avoids hydration mismatch on theme-dependent logo etc).
  const [theme, setThemeState] = useState<Theme>(
    () =>
      defaultTheme ??
      (typeof window === 'undefined'
        ? 'dark'
        : readThemeFromClientCookies().theme),
  )

  const [mtgTheme, setMtgThemeState] = useState<MtgColorTheme>(
    () =>
      defaultMtgTheme ??
      (typeof window === 'undefined'
        ? 'none'
        : readThemeFromClientCookies().mtgTheme),
  )

  // Track system theme separately for 'system' theme mode
  const [systemResolvedTheme, setSystemResolvedTheme] = useState<ResolvedTheme>(
    () => getSystemTheme(),
  )

  // Compute resolved theme - use memo for most cases, state for system theme updates
  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    if (theme === 'system') {
      return systemResolvedTheme
    }
    return theme
  }, [theme, systemResolvedTheme])

  // Apply theme to document whenever resolvedTheme changes
  useEffect(() => {
    applyThemeToDocument(resolvedTheme)
  }, [resolvedTheme])

  // Apply MTG theme to document whenever mtgTheme changes
  useEffect(() => {
    applyMtgThemeToDocument(mtgTheme)
  }, [mtgTheme])

  // Listen for system theme changes when theme is set to 'system'
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      // This is an external system callback, so setState here is acceptable
      const resolved = e.matches ? 'dark' : 'light'
      setSystemResolvedTheme(resolved)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    setThemeCookie(THEME_COOKIE, newTheme)
  }, [])

  const setMtgTheme = useCallback((newMtgTheme: MtgColorTheme) => {
    setMtgThemeState(newMtgTheme)
    setThemeCookie(MTG_THEME_COOKIE, newMtgTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    // Toggle between light and dark only (not system)
    const newTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }, [resolvedTheme, setTheme])

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    mtgTheme,
    setMtgTheme,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access theme context
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
