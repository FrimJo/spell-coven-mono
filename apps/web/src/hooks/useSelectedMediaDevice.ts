/**
 * Hook for managing selected media device with localStorage persistence
 *
 * Stores and retrieves the user's selected device ID from localStorage
 * so the same device is used across sessions
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'mtg-selected-video-device'

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
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Only restore if it matches the requested kind
        if (parsed.kind === kind && parsed.deviceId) {
          setSelectedDeviceId(parsed.deviceId)
        }
      }
    } catch (error) {
      console.error('[useSelectedMediaDevice] Failed to load from localStorage:', error)
    } finally {
      setIsHydrated(true)
    }
  }, [kind])

  // Save to localStorage
  const saveSelectedDevice = useCallback(
    (deviceId: string) => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            kind,
            deviceId,
            timestamp: Date.now(),
          }),
        )
        setSelectedDeviceId(deviceId)
      } catch (error) {
        console.error('[useSelectedMediaDevice] Failed to save to localStorage:', error)
      }
    },
    [kind],
  )

  // Clear from localStorage
  const clearSelectedDevice = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setSelectedDeviceId(null)
    } catch (error) {
      console.error('[useSelectedMediaDevice] Failed to clear localStorage:', error)
    }
  }, [])

  return {
    selectedDeviceId: isHydrated ? selectedDeviceId : null,
    saveSelectedDevice,
    clearSelectedDevice,
  }
}
