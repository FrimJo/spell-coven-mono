import type { MediaDeviceInfo } from '@/lib/media-stream-manager'
import { use, useSyncExternalStore } from 'react'
import { enumerateMediaDevices } from '@/lib/media-stream-manager'

/**
 * useMediaDeviceChange - Listen to media device changes using useSyncExternalStore
 *
 * Provides a modern React way to subscribe to device changes (plugged/unplugged)
 * using the browser's devicechange event via useSyncExternalStore.
 *
 * @example
 * ```tsx
 * const devices = useMediaDeviceChange()
 * // Re-renders whenever devices are added/removed
 * ```
 *
 * @example With callback
 * ```tsx
 * const devices = useMediaDeviceChange(() => {
 *   console.log('Devices changed!')
 * })
 * ```
 */

export interface MediaDeviceChangeInfo {
  videoinput: MediaDeviceInfo[]
  audioinput: MediaDeviceInfo[]
  audiooutput: MediaDeviceInfo[]
  timestamp: number
}

/**
 * Create a subscription manager for media device changes
 * This is the external store that useSyncExternalStore subscribes to
 */
function createMediaDeviceStore() {
  const listeners: Set<() => void> = new Set()

  // Initialize cache synchronously with empty state
  // Will be populated on first subscription
  let cachedDevices: MediaDeviceChangeInfo = {
    videoinput: [],
    audioinput: [],
    audiooutput: [],
    timestamp: 0,
  }

  // Track if event listener is attached
  let isEventListenerAttached = false

  // Promise resolver for Suspense - resolves when initial enumeration completes
  // We only store the resolve function; the promise is created on-demand
  let resolveInitialization: (() => void) | null = null

  /**
   * Enumerate devices synchronously from cache
   * The cache is updated when devicechange event fires
   */
  async function updateDeviceCache(): Promise<void> {
    console.log('updateDeviceCache', { cachedDevices })
    // Use sync enumeration - this is fast since it uses cached device info
    const devices = await enumerateMediaDevices()

    const wasInitialized = cachedDevices.timestamp !== 0

    cachedDevices = {
      videoinput: devices.filter((d) => d.kind === 'videoinput'),
      audioinput: devices.filter((d) => d.kind === 'audioinput'),
      audiooutput: devices.filter((d) => d.kind === 'audiooutput'),
      timestamp: Date.now(),
    }

    // Resolve the promise if this was the first initialization
    if (!wasInitialized && resolveInitialization) {
      resolveInitialization()
      resolveInitialization = null
    }

    // Notify all listeners after cache update
    listeners.forEach((l) => l())
  }

  /**
   * Handle device change event - shared across all subscriptions
   */
  function handleDeviceChange(): void {
    updateDeviceCache()
  }

  /**
   * Get current device state (synchronous for useSyncExternalStore)
   * Always returns current state, even if not initialized
   */
  function getSnapshot(): MediaDeviceChangeInfo {
    console.log('getSnapshot', { cachedDevices })
    return cachedDevices
  }

  // Store the promise so multiple callers get the same instance
  let initializationPromise: Promise<void> | null = null

  /**
   * Get or create the initialization promise
   * Returns null if already initialized, otherwise returns a promise that resolves when initialization completes
   */
  function getInitializationPromise(): Promise<void> | null {
    console.log('getInitializationPromise', { cachedDevices })
    // If already initialized, no promise needed
    if (cachedDevices.timestamp !== 0) {
      return null
    }

    // Create promise if it doesn't exist (lazy initialization)
    if (!initializationPromise) {
      initializationPromise = new Promise<void>((resolve) => {
        resolveInitialization = resolve
      })

      // CRITICAL: Start initialization immediately when promise is created
      // This ensures initialization happens even if subscribe() hasn't been called yet
      // Attach event listener if not already attached
      if (!isEventListenerAttached) {
        navigator.mediaDevices.addEventListener(
          'devicechange',
          handleDeviceChange,
        )
        isEventListenerAttached = true
      }

      // Trigger initial enumeration - this will resolve the promise when complete
      updateDeviceCache()
    }

    return initializationPromise
  }

  /**
   * Get server snapshot (for SSR, returns empty state)
   */
  function getServerSnapshot(): MediaDeviceChangeInfo {
    return {
      videoinput: [],
      audioinput: [],
      audiooutput: [],
      timestamp: 0,
    }
  }

  /**
   * Subscribe to device changes
   * The event listener is attached only once when the first subscriber subscribes,
   * and removed when the last subscriber unsubscribes.
   */
  function subscribe(listener: () => void): () => void {
    console.log('subscribe', { listeners, isEventListenerAttached })
    listeners.add(listener)

    // Attach event listener and start initialization on first subscription
    if (!isEventListenerAttached) {
      navigator.mediaDevices.addEventListener(
        'devicechange',
        handleDeviceChange,
      )
      isEventListenerAttached = true
    }

    // Return unsubscribe function
    return () => {
      listeners.delete(listener)

      // Remove event listener only when last subscriber unsubscribes
      if (listeners.size === 0 && isEventListenerAttached) {
        navigator.mediaDevices.removeEventListener(
          'devicechange',
          handleDeviceChange,
        )
        isEventListenerAttached = false
        // Reset state when last subscriber unsubscribes
        cachedDevices = {
          videoinput: [],
          audioinput: [],
          audiooutput: [],
          timestamp: 0,
        }
        resolveInitialization = null
        // Null the promise so a new one can be created if needed after reset
        initializationPromise = null
      }
    }
  }

  return {
    getSnapshot,
    getServerSnapshot,
    subscribe,
    getInitializationPromise,
  }
}

// Create a singleton store instance
const mediaDeviceStore = createMediaDeviceStore()

/**
 * Hook to listen for media device changes
 *
 * Uses React 19's `use` hook for Suspense support - wrap components using this hook
 * in a Suspense boundary to show a fallback while devices are being enumerated.
 *
 * @returns Current device state with videoinput, audioinput, audiooutput arrays
 *
 * @example
 * ```tsx
 * function CameraSelector() {
 *   const devices = useMediaDeviceChange()
 *
 *   return (
 *     <select>
 *       {devices.videoinput.map(device => (
 *         <option key={device.deviceId} value={device.deviceId}>
 *           {device.label}
 *         </option>
 *       ))}
 *     </select>
 *   )
 * }
 * ```
 *
 * @example With Suspense
 * ```tsx
 * <Suspense fallback={<div>Loading devices...</div>}>
 *   <CameraSelector />
 * </Suspense>
 * ```
 */
export function useMediaDeviceChange(): MediaDeviceChangeInfo {
  const devices = useSyncExternalStore(
    mediaDeviceStore.subscribe,
    mediaDeviceStore.getSnapshot,
    mediaDeviceStore.getServerSnapshot,
  )

  // Use React 19's `use` hook to handle initialization promise
  // This suspends the component until devices are enumerated
  const initializationPromise = mediaDeviceStore.getInitializationPromise()
  if (initializationPromise) {
    use(initializationPromise)
  }

  return devices
}
