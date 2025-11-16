/**
 * useVideoStreamAttach - Attach a MediaStream to a video element and manage playback
 *
 * Handles all DOM-related concerns:
 * - Setting srcObject on the video element
 * - Starting/stopping playback
 * - Cleanup when stream changes or component unmounts
 *
 * This keeps the concern of "attaching streams to DOM" separate from
 * "managing which devices are available" (useMediaDevice)
 */

import { useEffect } from 'react'

export interface UseVideoStreamAttachOptions {
  /** Video element ref to attach stream to */
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** MediaStream to attach (or null to detach) */
  stream: MediaStream | null
  /** Whether to auto-play the video (default: true) */
  autoPlay?: boolean
}

/**
 * Attach a MediaStream to a video element and manage playback
 *
 * @example
 * ```tsx
 * const videoRef = useRef<HTMLVideoElement>(null)
 * const { stream } = useMediaDevice({ kind: 'videoinput', autoStart: true })
 *
 * useVideoStreamAttach({
 *   videoRef,
 *   stream,
 *   autoPlay: true,
 * })
 *
 * return <video ref={videoRef} />
 * ```
 */
export function useVideoStreamAttach({
  videoRef,
  stream,
  autoPlay = true,
}: UseVideoStreamAttachOptions): void {
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    // If no stream, clear the element
    if (!stream) {
      videoElement.srcObject = null
      return
    }

    console.log('[useVideoStreamAttach] Attaching stream to video element')
    // Intentional: Setting srcObject on the DOM element (not a React state mutation)
    // eslint-disable-next-line react-compiler/react-compiler
    videoElement.srcObject = stream

    // Start playback if requested
    if (autoPlay) {
      videoElement.play().catch((err) => {
        console.error('[useVideoStreamAttach] Error starting video playback:', err)
      })
    }

    // Cleanup: stop playback when stream changes or component unmounts
    return () => {
      videoElement.srcObject = null
    }
  }, [stream, videoRef, autoPlay])
}
