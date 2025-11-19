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
import type { MediaDeviceInfo } from '@/lib/media-stream-manager'
import { useEffect, useMemo, useRef } from 'react'
import { getMediaStream } from '@/lib/media-stream-manager'
import { useQuery } from '@tanstack/react-query'

import { useMediaDeviceChange } from './useMediaDeviceChange'
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

  const mediaDevices = useMediaDeviceChange()

  const matchingKind = useMemo(() => mediaDevices[kind], [mediaDevices, kind])

  const defaultDevice =
    matchingKind.find((device) => device.deviceId === 'default') ??
    matchingKind[0]

  // Use selected device hook as state manager with localStorage persistence
  const { selectedDeviceId, saveSelectedDevice } = useSelectedMediaDevice(
    kind,
    defaultDevice?.deviceId ?? null,
  )

  console.log(
    `[useMediaDevice] Devices matching kind '${kind}' (${matchingKind.length}):`,
    matchingKind,
  )

  if (matchingKind.length === 0) {
    console.warn(
      '[useMediaDevice] enumerateMediaDevices returned 0 devices - this might indicate a browser restriction',
    )
  }

  // Memoize filtered devices to avoid recalculating filter/map operations
  // when matchingKind reference changes but content is the same
  const filteredDevices = useMemo(
    () =>
      matchingKind
        // Filter out the "default" device ID to avoid duplication
        .filter(
          (device) => device.deviceId !== 'default' && device.deviceId !== '',
        )
        .map((device, index: number) => {
          // If no label, use a generic one with index (happens when permissions not granted)
          const baseLabel =
            device.label ||
            `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${index + 1}`
          return {
            deviceId: device.deviceId,
            label: index === 0 ? `${baseLabel} (Default)` : baseLabel,
            kind: device.kind,
          } satisfies MediaDeviceInfo
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
    if (data?.stream && selectedDeviceId) {
      onDeviceChanged?.(selectedDeviceId, data.stream)
    }
  }, [data?.stream, selectedDeviceId, onDeviceChanged])

  return useMemo(
    () => ({
      ...data,
      isPending,
      error,
      devices: filteredDevices,
      selectedDeviceId: selectedDeviceId,
      saveSelectedDevice,
    }),
    [
      data,
      error,
      filteredDevices,
      isPending,
      saveSelectedDevice,
      selectedDeviceId,
    ],
  )
}
