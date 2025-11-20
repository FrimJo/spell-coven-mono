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

const STORAGE_KEY = 'mtg-selected-media-devices'

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

  /**
   * Save all devices to localStorage in the new format
   */
  function saveAllDevicesToStorage(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          videoinput: cachedState.videoinput,
          audioinput: cachedState.audioinput,
          audiooutput: cachedState.audiooutput,
          timestamp: Date.now(),
        }),
      )
    } catch (error) {
      console.error(
        '[createSelectedDeviceStore] Failed to save all devices to localStorage:',
        error,
      )
    }
  }

  // Load initial state from localStorage
  function loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Support both old format (single device) and new format (all devices)
        if (parsed.videoinput || parsed.audioinput || parsed.audiooutput) {
          // New format: { videoinput: '...', audioinput: '...', audiooutput: '...' }
          cachedState = {
            videoinput: parsed.videoinput ?? null,
            audioinput: parsed.audioinput ?? null,
            audiooutput: parsed.audiooutput ?? null,
          }
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
   * Stores all three device kinds together to avoid overwriting
   */
  function saveDevice(
    kind: 'videoinput' | 'audioinput' | 'audiooutput',
    deviceId: string,
  ): void {
    try {
      // Update cache
      cachedState[kind] = deviceId

      // Persist all devices to localStorage (new format)
      saveAllDevicesToStorage()

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
   *
   * If a default value is provided and no device is currently selected for that kind,
   * the default will be persisted to localStorage. This ensures that:
   * 1. On first load (no localStorage), the default is used and saved
   * 2. On subsequent loads, the saved value is loaded from localStorage
   * 3. User can override by calling saveSelectedDevice() explicitly
   */
  function subscribe(
    listener: () => void,
    defaultValue: Partial<SelectedDeviceState> | undefined,
  ): () => void {
    listeners.add(listener)

    // Apply defaults if provided (only if no device is selected in localStorage)
    // This persists the default on first use, then it will be loaded from localStorage
    if (defaultValue) {
      if (cachedState.audioinput == null && defaultValue.audioinput != null) {
        saveDevice('audioinput', defaultValue.audioinput)
      }
      if (cachedState.audiooutput == null && defaultValue.audiooutput != null) {
        saveDevice('audiooutput', defaultValue.audiooutput)
      }
      if (cachedState.videoinput == null && defaultValue.videoinput != null) {
        saveDevice('videoinput', defaultValue.videoinput)
      }
    }

    return () => listeners.delete(listener)
  }

  // Load initial state from localStorage once when store is created
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
export const selectedDeviceStore = createSelectedDeviceStore()

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
 * @param defaultDeviceId Optional default device ID. If provided and no device is
 *                        selected in localStorage, this will be used and persisted.
 *                        On subsequent loads, the persisted value will be used instead.
 * @returns Object with selectedDeviceId and functions to save/clear
 *
 * @example
 * ```tsx
 * function CameraSelector() {
 *   const { selectedDeviceId, saveSelectedDevice } = useSelectedMediaDevice(
 *     'videoinput',
 *     defaultCameraId // Will be used and saved if nothing is in localStorage
 *   )
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
  defaultDeviceId: string,
): UseSelectedMediaDeviceReturn {
  // Use useSyncExternalStore to sync with the device store
  // All components using this hook will re-render when any device selection changes
  const state = useSyncExternalStore(
    (listener) =>
      selectedDeviceStore.subscribe(listener, { [kind]: defaultDeviceId }),
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
