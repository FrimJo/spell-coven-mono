/**
 * useMediaDevice - Unified hook for managing media device switching
 *
 * Consolidates all camera/microphone device management logic with best practices:
 * - Proper cleanup of old tracks
 * - Exact device constraints
 * - Automatic playback handling
 * - Race condition prevention
 * - Error handling
 */

import { useEffect, useMemo, useRef } from 'react'
import {
  enumerateMediaDevices,
  getMediaStream,
} from '@/lib/media-stream-manager'
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import { useSelectedMediaDevice } from './useSelectedMediaDevice'

export interface UseMediaDeviceOptions {
  /** Type of media device: 'video' or 'audio' */
  kind: MediaDeviceInfo['kind']
  /** Additional video constraints */
  videoConstraints?: MediaTrackConstraints
  /** Additional audio constraints */
  audioConstraints?: MediaTrackConstraints
  /** Callback when device changes successfully */
  onDeviceChanged?: (deviceId: string, stream: MediaStream) => void
  /** Callback when error occurs */
  onError?: (error: Error) => void
}

/**
 * Hook for managing media device (camera/microphone) with automatic cleanup
 * and device switching support.
 *
 * @example Video device with preview
 * ```tsx
 * const videoRef = useRef<HTMLVideoElement>(null)
 * const { devices, switchDevice, currentDeviceId } = useMediaDevice({
 *   kind: 'videoinput',
 *   videoRef,
 *   autoStart: true,
 * })
 *
 * return (
 *   <>
 *     <video ref={videoRef} autoPlay muted playsInline />
 *     <select value={currentDeviceId || ''} onChange={e => switchDevice(e.target.value)}>
 *       {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
 *     </select>
 *   </>
 * )
 * ```
 *
 * @example Audio device
 * ```tsx
 * const { devices, switchDevice, stream } = useMediaDevice({
 *   kind: 'audioinput',
 *   autoStart: true,
 * })
 * ```
 */

export function useMediaDevice(options: UseMediaDeviceOptions) {
  const {
    kind,
    videoConstraints = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audioConstraints = {},
    onDeviceChanged,
    onError,
  } = options

  const onDeviceChangedRef = useRef(onDeviceChanged)
  const onErrorRef = useRef(onError)

  const queryClient = useQueryClient()

  // Use React Query to cache device enumeration and prevent infinite re-renders
  // React's use() hook requires a stable promise reference from outside (like server components)
  // Creating promises in useMemo doesn't provide the stability needed for use()
  const {
    data: matchingKind = [],
    isPending: isEnumerating,
    error: enumerationError,
  } = useSuspenseQuery({
    queryKey: ['MediaDevices', kind],
    queryFn: async () => {
      const devices = await enumerateMediaDevices(kind)

      let filteredDevices = devices.filter((device) => device.deviceId !== '')

      const defaultDevice = devices.find(
        (device) => device.deviceId === 'default',
      )
      if (defaultDevice) {
        filteredDevices = filteredDevices.filter(
          (device) => device.groupId === defaultDevice.groupId,
        )
      }

      if (filteredDevices.length > 0) {
        return filteredDevices as readonly [MediaDeviceInfo] | MediaDeviceInfo[]
      }
      throw new Error(`No ${kind} devices found`)
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: true, // Re-enumerate when window regains focus (devices may have changed)
  })

  useEffect(() => {
    function handleDeviceChange() {
      queryClient.invalidateQueries({ queryKey: ['MediaDevices'] })
    }
    window.addEventListener('devicechange', handleDeviceChange)
    return () => window.removeEventListener('devicechange', handleDeviceChange)
  }, [queryClient])

  // Use selected device hook as state manager with localStorage persistence
  const { selectedDeviceId, saveSelectedDevice } = useSelectedMediaDevice(
    kind,
    matchingKind,
  )

  if (enumerationError) {
    console.error(
      '[useMediaDevice] Failed to enumerate devices:',
      enumerationError,
    )
  }

  if (matchingKind.length === 0 && !isEnumerating) {
    console.warn(
      '[useMediaDevice] enumerateMediaDevices returned 0 devices - this might indicate a browser restriction',
    )
  }

  // Memoize filtered devices to avoid recalculating filter/map operations
  // when matchingKind reference changes but content is the same
  const filteredDevices = useMemo(
    () =>
      matchingKind.map<MediaDeviceInfo>((device, index: number) => {
        // If no label, use a generic one with index (happens when permissions not granted)
        const baseLabel =
          device.label ||
          `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${index + 1}`
        return {
          ...device,
          label: index === 0 ? `${baseLabel} (Default)` : baseLabel,
        }
      }),
    [matchingKind, kind],
  )

  console.log(
    `[useMediaDevice] Final filtered ${kind} devices (${filteredDevices.length}):`,
    filteredDevices,
  )

  useEffect(() => {
    onDeviceChangedRef.current = onDeviceChanged
    onErrorRef.current = onError
  }, [onDeviceChanged, onError])

  const { data, isPending, error } = useQuery({
    queryKey: ['MediaStream', kind, selectedDeviceId],
    queryFn: async () => {
      // Get the media stream using centralized manager
      const mediaStream = await getMediaStream(
        kind === 'videoinput'
          ? {
              videoDeviceId: selectedDeviceId,
              video: true,
              audio: false,
              videoConstraints,
              resolution: '1080p',
              enableFallback: true,
            }
          : {
              audioDeviceId: selectedDeviceId,
              video: false,
              audio: true,
              audioConstraints,
            },
      )
      return mediaStream
    },
    enabled: !!selectedDeviceId,
  })

  useEffect(() => {
    if (data?.stream) {
      onDeviceChanged?.(selectedDeviceId, data.stream)
    }
  }, [data?.stream, selectedDeviceId, onDeviceChanged])

  return useMemo(
    () => ({
      ...data,
      isPending: isPending || isEnumerating,
      error: error || enumerationError,
      devices: filteredDevices,
      selectedDeviceId: selectedDeviceId,
      saveSelectedDevice,
    }),
    [
      data,
      error,
      enumerationError,
      filteredDevices,
      isEnumerating,
      isPending,
      saveSelectedDevice,
      selectedDeviceId,
    ],
  )
}
