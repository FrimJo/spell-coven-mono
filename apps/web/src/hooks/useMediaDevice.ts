/**
 * useMediaDevice - Low-level media acquisition hook
 *
 * Enumerates devices and acquires the stream for a caller-managed device ID.
 * Selection and persistence policy live outside this hook.
 */
import type { MediaStreamResult } from '@/lib/media-stream-manager'
import type {
  AsyncResourceError,
  AsyncResourcePending,
  AsyncResourceSuccess,
} from '@/types/async-resource'
import { useEffect, useEffectEvent, useMemo } from 'react'
import { getMediaStream } from '@/lib/media-stream-manager'
import { shouldShowPermissionDialog } from '@/lib/permission-storage'
import { useQuery } from '@tanstack/react-query'

import { useEnumeratedMediaDevices } from './useEnumeratedMediaDevices'

export interface UseMediaDeviceOptions {
  kind: MediaDeviceInfo['kind']
  selectedDeviceId?: string | null
  videoConstraints?: MediaTrackConstraints
  audioConstraints?: MediaTrackConstraints
  onDeviceChanged?: (deviceId: string, stream: MediaStream) => void
  onError?: (error: Error) => void
  enabled?: boolean
}

type UseMediaDeviceBase = {
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
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

export function useMediaDevice(
  options: UseMediaDeviceOptions,
): UseMediaDeviceReturn {
  const {
    kind,
    selectedDeviceId: requestedDeviceId,
    videoConstraints = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audioConstraints = {},
    onDeviceChanged,
    onError,
    enabled: externalEnabled = true,
  } = options

  const emitDeviceChanged = useEffectEvent(
    (deviceId: string, stream: MediaStream) => {
      onDeviceChanged?.(deviceId, stream)
    },
  )

  const emitError = useEffectEvent((err: Error) => {
    onError?.(err)
  })

  const permissionType = kind === 'videoinput' ? 'camera' : 'microphone'
  const userDeclinedPermission = !shouldShowPermissionDialog(permissionType)

  const {
    data: mediaDevicesByKind,
    isPending: isEnumerating,
    error: enumerationError,
  } = useEnumeratedMediaDevices()

  const filteredDevices = useMemo(
    () =>
      (mediaDevicesByKind[kind] as readonly MediaDeviceInfo[]).map(
        (device, index) => ({
          deviceId: device.deviceId,
          groupId: device.groupId,
          kind: device.kind,
          label:
            device.label ||
            `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${index + 1}`,
          toJSON: device.toJSON,
        }),
      ),
    [kind, mediaDevicesByKind],
  )

  const deviceIds = useMemo(
    () => filteredDevices.map((device) => device.deviceId),
    [filteredDevices],
  )

  const defaultDeviceId = filteredDevices[0]?.deviceId ?? ''
  const selectedDeviceId =
    requestedDeviceId && deviceIds.includes(requestedDeviceId)
      ? requestedDeviceId
      : defaultDeviceId

  const {
    data,
    isPending: isGettingStream,
    error: getStreamError,
  } = useQuery({
    queryKey: ['MediaStream', kind, selectedDeviceId],
    queryFn: async () => {
      return getMediaStream(
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
    },
    enabled: externalEnabled && !!selectedDeviceId && !userDeclinedPermission,
  })

  useEffect(() => {
    if (data?.stream && selectedDeviceId) {
      emitDeviceChanged(selectedDeviceId, data.stream)
    }
  }, [data?.stream, selectedDeviceId, emitDeviceChanged])

  useEffect(() => {
    if (enumerationError) {
      emitError(enumerationError)
    }
  }, [enumerationError, emitError])

  return useMemo((): UseMediaDeviceReturn => {
    const isPending = isGettingStream || isEnumerating
    const permissionDeclinedError = userDeclinedPermission
      ? new Error(
          `${permissionType === 'camera' ? 'Camera' : 'Microphone'} access was declined. Please enable permissions to use this feature.`,
        )
      : null
    const error = permissionDeclinedError || getStreamError || enumerationError

    const base = {
      devices: filteredDevices,
      selectedDeviceId,
    }

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
    enumerationError,
    filteredDevices,
    getStreamError,
    isEnumerating,
    isGettingStream,
    permissionType,
    selectedDeviceId,
    userDeclinedPermission,
  ])
}
