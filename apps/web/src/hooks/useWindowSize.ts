import { useSyncExternalStore } from 'react'

interface WindowSize {
  width: number
  height: number
}

/**
 * Global store for window size state
 * Shared across all components to avoid redundant resize listeners
 */
const windowSizeStore = {
  value: {
    width: 0,
    height: 0,
  } as WindowSize,
  listeners: new Set<() => void>(),
}

// Initialize window size at module load time (client-side only)
if (typeof window !== 'undefined') {
  windowSizeStore.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/**
 * Handles window resize events and notifies all subscribed listeners
 * Only updates if the size has actually changed to prevent unnecessary re-renders
 */
const handleResize = () => {
  if (typeof window === 'undefined') {
    return
  }

  const nextValue = {
    width: window.innerWidth,
    height: window.innerHeight,
  }

  if (
    nextValue.width === windowSizeStore.value.width &&
    nextValue.height === windowSizeStore.value.height
  ) {
    return
  }

  windowSizeStore.value = nextValue
  windowSizeStore.listeners.forEach((listener) => listener())
}

/**
 * Subscribe function for useSyncExternalStore
 * Manages the global resize listener lifecycle
 */
const subscribe = (listener: () => void) => {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  // Add listener before potentially setting up event listener
  windowSizeStore.listeners.add(listener)

  // Only add resize listener when first component subscribes
  if (windowSizeStore.listeners.size === 1) {
    window.addEventListener('resize', handleResize)
  }

  return () => {
    windowSizeStore.listeners.delete(listener)
    // Remove resize listener when last component unsubscribes
    if (windowSizeStore.listeners.size === 0) {
      window.removeEventListener('resize', handleResize)
    }
  }
}

/**
 * Pure snapshot function for useSyncExternalStore
 * Simply returns the current cached window size value
 */
const getSnapshot = (): WindowSize => {
  return windowSizeStore.value
}

/**
 * Server-side snapshot function
 * Returns default dimensions for SSR
 */
const getServerSnapshot = (): WindowSize => ({
  width: 0,
  height: 0,
})

/**
 * Hook for tracking window size changes
 *
 * Uses a global store to share window size state across all components,
 * preventing redundant resize event listeners. The hook automatically
 * subscribes/unsubscribes based on component lifecycle.
 *
 * @returns Current window size with width and height properties
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { width, height } = useWindowSize()
 *   return <div>Window is {width}x{height}</div>
 * }
 * ```
 */
export function useWindowSize() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
