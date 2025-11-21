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
import type { MediaStreamResult } from '@/lib/media-stream-manager'
import type {
  AsyncResourceError,
  AsyncResourcePending,
  AsyncResourceSuccess,
} from '@/types/async-resource'
import { useEffect, useMemo, useRef } from 'react'
import { getMediaStream } from '@/lib/media-stream-manager'
import { useQuery } from '@tanstack/react-query'

import { useEnumeratedMediaDevices } from './useEnumeratedMediaDevices'
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

type UseMediaDeviceBase = {
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
  saveSelectedDevice: (deviceId: string) => void
}

type UseMediaDevicePending = AsyncResourcePending<UseMediaDeviceBase> & {
  stream: undefined
  videoTrack: undefined
  audioTrack: undefined
  actualResolution: undefined
}

type UseMediaDeviceError = AsyncResourceError<UseMediaDeviceBase> & {
  stream: undefined
  videoTrack: undefined
  audioTrack: undefined
  actualResolution: undefined
}

type UseMediaDeviceSuccess = AsyncResourceSuccess<
  UseMediaDeviceBase,
  MediaStreamResult
>

export type UseMediaDeviceReturn =
  | UseMediaDevicePending
  | UseMediaDeviceError
  | UseMediaDeviceSuccess

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

export function useMediaDevice(
  options: UseMediaDeviceOptions,
): UseMediaDeviceReturn {
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

  const {
    data: mediaDevicesByKind,
    isPending: isEnumerating,
    error: enumerationError,
  } = useEnumeratedMediaDevices()

  const mediaDevices = useMemo(() => {
    const mediaDevices = mediaDevicesByKind[kind]
    if (mediaDevices.length > 0) {
      return mediaDevices as readonly [MediaDeviceInfo] | MediaDeviceInfo[]
    } else {
      // Trigger error boundary
      throw new Error(`No ${kind} devices found`)
    }
  }, [kind, mediaDevicesByKind])

  // Use selected device hook as state manager with localStorage persistence
  const { selectedDeviceId, saveSelectedDevice } = useSelectedMediaDevice(
    kind,
    mediaDevices,
  )

  if (enumerationError) {
    console.error(
      '[useMediaDevice] Failed to enumerate devices:',
      enumerationError,
    )
  }

  // Memoize filtered devices to avoid recalculating filter/map operations
  // when matchingKind reference changes but content is the same
  const filteredDevices = useMemo(
    () =>
      mediaDevices.map<MediaDeviceInfo>((device, index) => {
        // If no label, use a generic one with index (happens when permissions not granted)
        const baseLabel =
          device.label ||
          `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${index + 1}`

        console.log('foobar', { device })
        return {
          deviceId: device.deviceId,
          groupId: device.groupId,
          kind: device.kind,
          label: baseLabel,
          toJSON: device.toJSON,
        }
      }),
    [mediaDevices, kind],
  )

  console.log(
    `[useMediaDevice] Final filtered ${kind} devices (${filteredDevices.length}):`,
    filteredDevices,
  )

  useEffect(() => {
    onDeviceChangedRef.current = onDeviceChanged
    onErrorRef.current = onError
  }, [onDeviceChanged, onError])

  const {
    data,
    isPending: isGettingStream,
    error: getStreamError,
  } = useQuery({
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
      onDeviceChangedRef.current?.(selectedDeviceId, data.stream)
    }
  }, [data?.stream, selectedDeviceId])

  useEffect(() => {
    if (enumerationError) {
      onErrorRef.current?.(enumerationError)
    }
  }, [enumerationError])

  return useMemo((): UseMediaDeviceReturn => {
    const isPending = isGettingStream || isEnumerating
    const error = getStreamError || enumerationError

    const base = {
      devices: filteredDevices,
      selectedDeviceId: selectedDeviceId,
      saveSelectedDevice,
    }

    if (isPending) {
      return {
        ...base,
        isPending: true,
        error,
        stream: undefined,
        videoTrack: undefined,
        audioTrack: undefined,
        actualResolution: undefined,
      } satisfies UseMediaDevicePending
    }

    if (error) {
      return {
        ...base,
        isPending: false,
        error,
        stream: undefined,
        videoTrack: undefined,
        audioTrack: undefined,
        actualResolution: undefined,
      } satisfies UseMediaDeviceError
    }

    return {
      ...base,
      ...data,
      isPending: false,
      error: null,
    } satisfies UseMediaDeviceSuccess
  }, [
    data,
    getStreamError,
    enumerationError,
    filteredDevices,
    isEnumerating,
    isGettingStream,
    saveSelectedDevice,
    selectedDeviceId,
  ])
}
