/**
 * Hook for managing local video state with synchronization across:
 * - UI button state (show enabled/disabled)
 * - Physical webcam track (enable/disable)
 * - Peer stream (send/don't send video to peers)
 */

import { useCallback, useState } from 'react'

export interface UseLocalVideoStateReturn {
  /** Whether video is currently enabled */
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
  /** Initial video state */
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

  const [videoEnabled, setVideoEnabled] = useState(initialEnabled)
  const [isTogglingVideo, setIsTogglingVideo] = useState(false)

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

        // Step 2: Update UI state
        setVideoEnabled(enabled)

        // Step 3: Notify peers (e.g., send to PeerJS)
        if (onVideoStateChanged) {
          await onVideoStateChanged(enabled)
        }

        console.log(`[useLocalVideoState] Video ${enabled ? 'enabled' : 'disabled'}`)
      } catch (error) {
        console.error('[useLocalVideoState] Failed to toggle video:', error)
        // Revert UI state on error
        setVideoEnabled(!enabled)
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
   */
  const setVideoEnabledWithoutNotify = useCallback((enabled: boolean) => {
    if (videoRef?.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      const videoTracks = stream.getVideoTracks()
      videoTracks.forEach((track) => {
        track.enabled = enabled
      })
    }
    setVideoEnabled(enabled)
  }, [videoRef])

  return {
    videoEnabled,
    toggleVideo,
    setVideoEnabled: setVideoEnabledWithoutNotify,
  }
}
