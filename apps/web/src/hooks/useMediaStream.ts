import { useCallback, useEffect, useRef, useState } from 'react'

interface UseMediaStreamOptions {
  /** Auto-start video on mount */
  autoStart?: boolean
  /** Preferred camera device ID */
  deviceId?: string | null
  /** Enable audio */
  audio?: boolean
  /** Video constraints */
  videoConstraints?: MediaTrackConstraints
}

interface UseMediaStreamReturn {
  /** Ref for the video element */
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Current media stream */
  stream: MediaStream | null
  /** Start the media stream */
  startStream: (deviceId?: string | null) => Promise<void>
  /** Stop the media stream */
  stopStream: () => void
  /** Toggle video track */
  toggleVideo: () => void
  /** Toggle audio track */
  toggleAudio: () => void
  /** Get list of available cameras */
  getCameras: () => Promise<MediaDeviceInfo[]>
  /** Get list of available audio devices */
  getAudioDevices: () => Promise<MediaDeviceInfo[]>
  /** Whether video is enabled */
  isVideoEnabled: boolean
  /** Whether audio is enabled */
  isAudioEnabled: boolean
  /** Whether stream is active */
  isActive: boolean
  /** Error message if any */
  error: string | null
}

/**
 * Hook for managing media streams (webcam and microphone)
 *
 * @example
 * ```tsx
 * const { videoRef, startStream, stopStream, isActive } = useMediaStream({
 *   autoStart: true,
 *   audio: true
 * })
 *
 * return (
 *   <div>
 *     <video ref={videoRef} autoPlay muted playsInline />
 *     <button onClick={() => isActive ? stopStream() : startStream()}>
 *       {isActive ? 'Stop' : 'Start'}
 *     </button>
 *   </div>
 * )
 * ```
 */
export function useMediaStream(
  options: UseMediaStreamOptions = {},
): UseMediaStreamReturn {
  const {
    autoStart = false,
    deviceId = null,
    audio = false,
    videoConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 } },
  } = options

  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startStream = useCallback(async (requestedDeviceId?: string | null) => {
    try {
      setError(null)

      const finalDeviceId = requestedDeviceId ?? deviceId
      const constraints: MediaStreamConstraints = {
        audio,
        video: finalDeviceId
          ? { ...videoConstraints, deviceId: { exact: finalDeviceId } }
          : videoConstraints,
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream

        // Wait for metadata to load before playing
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve()
            }
          }
        })

        await videoRef.current.play()
      }

      setStream(mediaStream)
      setIsActive(true)

      // Set initial track states
      const videoTrack = mediaStream.getVideoTracks()[0]
      const audioTrack = mediaStream.getAudioTracks()[0]

      if (videoTrack) {
        setIsVideoEnabled(videoTrack.enabled)
      }
      if (audioTrack) {
        setIsAudioEnabled(audioTrack.enabled)
      }
    } catch (err) {
      console.error('Failed to start media stream:', err)
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start media stream'
      setError(errorMessage)
      setIsActive(false)
    }
  }, [deviceId, audio, videoConstraints])

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setStream(null)
      setIsActive(false)
    }
  }, [stream])

  const toggleVideo = useCallback(() => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
      }
    }
  }, [stream])

  const toggleAudio = useCallback(() => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
      }
    }
  }, [stream])

  const getCameras = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d) => d.kind === 'videoinput')
  }, [])

  const getAudioDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d) => d.kind === 'audioinput')
  }, [])

  // Auto-start effect
  useEffect(() => {
    if (autoStart) {
      startStream()
    }

    // Cleanup on unmount
    return () => {
      stopStream()
    }
  }, [autoStart, startStream, stopStream])

  return {
    videoRef,
    stream,
    startStream,
    stopStream,
    toggleVideo,
    toggleAudio,
    getCameras,
    getAudioDevices,
    isVideoEnabled,
    isAudioEnabled,
    isActive,
    error,
  }
}
