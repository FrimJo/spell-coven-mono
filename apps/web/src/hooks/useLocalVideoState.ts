/**
 * Hook for managing local video state with synchronization across:
 * - UI button state (show enabled/disabled)
 * - Physical webcam track (enable/disable)
 * - Peer stream (send/don't send video to peers)
 *
 * State is derived from the actual stream track state, not just initialized once.
 * This ensures the UI always reflects the true state of the video stream.
 */

import { useCallback, useEffect, useState } from 'react'

export interface UseLocalVideoStateReturn {
  /** Whether video is currently enabled (derived from track state) */
  videoEnabled: boolean
  /** Toggle video on/off */
  toggleVideo: (enabled: boolean) => Promise<void>
  /** Set video state without peer notification (for initialization) */
  setVideoEnabled: (enabled: boolean) => void
}

export interface UseLocalVideoStateOptions {
  /** Video element ref to control track */
  videoRef?: React.RefObject<HTMLVideoElement | null>
  /** Callback when video state changes (for peer notification) */
  onVideoStateChanged?: (enabled: boolean) => Promise<void>
  /** Initial video state (used before stream is available) */
  initialEnabled?: boolean
}

/**
 * Hook to manage local video state with synchronization
 *
 * Coordinates:
 * 1. UI state - Button shows enabled/disabled
 * 2. Physical track - Enables/disables webcam
 * 3. Peer stream - Notifies peers of state change
 *
 * @example
 * ```tsx
 * const { videoEnabled, toggleVideo } = useLocalVideoState({
 *   videoRef,
 *   onVideoStateChanged: async (enabled) => {
 *     await peerConnection.toggleVideo(enabled)
 *   },
 *   initialEnabled: true,
 * })
 *
 * return (
 *   <button onClick={() => toggleVideo(!videoEnabled)}>
 *     {videoEnabled ? 'Video On' : 'Video Off'}
 *   </button>
 * )
 * ```
 */
export function useLocalVideoState(
  options: UseLocalVideoStateOptions = {},
): UseLocalVideoStateReturn {
  const {
    videoRef,
    onVideoStateChanged,
    initialEnabled = true,
  } = options

  const [_forceUpdate, setForceUpdate] = useState(0)
  const [isTogglingVideo, setIsTogglingVideo] = useState(false)

  /**
   * Get current video enabled state from the actual stream track
   * This is the source of truth - no separate state needed
   */
  const getVideoEnabled = useCallback(() => {
    if (!videoRef?.current?.srcObject) {
      return initialEnabled
    }

    const stream = videoRef.current.srcObject as MediaStream
    const videoTracks = stream.getVideoTracks()

    if (videoTracks.length === 0) {
      return false
    }

    return videoTracks[0]!.enabled
  }, [videoRef, initialEnabled])

  /**
   * Derive videoEnabled from track state
   * Triggers re-render when track state changes via event listener
   */
  const videoEnabled = getVideoEnabled()

  /**
   * Listen for track state changes and trigger re-render
   * Uses standard MediaStreamTrack events: mute, unmute, ended
   * This ensures UI updates when track state changes
   */
  useEffect(() => {
    if (!videoRef?.current?.srcObject) {
      return
    }

    const stream = videoRef.current.srcObject as MediaStream
    const videoTracks = stream.getVideoTracks()

    if (videoTracks.length === 0) {
      return
    }

    // Trigger re-render when track state changes
    const handleTrackStateChange = () => {
      setForceUpdate((prev) => prev + 1)
    }

    videoTracks.forEach((track) => {
      // mute: fires when track.enabled becomes false (or browser mutes it)
      track.addEventListener('mute', handleTrackStateChange)
      // unmute: fires when track.enabled becomes true (or browser unmutes it)
      track.addEventListener('unmute', handleTrackStateChange)
      // ended: fires when track ends
      track.addEventListener('ended', handleTrackStateChange)
    })

    return () => {
      videoTracks.forEach((track) => {
        track.removeEventListener('mute', handleTrackStateChange)
        track.removeEventListener('unmute', handleTrackStateChange)
        track.removeEventListener('ended', handleTrackStateChange)
      })
    }
  }, [videoRef])

  /**
   * Toggle video on/off
   * Coordinates:
   * 1. Update physical track
   * 2. Update UI state
   * 3. Notify peers
   */
  const toggleVideo = useCallback(
    async (enabled: boolean) => {
      if (isTogglingVideo) return // Prevent concurrent toggles
      if (videoEnabled === enabled) return // No state change needed

      setIsTogglingVideo(true)

      try {
        // Step 1: Update physical track (enable/disable webcam)
        if (videoRef?.current?.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream
          const videoTracks = stream.getVideoTracks()
          videoTracks.forEach((track) => {
            track.enabled = enabled
          })
        }

        // Step 2: Notify peers (e.g., send to PeerJS)
        // UI state is derived from track state, so it updates automatically
        if (onVideoStateChanged) {
          await onVideoStateChanged(enabled)
        }

        console.log(`[useLocalVideoState] Video ${enabled ? 'enabled' : 'disabled'}`)
      } catch (error) {
        console.error('[useLocalVideoState] Failed to toggle video:', error)
        // Revert track state on error
        if (videoRef?.current?.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream
          const videoTracks = stream.getVideoTracks()
          videoTracks.forEach((track) => {
            track.enabled = !enabled
          })
        }
        throw error
      } finally {
        setIsTogglingVideo(false)
      }
    },
    [videoRef, onVideoStateChanged, videoEnabled, isTogglingVideo],
  )

  /**
   * Set video state without peer notification
   * Used for initialization or when state comes from peers
   * Directly updates track state; UI derives from it automatically
   */
  const setVideoEnabledWithoutNotify = useCallback((enabled: boolean) => {
    if (videoRef?.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      const videoTracks = stream.getVideoTracks()
      videoTracks.forEach((track) => {
        track.enabled = enabled
      })
      // Trigger re-render by updating force update counter
      setForceUpdate((prev) => prev + 1)
    }
  }, [videoRef])

  return {
    videoEnabled,
    toggleVideo,
    setVideoEnabled: setVideoEnabledWithoutNotify,
  }
}
