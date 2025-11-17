/**
 * useVideoTrackState - Listen to video track state changes using useSyncExternalStore
 *
 * Similar to useMediaDeviceChange, but for a specific MediaStream's video track state.
 * Provides a modern React way to subscribe to track state changes (enabled/disabled/ended)
 * using the track's mute/unmute/ended events via useSyncExternalStore.
 *
 * @example
 * ```tsx
 * const videoEnabled = useVideoTrackState(stream)
 * // Re-renders whenever the track's enabled state changes
 * ```
 */

import { useMemo, useSyncExternalStore } from 'react'

/**
 * Create a subscription manager for a specific video track's state
 * This is the external store that useSyncExternalStore subscribes to
 */
function createVideoTrackStore(stream: MediaStream | null) {
  const listeners: Set<() => void> = new Set()

  // Initialize cache with current state
  let cachedEnabled: boolean = stream?.getVideoTracks()[0]?.enabled ?? false

  /**
   * Get current track enabled state from cache
   * The cache is updated when mute/unmute/ended events fire
   */
  function getSnapshot(): boolean {
    return cachedEnabled
  }

  /**
   * Get server snapshot (for SSR, returns false)
   */
  function getServerSnapshot(): boolean {
    return false
  }

  /**
   * Subscribe to track state changes
   */
  function subscribe(listener: () => void): () => void {
    listeners.add(listener)

    if (!stream) {
      return () => {
        listeners.delete(listener)
      }
    }

    const videoTracks = stream.getVideoTracks()

    if (videoTracks.length === 0) {
      return () => {
        listeners.delete(listener)
      }
    }

    // When track state changes, update cache and notify React
    const handleTrackStateChange = () => {
      // Update cache with current track state
      const currentTrack = stream.getVideoTracks()[0]
      if (currentTrack) {
        cachedEnabled = currentTrack.enabled
      }
      // Notify all listeners
      listeners.forEach((l) => l())
    }

    videoTracks.forEach((track) => {
      // mute: fires when track.enabled becomes false (or browser mutes it)
      track.addEventListener('mute', handleTrackStateChange)
      // unmute: fires when track.enabled becomes true (or browser unmutes it)
      track.addEventListener('unmute', handleTrackStateChange)
      // ended: fires when track ends
      track.addEventListener('ended', handleTrackStateChange)
    })

    // Return unsubscribe function
    return () => {
      listeners.delete(listener)
      videoTracks.forEach((track) => {
        track.removeEventListener('mute', handleTrackStateChange)
        track.removeEventListener('unmute', handleTrackStateChange)
        track.removeEventListener('ended', handleTrackStateChange)
      })
    }
  }

  return {
    getSnapshot,
    getServerSnapshot,
    subscribe,
  }
}

/**
 * Hook to listen for video track state changes
 *
 * @param stream MediaStream to track (source of truth)
 * @returns Current video enabled state
 *
 * @example
 * ```tsx
 * function VideoToggle() {
 *   const videoEnabled = useVideoTrackState(stream)
 *
 *   return (
 *     <button>
 *       {videoEnabled ? 'Video On' : 'Video Off'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useVideoTrackState(stream: MediaStream | null): boolean {
  // Create a new store instance for this stream
  // Memoize to avoid recreating on every render
  const store = useMemo(() => createVideoTrackStore(stream), [stream])

  const videoEnabled = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  )

  return videoEnabled
}
