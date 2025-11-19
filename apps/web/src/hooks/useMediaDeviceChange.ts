import type { MediaDeviceInfo } from '@/lib/media-stream-manager'
import { useSyncExternalStore } from 'react'
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

  // Track if cache has been initialized (timestamp > 0 means initialized)
  let initializationPromise: Promise<void> | null = null

  /**
   * Enumerate devices synchronously from cache
   * The cache is updated when devicechange event fires
   */
  async function updateDeviceCache(): Promise<void> {
    // Use sync enumeration - this is fast since it uses cached device info
    const devices = await enumerateMediaDevices()

    cachedDevices = {
      videoinput: devices.filter((d) => d.kind === 'videoinput'),
      audioinput: devices.filter((d) => d.kind === 'audioinput'),
      audiooutput: devices.filter((d) => d.kind === 'audiooutput'),
      timestamp: Date.now(),
    }

    // Notify all listeners after cache update
    listeners.forEach((l) => l())
  }

  /**
   * Handle device change event - shared across all subscriptions
   */
  function handleDeviceChange(): void {
    console.log('[useMediaDeviceChange] Device list changed')
    // Update cache asynchronously
    updateDeviceCache()
  }

  /**
   * Get current device state (synchronous for useSyncExternalStore)
   * Throws a promise if cache hasn't been initialized yet (for Suspense)
   */
  function getSnapshot(): MediaDeviceChangeInfo {
    // If cache hasn't been initialized (timestamp === 0), throw promise for Suspense
    if (cachedDevices.timestamp === 0 && initializationPromise) {
      throw initializationPromise
    }
    return cachedDevices
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
    listeners.add(listener)

    // Attach event listener only on first subscription
    if (!isEventListenerAttached) {
      navigator.mediaDevices.addEventListener(
        'devicechange',
        handleDeviceChange,
      )
      isEventListenerAttached = true

      // Create initialization promise for Suspense support
      // The promise resolves when updateDeviceCache completes
      if (!initializationPromise) {
        initializationPromise = updateDeviceCache().then(() => {
          // Clear the promise after it resolves so subsequent calls don't suspend
          initializationPromise = null
        })
      }

      // Initial cache population (already started above via promise creation)
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
        // Reset initialization state when last subscriber unsubscribes
        initializationPromise = null
        cachedDevices = {
          videoinput: [],
          audioinput: [],
          audiooutput: [],
          timestamp: 0,
        }
      }
    }
  }

  return {
    getSnapshot,
    getServerSnapshot,
    subscribe,
  }
}

// Create a singleton store instance
const mediaDeviceStore = createMediaDeviceStore()

/**
 * Hook to listen for media device changes
 *
 * Supports React Suspense - wrap components using this hook in a Suspense boundary
 * to show a fallback while devices are being enumerated.
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

  return devices
}
