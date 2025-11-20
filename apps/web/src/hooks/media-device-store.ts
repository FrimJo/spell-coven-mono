import type { MediaDeviceInfo } from '@/lib/media-stream-manager'
import { enumerateMediaDevices } from '@/lib/media-stream-manager'

export interface MediaDeviceChangeInfo {
  videoinput: MediaDeviceInfo[]
  audioinput: MediaDeviceInfo[]
  audiooutput: MediaDeviceInfo[]
  timestamp: number
}

export interface MediaDeviceKindInfo {
  devices: MediaDeviceInfo[]
  timestamp: number
}

/**
 * Shared device cache and enumeration logic
 */
const sharedDeviceCache = {
  devices: {
    videoinput: [] as MediaDeviceInfo[],
    audioinput: [] as MediaDeviceInfo[],
    audiooutput: [] as MediaDeviceInfo[],
    timestamp: 0,
  } as MediaDeviceChangeInfo,
  enumerationPromise: null as Promise<MediaDeviceInfo[]> | null,
  emptyDevicePromises: new Map<
    'videoinput' | 'audioinput' | 'audiooutput',
    Set<() => void>
  >(),
  allStoreListeners: new Map<
    'videoinput' | 'audioinput' | 'audiooutput',
    Set<() => void>
  >(),
  boundHandleDeviceChange: null as (() => void) | null,

  /**
   * Enumerate devices and update cache
   * Returns a promise that resolves with all devices
   */
  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await enumerateMediaDevices()

    this.devices = {
      videoinput: devices.filter((d) => d.kind === 'videoinput'),
      audioinput: devices.filter((d) => d.kind === 'audioinput'),
      audiooutput: devices.filter((d) => d.kind === 'audiooutput'),
      timestamp: Date.now(),
    }

    // Resolve promises for kinds that now have devices available
    for (const [kind, resolveFunctions] of this.emptyDevicePromises.entries()) {
      if (this.devices[kind].length > 0) {
        resolveFunctions.forEach((resolve) => resolve())
        resolveFunctions.clear()
      }
    }

    // Notify all store listeners
    for (const [_kind, listeners] of this.allStoreListeners.entries()) {
      listeners.forEach((l) => l())
    }

    return devices
  },

  /**
   * Get or create enumeration promise
   * Creates a new promise if one doesn't exist or if timestamp is 0 (not initialized)
   */
  getEnumerationPromise(): Promise<MediaDeviceInfo[]> {
    // Create new promise if not initialized or if promise doesn't exist
    if (this.devices.timestamp === 0 || !this.enumerationPromise) {
      this.enumerationPromise = this.enumerateDevices()
    }
    return this.enumerationPromise
  },

  handleDeviceChange(): void {
    // Create a new enumeration promise when device changes
    // This invalidates the previous promise and triggers re-enumeration
    this.enumerationPromise = this.enumerateDevices()
  },

  /**
   * Check if there are any active listeners across all stores
   */
  hasAnyListeners(): boolean {
    return Array.from(this.allStoreListeners.values()).some(
      (set) => set.size > 0,
    )
  },
}

/**
 * Create a subscription manager for a specific device kind
 */
export function createMediaDeviceStoreForKind(
  kind: 'videoinput' | 'audioinput' | 'audiooutput',
) {
  // Get or create the listeners set for this kind
  if (!sharedDeviceCache.allStoreListeners.has(kind)) {
    sharedDeviceCache.allStoreListeners.set(kind, new Set())
  }
  const listeners = sharedDeviceCache.allStoreListeners.get(kind)!

  /**
   * Get current device state for this specific kind
   */
  function getSnapshot(): MediaDeviceKindInfo {
    return {
      devices: sharedDeviceCache.devices[kind],
      timestamp: sharedDeviceCache.devices.timestamp,
    }
  }

  /**
   * Get server snapshot (for SSR, returns empty state)
   */
  function getServerSnapshot(): MediaDeviceKindInfo {
    return {
      devices: [],
      timestamp: 0,
    }
  }

  /**
   * Subscribe to device changes for this specific kind
   */
  function subscribe(listener: () => void): () => void {
    // Check if this is the first listener across all stores (before adding)
    const wasFirstListener = !sharedDeviceCache.hasAnyListeners()

    listeners.add(listener)

    // Attach event listener if this was the first listener
    if (wasFirstListener) {
      sharedDeviceCache.boundHandleDeviceChange =
        sharedDeviceCache.handleDeviceChange.bind(sharedDeviceCache)
      navigator.mediaDevices.addEventListener(
        'devicechange',
        sharedDeviceCache.boundHandleDeviceChange,
      )
    }

    // Return unsubscribe function
    return () => {
      listeners.delete(listener)

      // If this was the last listener, clean up event listener
      if (
        !sharedDeviceCache.hasAnyListeners() &&
        sharedDeviceCache.boundHandleDeviceChange
      ) {
        navigator.mediaDevices.removeEventListener(
          'devicechange',
          sharedDeviceCache.boundHandleDeviceChange,
        )
        sharedDeviceCache.boundHandleDeviceChange = null
        // Reset state when last subscriber unsubscribes
        sharedDeviceCache.devices = {
          videoinput: [],
          audioinput: [],
          audiooutput: [],
          timestamp: 0,
        }
        sharedDeviceCache.enumerationPromise = null
        sharedDeviceCache.emptyDevicePromises.clear()
      }
    }
  }

  /**
   * Get promise that resolves when devices of this kind become available
   */
  function getEmptyDevicesPromise(): Promise<void> | null {
    // If devices are already available, no promise needed
    if (sharedDeviceCache.devices[kind].length > 0) {
      return null
    }

    // Create a promise that resolves when devices become available
    return new Promise<void>((resolve) => {
      if (!sharedDeviceCache.emptyDevicePromises.has(kind)) {
        sharedDeviceCache.emptyDevicePromises.set(kind, new Set())
      }
      sharedDeviceCache.emptyDevicePromises.get(kind)!.add(resolve)
    })
  }

  return {
    getSnapshot,
    getServerSnapshot,
    subscribe,
    getEnumerationPromise: () => sharedDeviceCache.getEnumerationPromise(),
    getEmptyDevicesPromise,
  }
}

// Create store instances per kind (singletons)
export const mediaDeviceStores = {
  videoinput: createMediaDeviceStoreForKind('videoinput'),
  audioinput: createMediaDeviceStoreForKind('audioinput'),
  audiooutput: createMediaDeviceStoreForKind('audiooutput'),
} as const
