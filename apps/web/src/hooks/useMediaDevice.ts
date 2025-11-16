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

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  enumerateMediaDevices,
  getMediaStream,
  stopMediaStream,
} from '@/lib/media-stream-manager'
import { useQuery } from '@tanstack/react-query'

export interface MediaDeviceInfo {
  id: string
  label: string
  kind: 'audioinput' | 'audiooutput' | 'videoinput'
}

export interface UseMediaDeviceOptions {
  /** Type of media device: 'video' or 'audio' */
  kind: MediaDeviceInfo['kind']
  /** Initial device ID to use */
  initialDeviceId?: string
  /** Video element ref for video devices */
  videoRef?: React.RefObject<HTMLVideoElement | null>
  /** Auto-start on mount (not reactive to changes) */
  autoStart?: boolean
  /** Reactive trigger to start the device when true (overrides autoStart) */
  shouldStart?: boolean
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
  /** Current device ID */
  currentDeviceId: string | null
  /** Available devices */
  devices: MediaDeviceInfo[]
  /** Switch to a different device */
  switchDevice: (deviceId: string) => Promise<void>
  /** Start the media stream */
  start: (deviceId?: string) => Promise<void>
  /** Stop the media stream */
  stop: () => void
  /** Refresh the list of available devices */
  refreshDevices: () => Promise<void>
  /** Is the stream currently active */
  isActive: boolean
  /** Current error if any */
  error: Error | null
  /** Is the device list loading */
  isLoading: boolean
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
    initialDeviceId,
    videoRef,
    autoStart: autoStart = false,
    shouldStart,
    videoConstraints = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audioConstraints = {},
    onDeviceChanged,
    onError,
  } = options

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(
    initialDeviceId || null,
  )
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const onDeviceChangedRef = useRef(onDeviceChanged)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onDeviceChangedRef.current = onDeviceChanged
    onErrorRef.current = onError
  }, [onDeviceChanged, onError])

  /**
   * Fetch and enumerate available media devices using React Query
   */
  const {
    data,
    isLoading,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: ['mediaDevices', kind],
    queryFn: async () => {
      console.log(`[useMediaDevice] Fetching devices for kind: ${kind}`)

      // Use centralized device enumeration (already filtered by kind)
      const matchingKind = await enumerateMediaDevices(kind)
      console.log(
        `[useMediaDevice] Devices matching kind '${kind}' (${matchingKind.length}):`,
        matchingKind,
      )

      if (matchingKind.length === 0) {
        console.warn(
          '[useMediaDevice] enumerateMediaDevices returned 0 devices - this might indicate a browser restriction',
        )
      }

      const filteredDevices = matchingKind
        // Filter out the "default" device ID to avoid duplication
        .filter(
          (device) => device.deviceId !== 'default' && device.deviceId !== '',
        )
        .map((device, index) => {
          // If no label, use a generic one with index (happens when permissions not granted)
          const baseLabel =
            device.label ||
            `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${index + 1}`
          return {
            id: device.deviceId,
            label: index === 0 ? `${baseLabel} (Default)` : baseLabel,
            kind: device.kind,
          } satisfies MediaDeviceInfo
        })

      console.log(
        `[useMediaDevice] Final filtered ${kind} devices (${filteredDevices.length}):`,
        filteredDevices,
      )
      return {
        devices: filteredDevices,
        defaultDeviceId: filteredDevices[0]?.id,
      }
    },
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute (formerly cacheTime)
  })

  /**
   * Wrapper for refetch to maintain the expected API (returns Promise<void>)
   */
  const refreshDevices = useCallback(async () => {
    await refetchDevices()
  }, [refetchDevices])

  /**
   * Stop the current stream and clean up
   */
  const stop = useCallback(() => {
    if (streamRef.current) {
      console.log('[useMediaDevice] Stopping stream')
      stopMediaStream(streamRef.current)
      streamRef.current = null
      setStream(null)
      setIsActive(false)
    }

    if (videoRef?.current) {
      videoRef.current.srcObject = null
    }
  }, [videoRef])

  /**
   * Start or switch to a specific device
   * If no deviceId is provided, will use: currentDeviceId > default device > first device
   */
  const start = useCallback(
    async (deviceId?: string) => {
      if (data == null) return
      const targetDeviceId =
        deviceId ?? data.defaultDeviceId ?? data.devices[0]?.id

      if (!targetDeviceId) {
        const err = new Error('No device ID provided and no devices available')
        setError(err)
        onErrorRef.current?.(err)
        throw err
      }

      try {
        console.log(`[useMediaDevice] Starting ${kind} device:`, targetDeviceId)
        setError(null)

        // Stop previous stream
        if (streamRef.current) {
          console.log('[useMediaDevice] Stopping previous stream')
          stopMediaStream(streamRef.current)
          streamRef.current = null
        }

        // Clear video element if present
        if (videoRef?.current) {
          videoRef.current.srcObject = null
        }

        // Get the media stream using centralized manager
        const { stream: newStream } = await getMediaStream(
          kind === 'videoinput'
            ? {
                videoDeviceId: targetDeviceId,
                video: true,
                audio: false,
                videoConstraints,
                resolution: '1080p',
                enableFallback: true,
              }
            : {
                audioDeviceId: targetDeviceId,
                video: false,
                audio: true,
                audioConstraints,
              },
        )

        console.log('[useMediaDevice] Got new stream')

        // Update refs and state
        streamRef.current = newStream
        setStream(newStream)
        setCurrentDeviceId(targetDeviceId)
        setIsActive(true)

        // For video devices, set up video element
        if (kind === 'videoinput' && videoRef?.current) {
          videoRef.current.srcObject = newStream

          try {
            await videoRef.current.play()
            console.log('[useMediaDevice] Video playback started')
          } catch (playError) {
            console.error(
              '[useMediaDevice] Error starting video playback:',
              playError,
            )
          }
        }

        // Notify success
        onDeviceChangedRef.current?.(targetDeviceId, newStream)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('[useMediaDevice] Error starting device:', error)
        setError(error)
        setIsActive(false)
        onErrorRef.current?.(error)
        throw error
      }
    },
    [audioConstraints, data, kind, videoConstraints, videoRef],
  )

  /**
   * Switch to a different device
   */
  const switchDevice = useCallback(
    async (deviceId: string) => {
      await start(deviceId)
    },
    [start],
  )

  // useEffect(() => {
  //   refreshDevices()
  // }, [refreshDevices])

  // Auto-select default device when devices list changes and no device is selected
  // useEffect(() => {
  //   console.log('[useMediaDevice] Auto-selecting device')
  //   if (devices.length > 0) {
  //     const defaultDevice = devices.find((device) => device.isDefault)
  //     const deviceToSelect = defaultDevice?.deviceId ?? devices[0]?.deviceId
  //     console.log('[useMediaDevice] Devices:', {
  //       devices,
  //       defaultDevice,
  //       deviceToSelect,
  //     })

  //     if (deviceToSelect) {
  //       console.log(
  //         `[useMediaDevice] Auto-selecting ${defaultDevice ? 'default' : 'first'} device:`,
  //         deviceToSelect,
  //       )
  //       void start(deviceToSelect)
  //     }
  //   }
  // }, [devices, start])

  return {
    stream,
    currentDeviceId,
    devices: data?.devices || [],
    switchDevice,
    start,
    stop,
    refreshDevices,
    isActive,
    error,
    isLoading,
  }
}
