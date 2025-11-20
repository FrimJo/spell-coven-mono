import { use, useSyncExternalStore } from 'react'

import type { MediaDeviceKindInfo } from './media-device-store'
import { mediaDeviceStores } from './media-device-store'

// Re-export types for convenience
export type { MediaDeviceKindInfo } from './media-device-store'
export type { MediaDeviceChangeInfo } from './media-device-store'

/**
 * Hook to listen for media device changes for a specific device kind
 *
 * Uses React 19's `use` hook for Suspense support - wrap components using this hook
 * in a Suspense boundary to show a fallback while devices are being enumerated.
 *
 * Suspends until devices of the specified kind are available.
 * Automatically re-enumerates when devicechange events fire.
 *
 * @param kind - Device kind to wait for and subscribe to changes for
 * @returns Devices for the specified kind along with timestamp
 *
 * @example Wait for video input devices
 * ```tsx
 * function CameraPreview() {
 *   const { devices } = useMediaDeviceChange('videoinput') // Suspends until camera is plugged in
 *   // ... render camera preview
 * }
 * ```
 *
 * @example Wait for audio input devices
 * ```tsx
 * function MicrophoneSelector() {
 *   const { devices } = useMediaDeviceChange('audioinput')
 *   return (
 *     <select>
 *       {devices.map(device => (
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
 *   <CameraPreview />
 * </Suspense>
 * ```
 */
export function useMediaDeviceChange(
  kind: 'videoinput' | 'audioinput' | 'audiooutput',
): MediaDeviceKindInfo {
  const store = mediaDeviceStores[kind]

  // Subscribe to device changes
  const deviceInfo = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  )

  // Use React 19's `use` hook to wait for enumeration
  const enumerationPromise = store.getEnumerationPromise()
  use(enumerationPromise)

  // If no devices available, throw a promise to trigger Suspense
  // This promise resolves when devicechange event fires and devices become available
  const emptyDevicesPromise = store.getEmptyDevicesPromise()
  if (emptyDevicesPromise) {
    throw emptyDevicesPromise
  }

  return deviceInfo
}
