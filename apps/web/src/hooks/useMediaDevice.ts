/**
 * useMediaDevice - Unified hook for managing media device switching
 *
 * Consolidates all camera/microphone device management logic with best practices:
 * - Proper cleanup of old tracks
 * - Exact device constraints
 * - Automatic playback handling
 * - Race condition prevention
 * - Error handling
 * - Respects user's permission dialog preferences (won't trigger native dialog if user declined)
 */
import type { MediaStreamResult } from '@/lib/media-stream-manager'
import type {
  AsyncResourceError,
  AsyncResourcePending,
  AsyncResourceSuccess,
} from '@/types/async-resource'
import { useEffect, useMemo, useRef } from 'react'
import { getMediaStream } from '@/lib/media-stream-manager'
import { shouldShowPermissionDialog } from '@/lib/permission-storage'
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
  /**
   * Whether to enable media stream acquisition. When false, the hook will not
   * call getUserMedia. Use this to delay stream acquisition until permissions
   * are granted via the custom permission dialog.
   * @default true
   */
  enabled?: boolean
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
    enabled: externalEnabled = true,
  } = options

  const onDeviceChangedRef = useRef(onDeviceChanged)
  const onErrorRef = useRef(onError)

  // Check if user has declined our custom permission dialog
  // If declined, we should NOT trigger the native browser dialog
  const permissionType = kind === 'videoinput' ? 'camera' : 'microphone'
  const userDeclinedPermission = !shouldShowPermissionDialog(permissionType)

  const {
    data: mediaDevicesByKind,
    isPending: isEnumerating,
    error: enumerationError,
  } = useEnumeratedMediaDevices()

  const mediaDevices = useMemo(() => {
    // Return devices array (may be empty if permissions not granted yet)
    // The permission gate in the UI will handle prompting for permissions
    const devices = mediaDevicesByKind[kind]
    return devices as readonly MediaDeviceInfo[]
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
    // Don't trigger getUserMedia if:
    // - Externally disabled (e.g., waiting for custom permission dialog)
    // - No device selected
    // - User declined our custom permission dialog (would trigger native prompt)
    enabled: externalEnabled && !!selectedDeviceId && !userDeclinedPermission,
  })

  // Handle stream lifecycle: notify on change
  // NOTE: Cleanup is handled by MediaStreamProvider at the page level.
  // This allows multiple components (VideoStreamGrid, MediaSetupDialog) to share
  // the same stream without one component's unmount stopping the shared stream.
  useEffect(() => {
    const stream = data?.stream
    if (!stream) return

    // Notify consumer about new stream
    onDeviceChangedRef.current?.(selectedDeviceId, stream)
  }, [data?.stream, selectedDeviceId])

  useEffect(() => {
    if (enumerationError) {
      onErrorRef.current?.(enumerationError)
    }
  }, [enumerationError])

  return useMemo((): UseMediaDeviceReturn => {
    const isPending = isGettingStream || isEnumerating

    // Create specific error if user declined permission dialog
    const permissionDeclinedError = userDeclinedPermission
      ? new Error(
          `${permissionType === 'camera' ? 'Camera' : 'Microphone'} access was declined. Please enable permissions to use this feature.`,
        )
      : null

    const error = permissionDeclinedError || getStreamError || enumerationError

    const base = {
      devices: filteredDevices,
      selectedDeviceId: selectedDeviceId,
      saveSelectedDevice,
    }

    // If user declined permission, return error state (don't show as pending)
    if (userDeclinedPermission && permissionDeclinedError) {
      return {
        ...base,
        isPending: false,
        error: permissionDeclinedError,
        stream: undefined,
        videoTrack: undefined,
        audioTrack: undefined,
        actualResolution: undefined,
      } satisfies UseMediaDeviceError
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
    permissionType,
    saveSelectedDevice,
    selectedDeviceId,
    userDeclinedPermission,
  ])
}
