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
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { getMediaStream, stopMediaStream } from '@/lib/media-stream-manager'

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

export interface UseMediaDeviceReturn {
  /** Current media stream */
  stream: MediaStream | null
  /** Available devices */
  devices: MediaDeviceInfo[]
  /** Currently selected device ID (starts with default, updates on user selection) */
  selectedDeviceId: string | null
  /** Start the media stream */
  start: (deviceId: string) => Promise<void>
  /** Stop the media stream */
  stop: () => void
  /** Is the stream currently active */
  isActive: boolean
  /** Current error if any */
  error: Error | null
  /** Save the selected device ID to localStorage */
  saveSelectedDevice: (deviceId: string) => void
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

  const [stream, setStream] = useState<MediaStream | null>(null)
  const isActive = !!stream
  const [error, setError] = useState<Error | null>(null)

  const onDeviceChangedRef = useRef(onDeviceChanged)
  const onErrorRef = useRef(onError)

  const mediaDevices = useMediaDeviceChange()

  // Use selected device hook as state manager with localStorage persistence
  const { selectedDeviceId, saveSelectedDevice } = useSelectedMediaDevice(kind)

  // Use centralized device enumeration (already filtered by kind)
  const matchingKind = mediaDevices[kind] || []
  console.log(
    `[useMediaDevice] Devices matching kind '${kind}' (${matchingKind.length}):`,
    matchingKind,
  )

  if (matchingKind.length === 0) {
    console.warn(
      '[useMediaDevice] enumerateMediaDevices returned 0 devices - this might indicate a browser restriction',
    )
  }

  const devices = matchingKind
    // Filter out the "default" device ID to avoid duplication
    .filter((device) => device.deviceId !== 'default' && device.deviceId !== '')
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
    })

  console.log(
    `[useMediaDevice] Final filtered ${kind} devices (${devices.length}):`,
    devices,
  )

  useEffect(() => {
    onDeviceChangedRef.current = onDeviceChanged
    onErrorRef.current = onError
  }, [onDeviceChanged, onError])

  /**
   * Stop the current stream and clean up
   */
  const stop = useCallback(() => {
    console.log('[useMediaDevice] Stopping stream')
    setStream((prev) => {
      if (prev != null) stopMediaStream(prev)
      return null
    })
  }, [])

  /**
   * Start or switch to a specific device
   * If no deviceId is provided, will use: currentDeviceId > default device > first device
   */
  const start = useCallback(
    async (deviceId: string) => {
      console.log(
        '[foobar useMediaDevice] Starting stream with device ID:',
        deviceId,
      )
      try {
        setError(null)

        // Get the media stream using centralized manager
        const { stream: newStream } = await getMediaStream(
          kind === 'videoinput'
            ? {
                videoDeviceId: deviceId,
                video: true,
                audio: false,
                videoConstraints,
                resolution: '1080p',
                enableFallback: true,
              }
            : {
                audioDeviceId: deviceId,
                video: false,
                audio: true,
                audioConstraints,
              },
        )

        console.log('[useMediaDevice] Got new stream')

        setStream((prev) => {
          console.log('[useMediaDevice] Stopping previous stream')
          // Stop previous stream
          if (prev != null) stopMediaStream(prev)
          return newStream
        })
        console.log('[useMediaDevice] saveSelectedDevice', deviceId)
        saveSelectedDevice(deviceId) // Persist to localStorage

        // Notify success (component handles DOM attachment)
        onDeviceChangedRef.current?.(deviceId, newStream)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('[useMediaDevice] Error starting device:', error)
        setError(error)
        onErrorRef.current?.(error)
        throw error
      }
    },
    [audioConstraints, kind, videoConstraints, saveSelectedDevice],
  )

  const initialDeviceId = useMemo(() => {
    return selectedDeviceId ?? devices[0]?.deviceId ?? null
  }, [devices, selectedDeviceId])

  const autoStartEvent = useEffectEvent(() => {
    if (initialDeviceId != null) {
      start(initialDeviceId).catch((err) => {
        console.error('[useMediaDevice] autoStart start failed:', err)
      })
    }
  })

  useEffect(() => {
    if (!isActive) autoStartEvent()
  }, [isActive])

  return useMemo(
    () => ({
      stream,
      devices,
      selectedDeviceId: selectedDeviceId ?? devices[0]?.deviceId ?? null,
      start,
      stop,
      isActive,
      error,
      saveSelectedDevice,
    }),
    [
      devices,
      error,
      isActive,
      selectedDeviceId,
      start,
      stop,
      stream,
      saveSelectedDevice,
    ],
  )
}
