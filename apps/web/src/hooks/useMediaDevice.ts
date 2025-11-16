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
  getTemporaryStreamForPermissions,
  stopMediaStream,
} from '@/lib/media-stream-manager'

export interface MediaDeviceInfo
  extends Pick<globalThis.MediaDeviceInfo, 'deviceId' | 'label' | 'kind'> {
  isDefault?: boolean
}

export interface UseMediaDeviceOptions {
  /** Type of media device: 'video' or 'audio' */
  kind: 'videoinput' | 'audioinput'
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
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const onDeviceChangedRef = useRef(onDeviceChanged)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onDeviceChangedRef.current = onDeviceChanged
    onErrorRef.current = onError
  }, [onDeviceChanged, onError])

  /**
   * Refresh the list of available devices
   */
  const refreshDevices = useCallback(async () => {
    console.log(`[useMediaDevice] refreshDevices called for kind: ${kind}`)
    try {
      setIsLoading(true)

      // First, request permissions to get device labels
      // Without permissions, enumerateDevices() returns devices with empty labels
      let defaultDeviceId: string | null = null
      try {
        const { deviceId, stream: tempStream } =
          await getTemporaryStreamForPermissions(
            kind === 'videoinput' ? 'video' : 'audio',
          )
        defaultDeviceId = deviceId
        console.log(
          `[useMediaDevice] Detected default ${kind}:`,
          defaultDeviceId,
        )
        // Clean up the temporary stream immediately
        stopMediaStream(tempStream)
      } catch (err) {
        const error = err as Error
        console.warn(
          '[useMediaDevice] Could not get permissions for device enumeration:',
          err,
        )
        console.warn('[useMediaDevice] Error name:', error.name)
        console.warn('[useMediaDevice] Error message:', error.message)

        if (error.name === 'NotFoundError') {
          console.error(
            '[useMediaDevice] NotFoundError: No camera device found. Possible causes:',
          )
          console.error('  1. Camera is in use by another application')
          console.error('  2. Camera is disabled in System Settings')
          console.error('  3. Browser does not have camera permission')
        } else if (error.name === 'NotAllowedError') {
          console.error(
            '[useMediaDevice] NotAllowedError: User denied camera permission',
          )
        }
        // If we can't get permissions, we'll still enumerate but labels will be empty
      }

      // Now enumerate devices (will have labels if permissions were granted)
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
          const isDefault = device.deviceId === defaultDeviceId
          // If no label, use a generic one with index (happens when permissions not granted)
          const baseLabel =
            device.label ||
            `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${index + 1}`
          return {
            deviceId: device.deviceId,
            label: isDefault ? `${baseLabel} (Default)` : baseLabel,
            kind: device.kind,
            isDefault,
          }
        })

      console.log(
        `[useMediaDevice] Final filtered ${kind} devices (${filteredDevices.length}):`,
        filteredDevices,
      )
      setDevices(filteredDevices)
    } catch (err) {
      console.error(
        `[useMediaDevice] Failed to enumerate ${kind} devices:`,
        err,
      )
      console.error(
        '[useMediaDevice] Error stack:',
        err instanceof Error ? err.stack : 'No stack trace',
      )
      // Set empty array on error
      setDevices([])
    } finally {
      console.log(
        `[useMediaDevice] refreshDevices completed for ${kind}, isLoading -> false`,
      )
      setIsLoading(false)
    }
  }, [kind])

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
      let targetDeviceId = deviceId || currentDeviceId

      // If still no device ID, try to find default or first device
      if (!targetDeviceId && devices.length > 0) {
        const defaultDevice = devices.find((device) => device.isDefault)
        targetDeviceId = defaultDevice?.deviceId || devices[0]?.deviceId || null
      }

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
    [
      kind,
      currentDeviceId,
      devices,
      videoRef,
      videoConstraints,
      audioConstraints,
    ],
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

  useEffect(() => {
    refreshDevices()
  }, [refreshDevices])

  // Auto-select default device when devices list changes and no device is selected
  useEffect(() => {
    if (devices.length > 0) {
      const defaultDevice = devices.find((device) => device.isDefault)
      const deviceToSelect = defaultDevice?.deviceId ?? devices[0]?.deviceId

      if (deviceToSelect) {
        console.log(
          `[useMediaDevice] Auto-selecting ${defaultDevice ? 'default' : 'first'} device:`,
          deviceToSelect,
        )
        void start(deviceToSelect)
      }
    }
  }, [devices, start])

  return {
    stream,
    currentDeviceId,
    devices,
    switchDevice,
    start,
    stop,
    refreshDevices,
    isActive,
    error,
    isLoading,
  }
}
