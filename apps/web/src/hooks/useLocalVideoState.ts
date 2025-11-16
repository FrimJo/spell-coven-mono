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

import { useVideoTrackState } from './useVideoTrackState'

export interface UseLocalVideoStateReturn {
  /** Whether video is currently enabled (derived from track state) */
  videoEnabled: boolean
  /** Toggle video on/off */
  toggleVideo: (enabled: boolean) => Promise<void>
  /** Set video state without peer notification (for initialization) */
  setVideoEnabled: (enabled: boolean) => void
  /** Whether a toggle operation is in progress */
  isTogglingVideo: boolean
}

export interface UseLocalVideoStateOptions {
  /** MediaStream to track (source of truth) */
  stream: MediaStream
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
  options: UseLocalVideoStateOptions,
): UseLocalVideoStateReturn {
  const { stream, onVideoStateChanged } = options

  const [isTogglingVideo, setIsTogglingVideo] = useState(false)

  /**
   * Subscribe to track state changes via the dedicated hook
   * This handles all the mute/unmute/ended event listeners
   */
  const videoEnabled = useVideoTrackState(stream)
  /**
   * Notify peers when video state changes for ANY reason
   * This includes user clicks, browser mutes, external events, etc.
   * Ensures peers always know the true state of our video track
   */
  useEffect(() => {
    void onVideoStateChanged?.(videoEnabled)
  }, [videoEnabled, onVideoStateChanged])

  /**
   * Toggle video on/off
   * Coordinates:
   * 1. Update physical track
   * 2. Update UI state (derived from track state via useSyncExternalStore)
   * 3. Notify peers (handled by useEffect listening to track events)
   */
  const toggleVideo = useCallback(
    async (enabled: boolean) => {
      if (isTogglingVideo) return // Prevent concurrent toggles

      setIsTogglingVideo(true)

      try {
        // Update physical track (enable/disable webcam)
        if (stream) {
          const videoTracks = stream.getVideoTracks()
          // Check if state change is needed by comparing with cached state
          // (cache is kept in sync with actual track state via mute/unmute event listeners)
          if (videoEnabled === enabled) {
            // No state change needed
            return
          }

          videoTracks.forEach((track) => {
            track.enabled = enabled
            // Manually dispatch mute/unmute event since setting track.enabled doesn't trigger browser events
            const event = new Event(enabled ? 'unmute' : 'mute')

            track.dispatchEvent(event)
          })
        }

        console.log(
          `[useLocalVideoState] Video ${enabled ? 'enabled' : 'disabled'}`,
        )
      } catch (error) {
        console.error('[useLocalVideoState] Failed to toggle video:', error)
        // Revert track state on error
        if (stream) {
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
    [stream, isTogglingVideo, videoEnabled],
  )

  /**
   * Set video state without peer notification
   * Used for initialization or when state comes from peers
   * Directly updates track state; UI derives from it automatically via useSyncExternalStore
   */
  const setVideoEnabledWithoutNotify = useCallback(
    (enabled: boolean) => {
      if (stream) {
        const videoTracks = stream.getVideoTracks()
        videoTracks.forEach((track) => {
          track.enabled = enabled
          // Manually dispatch mute/unmute event since setting track.enabled doesn't trigger browser events
          const event = new Event(enabled ? 'unmute' : 'mute')
          track.dispatchEvent(event)
        })
      }
    },
    [stream],
  )

  return {
    videoEnabled,
    toggleVideo,
    setVideoEnabled: setVideoEnabledWithoutNotify,
    isTogglingVideo,
  }
}
