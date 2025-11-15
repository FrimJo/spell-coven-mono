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

export interface MediaDeviceInfo extends Pick<globalThis.MediaDeviceInfo, 'deviceId' | 'label' | 'kind'> {
  isDefault?: boolean
}

export interface UseMediaDeviceOptions {
  /** Type of media device: 'video' or 'audio' */
  kind: 'videoinput' | 'audioinput'
  /** Initial device ID to use */
  initialDeviceId?: string
  /** Video element ref for video devices */
  videoRef?: React.RefObject<HTMLVideoElement | null>
  /** Auto-start on mount */
  autoStart?: boolean
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
    autoStart = false,
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
  const isCancelledRef = useRef(false)
  const onDeviceChangedRef = useRef(onDeviceChanged)
  const onErrorRef = useRef(onError)

  // Keep callback refs up to date
  useEffect(() => {
    onDeviceChangedRef.current = onDeviceChanged
    onErrorRef.current = onError
  }, [onDeviceChanged, onError])

  /**
   * Refresh the list of available devices
   */
  const refreshDevices = useCallback(async () => {
    try {
      setIsLoading(true)
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      
      // Detect the default device by getting a temporary stream
      let defaultDeviceId: string | null = null
      try {
        const constraints: MediaStreamConstraints =
          kind === 'videoinput'
            ? { video: true, audio: false }
            : { video: false, audio: true }
        
        const tempStream = await navigator.mediaDevices.getUserMedia(constraints)
        const track = tempStream.getTracks()[0]
        if (track) {
          defaultDeviceId = track.getSettings().deviceId || null
          console.log(`[useMediaDevice] Detected default ${kind}:`, defaultDeviceId)
        }
        // Clean up the temporary stream immediately
        tempStream.getTracks().forEach((t) => t.stop())
      } catch (err) {
        console.warn('[useMediaDevice] Could not detect default device:', err)
      }
      
      const filteredDevices = allDevices
        .filter((device) => device.kind === kind)
        // Filter out the "default" device ID to avoid duplication
        .filter((device) => device.deviceId !== 'default')
        .map((device) => {
          const isDefault = device.deviceId === defaultDeviceId
          const baseLabel = device.label || `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${device.deviceId.slice(0, 8)}`
          return {
            deviceId: device.deviceId,
            label: isDefault ? `${baseLabel} (Default)` : baseLabel,
            kind: device.kind,
            isDefault,
          }
        })
      
      setDevices(filteredDevices)
    } catch (err) {
      console.error('[useMediaDevice] Failed to enumerate devices:', err)
    } finally {
      setIsLoading(false)
    }
  }, [kind])

  /**
   * Stop the current stream and clean up
   */
  const stop = useCallback(() => {
    if (streamRef.current) {
      console.log('[useMediaDevice] Stopping stream')
      streamRef.current.getTracks().forEach((track) => track.stop())
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
   */
  const start = useCallback(
    async (deviceId?: string) => {
      const targetDeviceId = deviceId || currentDeviceId

      if (!targetDeviceId) {
        const err = new Error('No device ID provided')
        setError(err)
        onErrorRef.current?.(err)
        throw err
      }

      try {
        console.log(`[useMediaDevice] Starting ${kind} device:`, targetDeviceId)
        setError(null)
        isCancelledRef.current = false

        // Stop previous stream
        if (streamRef.current) {
          console.log('[useMediaDevice] Stopping previous stream')
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }

        // Clear video element if present
        if (videoRef?.current) {
          videoRef.current.srcObject = null
        }

        // Build constraints based on device kind
        const constraints: MediaStreamConstraints =
          kind === 'videoinput'
            ? {
                video: {
                  deviceId: { exact: targetDeviceId },
                  ...videoConstraints,
                },
                audio: false,
              }
            : {
                video: false,
                audio: {
                  deviceId: { exact: targetDeviceId },
                  ...audioConstraints,
                },
              }

        // Get the media stream
        const newStream = await navigator.mediaDevices.getUserMedia(constraints)

        // Check if cancelled while waiting
        if (isCancelledRef.current) {
          console.log('[useMediaDevice] Operation cancelled, stopping new stream')
          newStream.getTracks().forEach((track) => track.stop())
          return
        }

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
            console.error('[useMediaDevice] Error starting video playback:', playError)
          }
        }

        // Notify success
        onDeviceChangedRef.current?.(targetDeviceId, newStream)
      } catch (err) {
        if (!isCancelledRef.current) {
          const error = err instanceof Error ? err : new Error(String(err))
          console.error('[useMediaDevice] Error starting device:', error)
          setError(error)
          setIsActive(false)
          onErrorRef.current?.(error)
          throw error
        }
      }
    },
    [kind, currentDeviceId, videoRef, videoConstraints, audioConstraints],
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

  // Initial device enumeration
  useEffect(() => {
    void refreshDevices()

    // Listen for device changes
    const handleDeviceChange = () => {
      console.log('[useMediaDevice] Device change detected')
      void refreshDevices()
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [refreshDevices])

  // Auto-start if requested
  useEffect(() => {
    if (!autoStart) {
      return
    }

    // Wait for devices to be loaded
    if (devices.length === 0) {
      return
    }

    // Determine which device to start with
    const deviceToStart = initialDeviceId || devices[0]?.deviceId

    if (!deviceToStart) {
      console.warn('[useMediaDevice] No devices available for auto-start')
      return
    }

    void start(deviceToStart)

    // Cleanup on unmount
    return () => {
      isCancelledRef.current = true
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, devices.length])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true
      stop()
    }
  }, [stop])

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

