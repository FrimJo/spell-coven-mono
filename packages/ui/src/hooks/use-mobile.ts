import * as React from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * Global store for mobile breakpoint state
 * Shares a single MediaQueryList across all components
 */
const mobileStore = {
  mql: null as MediaQueryList | null,
  listeners: new Set<() => void>(),
}

// Initialize MediaQueryList at module load time (client-side only)
if (typeof window !== 'undefined') {
  mobileStore.mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}

/**
 * Handles media query changes and notifies all subscribed listeners
 */
const handleChange = () => {
  mobileStore.listeners.forEach((listener) => listener())
}

/**
 * Subscribe function for useSyncExternalStore
 * Manages the global MediaQueryList listener lifecycle
 */
const subscribe = (listener: () => void) => {
  if (typeof window === 'undefined' || !mobileStore.mql) {
    return () => undefined
  }

  // Add listener before potentially setting up event listener
  mobileStore.listeners.add(listener)

  // Only add media query listener when first component subscribes
  if (mobileStore.listeners.size === 1) {
    mobileStore.mql.addEventListener('change', handleChange)
  }

  return () => {
    mobileStore.listeners.delete(listener)
    // Remove media query listener when last component unsubscribes
    if (mobileStore.listeners.size === 0 && mobileStore.mql) {
      mobileStore.mql.removeEventListener('change', handleChange)
    }
  }
}

/**
 * Pure snapshot function for useSyncExternalStore
 * Returns current mobile breakpoint match state
 */
const getSnapshot = (): boolean => {
  if (typeof window === 'undefined' || !mobileStore.mql) {
    return false
  }
  return mobileStore.mql.matches
}

/**
 * Server-side snapshot function
 * Returns false for SSR (assumes desktop by default)
 */
const getServerSnapshot = (): boolean => false

/**
 * Hook for detecting mobile viewport based on screen width
 *
 * Uses a global MediaQueryList to efficiently track viewport changes
 * across all components. The breakpoint is set at 768px (mobile < 768px).
 *
 * @returns true if viewport width is below mobile breakpoint, false otherwise
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isMobile = useIsMobile()
 *   return <div>{isMobile ? 'Mobile' : 'Desktop'} view</div>
 * }
 * ```
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
