/**
 * Theme Context - Provides dark/light mode theming throughout the app
 *
 * Supports light, dark, and system preference modes.
 * Also supports MTG color themes (White, Blue, Black, Red, Green).
 * Persists preference to localStorage.
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
import { isThemeToggleEnabled } from '@/env'

// ============================================================================
// Types
// ============================================================================

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/** MTG color themes based on the five colors of Magic */
export type MtgColorTheme = 'none' | 'white' | 'blue' | 'black' | 'red' | 'green'

/** Information about MTG color themes */
export const MTG_THEMES = {
  none: { label: 'Default', emoji: '⚙️', description: 'Standard theme' },
  white: { label: 'White', emoji: '⚪', description: 'Order, Light, Structure' },
  blue: { label: 'Blue', emoji: '🔵', description: 'Knowledge, Control, Precision' },
  black: { label: 'Black', emoji: '⚫', description: 'Power, Death, Ambition' },
  red: { label: 'Red', emoji: '🔴', description: 'Chaos, Speed, Emotion' },
  green: { label: 'Green', emoji: '🟢', description: 'Growth, Nature, Strength' },
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

const STORAGE_KEY = 'spell-coven-theme'
const MTG_THEME_STORAGE_KEY = 'spell-coven-mtg-theme'

// ============================================================================
// Theme Provider
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode
  /** Default theme to use if no preference is stored */
  defaultTheme?: Theme
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
}: ThemeProviderProps) {
  // Initialize theme from localStorage or default
  const [theme, setThemeState] = useState<Theme>(() => {
    if (!isThemeToggleEnabled) return 'dark'
    if (typeof window === 'undefined') return defaultTheme
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
    return defaultTheme
  })

  // Initialize MTG theme from localStorage
  const [mtgTheme, setMtgThemeState] = useState<MtgColorTheme>(() => {
    if (!isThemeToggleEnabled) return 'none'
    if (typeof window === 'undefined') return 'none'
    const stored = localStorage.getItem(MTG_THEME_STORAGE_KEY)
    if (stored === 'none' || stored === 'white' || stored === 'blue' || 
        stored === 'black' || stored === 'red' || stored === 'green') {
      return stored
    }
    return 'none'
  })

  // Compute effective theme - when flag is disabled, always use 'dark'
  const effectiveTheme = useMemo<Theme>(() => {
    if (!isThemeToggleEnabled) return 'dark'
    return theme
  }, [theme])

  // Track system theme separately for 'system' theme mode
  const [systemResolvedTheme, setSystemResolvedTheme] = useState<ResolvedTheme>(
    () => getSystemTheme(),
  )

  // Compute resolved theme - use memo for most cases, state for system theme updates
  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    if (!isThemeToggleEnabled) return 'dark'
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
    if (!isThemeToggleEnabled) return
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
    if (!isThemeToggleEnabled) {
      setThemeState('dark')
      return
    }
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }, [])

  const setMtgTheme = useCallback((newMtgTheme: MtgColorTheme) => {
    if (!isThemeToggleEnabled) {
      setMtgThemeState('none')
      return
    }
    setMtgThemeState(newMtgTheme)
    localStorage.setItem(MTG_THEME_STORAGE_KEY, newMtgTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    if (!isThemeToggleEnabled) {
      setTheme('dark')
      return
    }
    // Toggle between light and dark only (not system)
    const newTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }, [resolvedTheme, setTheme])

  const value: ThemeContextValue = {
    theme: effectiveTheme,
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
