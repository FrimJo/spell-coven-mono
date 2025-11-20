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
 * Shared cache and listeners across all store instances
 * This ensures all hook instances see updates when any instance changes localStorage
 */
const sharedState = {
  // Shared cache from localStorage (updated by all store instances)
  cachedState: {
    videoinput: null,
    audioinput: null,
    audiooutput: null,
  } as SelectedDeviceState,

  // Shared listeners across all store instances
  listeners: new Set<() => void>(),

  // Storage event handler for cross-tab synchronization
  boundStorageHandler: null as ((event: StorageEvent) => void) | null,

  /**
   * Handle storage events from other tabs/windows
   */
  handleStorageEvent(event: StorageEvent): void {
    // Only process events for our storage key
    if (event.key === STORAGE_KEY && event.newValue !== event.oldValue) {
      // Reload from localStorage to get the latest value from other tabs
      loadFromStorage()
      // Notify all listeners across all store instances
      this.listeners.forEach((listener) => listener())
    }
  },

  /**
   * Setup storage event listener if not already set up
   */
  setupStorageListener(): void {
    if (!this.boundStorageHandler && typeof window !== 'undefined') {
      this.boundStorageHandler = this.handleStorageEvent.bind(this)
      window.addEventListener('storage', this.boundStorageHandler)
    }
  },

  /**
   * Remove storage event listener (when all stores unsubscribe)
   */
  removeStorageListener(): void {
    if (this.boundStorageHandler && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.boundStorageHandler)
      this.boundStorageHandler = null
    }
  },
}

/**
 * Load state from localStorage into shared cache
 */
function loadFromStorage(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Support both old format (single device) and new format (all devices)
      if (parsed.videoinput || parsed.audioinput || parsed.audiooutput) {
        // New format: { videoinput: '...', audioinput: '...', audiooutput: '...' }
        sharedState.cachedState = {
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
 * Create a store for managing selected media devices
 * Uses a shared cache to ensure all instances stay in sync
 */
function createSelectedDeviceStore(options?: {
  kind: 'videoinput' | 'audioinput' | 'audiooutput'
  defaultValue: string
  availableDeviceIds: readonly string[]
}) {
  /**
   * Save all devices to localStorage in the new format
   */
  function saveAllDevicesToStorage(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          videoinput: sharedState.cachedState.videoinput,
          audioinput: sharedState.cachedState.audioinput,
          audiooutput: sharedState.cachedState.audiooutput,
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

  /**
   * Get current device state (synchronous for useSyncExternalStore)
   */
  function getSnapshot(): SelectedDeviceState {
    return sharedState.cachedState
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
   * Notify all listeners of state change (across all store instances)
   */
  function notifyListeners(): void {
    sharedState.listeners.forEach((listener) => listener())
  }

  /**
   * Save device to localStorage and update shared cache
   * Stores all three device kinds together to avoid overwriting
   */
  function saveDevice(
    kind: 'videoinput' | 'audioinput' | 'audiooutput',
    deviceId: string,
  ): void {
    try {
      // Update shared cache
      sharedState.cachedState[kind] = deviceId

      // Persist all devices to localStorage (new format)
      saveAllDevicesToStorage()

      // Notify all listeners across all store instances
      notifyListeners()
    } catch (error) {
      console.error(
        '[createSelectedDeviceStore] Failed to save to localStorage:',
        error,
      )
    }
  }

  /**
   * Clear device from shared cache and localStorage
   */
  function clearDevice(): void {
    try {
      sharedState.cachedState = {
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
   *
   * If validation info is provided, validates that the stored device exists in the
   * available devices list and updates to default if not. This happens synchronously
   * during subscription, ensuring the first render has the correct value.
   *
   * Also sets up storage event listener for cross-tab synchronization.
   */
  function subscribe(listener: () => void): () => void {
    const wasFirstListener = sharedState.listeners.size === 0
    sharedState.listeners.add(listener)

    // Setup storage event listener on first subscription
    if (wasFirstListener) {
      sharedState.setupStorageListener()
    }

    if (options) {
      const storedDeviceId = sharedState.cachedState[options.kind]
      // Apply defaults if provided (only if no device is selected in localStorage)
      // This persists the default on first use, then it will be loaded from localStorage
      if (storedDeviceId == null) {
        saveDevice(options.kind, options.defaultValue)
      } else {
        const deviceExists = options.availableDeviceIds.includes(storedDeviceId)
        if (!deviceExists) {
          saveDevice(options.kind, options.defaultValue)
        }
      }
    }

    return () => {
      sharedState.listeners.delete(listener)
      // Remove storage event listener when last subscriber unsubscribes
      if (sharedState.listeners.size === 0) {
        sharedState.removeStorageListener()
      }
    }
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

export interface UseSelectedMediaDeviceReturn {
  /** Currently selected device ID from localStorage */
  selectedDeviceId: string
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
  devices: MediaDeviceInfo[] | readonly [MediaDeviceInfo],
): UseSelectedMediaDeviceReturn {
  console.log('useSelectedMediaDevice', { kind, devices })
  // Create singleton store instance
  const selectedDeviceStore = useMemo(() => {
    const defaultDevice =
      devices.find((device) => device.deviceId === 'default') ?? devices[0]
    console.log('useSelectedMediaDevice defaultDevice', { defaultDevice })
    return createSelectedDeviceStore({
      kind,
      defaultValue: defaultDevice.deviceId,
      availableDeviceIds: devices.map((device) => device.deviceId),
    })
  }, [kind, devices])

  // Use useSyncExternalStore to sync with the device store
  // All components using this hook will re-render when any device selection changes
  // Validation happens synchronously in subscribe, ensuring first render is correct
  const state = useSyncExternalStore(
    selectedDeviceStore.subscribe,
    selectedDeviceStore.getSnapshot,
    selectedDeviceStore.getServerSnapshot,
  )

  // Save device to store
  const saveSelectedDevice = useCallback(
    (deviceId: string) => selectedDeviceStore.saveDevice(kind, deviceId),
    [kind, selectedDeviceStore],
  )

  // Clear device from store
  const clearSelectedDevice = useCallback(() => {
    selectedDeviceStore.clearDevice()
  }, [selectedDeviceStore])

  return useMemo(() => {
    const selectedDeviceId = state[kind]
    if (selectedDeviceId == null)
      throw new Error(`No device selected for kind: ${kind}`)
    return {
      selectedDeviceId,
      saveSelectedDevice,
      clearSelectedDevice,
    }
  }, [clearSelectedDevice, kind, saveSelectedDevice, state])
}
