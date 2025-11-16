/**
 * Video stream utility functions for attaching streams to video elements
 * Plain TypeScript utilities (not React hooks) for maximum reusability
 */

/**
 * Attach a MediaStream to a video element and start playback
 *
 * @param videoElement - The video element to attach the stream to
 * @param stream - The MediaStream to attach (or null to detach)
 * @returns Cleanup function to detach the stream
 *
 * @example
 * ```tsx
 * const videoRef = useRef<HTMLVideoElement>(null)
 * const { stream } = useMediaDevice({ kind: 'videoinput', autoStart: true })
 *
 * useEffect(() => {
 *   if (!videoRef.current || !stream) return
 *   return attachVideoStream(videoRef.current, stream)
 * }, [stream])
 * ```
 */
export function attachVideoStream(
  videoElement: HTMLVideoElement | null,
  stream: MediaStream | null,
): (() => void) | undefined {
  if (videoElement == null) return
  // If no stream, clear the element
  if (stream == null) {
    videoElement.srcObject = null
    return
  }

  console.log('[attachVideoStream] Attaching stream to video element')
  // Intentional: Setting srcObject on the DOM element (not a React state mutation)

  videoElement.srcObject = stream

  // Start playback
  videoElement.play().catch((err) => {
    console.error('[attachVideoStream] Error starting video playback:', err)
  })

  // Return cleanup function
  return () => {
    videoElement.srcObject = null
  }
}

/**
 * Attach a MediaStream to a video element without auto-play
 *
 * Useful for preview scenarios where you want to control playback separately
 *
 * @param videoElement - The video element to attach the stream to
 * @param stream - The MediaStream to attach (or null to detach)
 * @returns Cleanup function to detach the stream
 */
export function attachVideoStreamNoAutoPlay(
  videoElement: HTMLVideoElement | null,
  stream: MediaStream | null,
): (() => void) | undefined {
  if (videoElement == null) return
  // If no stream, clear the element
  if (stream == null) {
    videoElement.srcObject = null
    return
  }

  console.log('[attachVideoStreamNoAutoPlay] Attaching stream to video element')

  videoElement.srcObject = stream

  // Return cleanup function
  return () => {
    videoElement.srcObject = null
  }
}
