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

import { useSyncExternalStore } from 'react'
import type { MediaDeviceInfo } from '@/lib/media-stream-manager'

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

  /**
   * Enumerate devices synchronously from cache
   * The cache is updated when devicechange event fires
   */
  function updateDeviceCache(): void {
    // Use sync enumeration - this is fast since it uses cached device info
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      cachedDevices = {
        videoinput: devices.filter((d) => d.kind === 'videoinput'),
        audioinput: devices.filter((d) => d.kind === 'audioinput'),
        audiooutput: devices.filter((d) => d.kind === 'audiooutput'),
        timestamp: Date.now(),
      }
    })
  }

  /**
   * Get current device state (synchronous for useSyncExternalStore)
   */
  function getSnapshot(): MediaDeviceChangeInfo {
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
   */
  function subscribe(listener: () => void): () => void {
    listeners.add(listener)

    const handleDeviceChange = () => {
      console.log('[useMediaDeviceChange] Device list changed')
      // Update cache asynchronously
      updateDeviceCache()
      // Notify all listeners
      listeners.forEach((l) => l())
    }

    // Initial cache population
    updateDeviceCache()

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    // Return unsubscribe function
    return () => {
      listeners.delete(listener)
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        handleDeviceChange,
      )
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
 */
export function useMediaDeviceChange(): MediaDeviceChangeInfo {
  const devices = useSyncExternalStore(
    mediaDeviceStore.subscribe,
    mediaDeviceStore.getSnapshot,
    mediaDeviceStore.getServerSnapshot,
  )

  return devices
}
