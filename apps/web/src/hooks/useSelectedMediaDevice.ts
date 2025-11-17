/**
 * Hook for managing selected media device with localStorage persistence
 *
 * Stores and retrieves the user's selected device ID from localStorage
 * so the same device is used across sessions.
 *
 * Uses useSyncExternalStore with a cached store pattern to ensure all
 * components using this hook re-render when the device selection changes.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'mtg-selected-video-device'

export interface SelectedDeviceState {
  videoinput: string | null
  audioinput: string | null
  audiooutput: string | null
}

/**
 * Create a store for managing selected media devices
 * Uses a cache to avoid repeated localStorage reads
 */
function createSelectedDeviceStore() {
  const listeners: Set<() => void> = new Set()

  // Initialize cache from localStorage
  let cachedState: SelectedDeviceState = {
    videoinput: null,
    audioinput: null,
    audiooutput: null,
  }

  // Load initial state from localStorage
  function loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.kind && parsed.deviceId) {
          cachedState[parsed.kind as keyof SelectedDeviceState] =
            parsed.deviceId
        }
      }
    } catch (error) {
      console.error(
        '[createSelectedDeviceStore] Failed to load from localStorage:',
        error,
      )
    }
  }

  /**
   * Get current device state (synchronous for useSyncExternalStore)
   */
  function getSnapshot(): SelectedDeviceState {
    return cachedState
  }

  /**
   * Get server snapshot (for SSR, returns empty state)
   */
  function getServerSnapshot(): SelectedDeviceState {
    return {
      videoinput: null,
      audioinput: null,
      audiooutput: null,
    }
  }

  /**
   * Notify all listeners of state change
   */
  function notifyListeners(): void {
    listeners.forEach((listener) => listener())
  }

  /**
   * Save device to localStorage and update cache
   */
  function saveDevice(
    kind: 'videoinput' | 'audioinput' | 'audiooutput',
    deviceId: string,
  ): void {
    try {
      // Update cache
      cachedState[kind] = deviceId

      // Persist to localStorage
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          kind,
          deviceId,
          timestamp: Date.now(),
        }),
      )
      // Notify listeners
      notifyListeners()
    } catch (error) {
      console.error(
        '[createSelectedDeviceStore] Failed to save to localStorage:',
        error,
      )
    }
  }

  /**
   * Clear device from cache and localStorage
   */
  function clearDevice(): void {
    try {
      cachedState = {
        videoinput: null,
        audioinput: null,
        audiooutput: null,
      }
      localStorage.removeItem(STORAGE_KEY)
      notifyListeners()
    } catch (error) {
      console.error(
        '[createSelectedDeviceStore] Failed to clear localStorage:',
        error,
      )
    }
  }

  /**
   * Subscribe to state changes
   */
  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  // Load initial state on store creation
  loadFromStorage()

  return {
    getSnapshot,
    getServerSnapshot,
    subscribe,
    saveDevice,
    clearDevice,
  }
}

// Create singleton store instance
const selectedDeviceStore = createSelectedDeviceStore()

export interface UseSelectedMediaDeviceReturn {
  /** Currently selected device ID from localStorage */
  selectedDeviceId: string | null
  /** Save device ID to localStorage */
  saveSelectedDevice: (deviceId: string) => void
  /** Clear saved device from localStorage */
  clearSelectedDevice: () => void
}

/**
 * Hook to manage selected media device with localStorage persistence
 *
 * @param kind Type of media device ('videoinput', 'audioinput', 'audiooutput')
 * @returns Object with selectedDeviceId and functions to save/clear
 *
 * @example
 * ```tsx
 * function CameraSelector() {
 *   const { selectedDeviceId, saveSelectedDevice } = useSelectedMediaDevice('videoinput')
 *
 *   return (
 *     <select
 *       value={selectedDeviceId || ''}
 *       onChange={(e) => saveSelectedDevice(e.target.value)}
 *     >
 *       {devices.map(device => (
 *         <option key={device.deviceId} value={device.deviceId}>
 *           {device.label}
 *         </option>
 *       ))}
 *     </select>
 *   )
 * }
 * ```
 */
export function useSelectedMediaDevice(
  kind: 'videoinput' | 'audioinput' | 'audiooutput',
): UseSelectedMediaDeviceReturn {
  // Use useSyncExternalStore to sync with the device store
  // All components using this hook will re-render when any device selection changes
  const state = useSyncExternalStore(
    selectedDeviceStore.subscribe,
    selectedDeviceStore.getSnapshot,
    selectedDeviceStore.getServerSnapshot,
  )

  // Save device to store
  const saveSelectedDevice = useCallback(
    (deviceId: string) => selectedDeviceStore.saveDevice(kind, deviceId),
    [kind],
  )

  // Clear device from store
  const clearSelectedDevice = useCallback(() => {
    selectedDeviceStore.clearDevice()
  }, [])

  return useMemo(
    () => ({
      selectedDeviceId: state[kind],
      saveSelectedDevice,
      clearSelectedDevice,
    }),
    [clearSelectedDevice, kind, saveSelectedDevice, state],
  )
}
