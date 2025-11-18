/**
 * Hook for managing media streams with useSyncExternalStore
 *
 * Replaces useState-based stream management with a store pattern that:
 * - Caches the current stream to avoid repeated allocations
 * - Notifies all listeners when a new stream becomes available
 * - Handles cleanup (stopMediaStream) when streams change
 * - Uses useSyncExternalStore for cross-component synchronization
 *
 * This pattern matches useSelectedMediaDevice architecture for consistency.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { stopMediaStream } from '@/lib/media-stream-manager'

export interface MediaStreamState {
  videoinput: MediaStream | null
  audioinput: MediaStream | null
  audiooutput: MediaStream | null
}

/**
 * Create a store for managing media streams per device kind
 * Uses a cache to maintain stream references and notify listeners on changes
 */
function createMediaStreamStore() {
  const listeners: Set<() => void> = new Set()

  // Cache stores all streams (video, audio input, audio output)
  const cachedState: MediaStreamState = {
    videoinput: null,
    audioinput: null,
    audiooutput: null,
  }

  /**
   * Get current stream state (synchronous for useSyncExternalStore)
   */
  function getSnapshot(): MediaStreamState {
    console.log('[MediaStreamStore] Getting snapshot', cachedState)
    return cachedState
  }

  /**
   * Get server snapshot (for SSR, returns empty state)
   */
  function getServerSnapshot(): MediaStreamState {
    return {
      videoinput: null,
      audioinput: null,
      audiooutput: null,
    }
  }

  /**
   * Notify all listeners of state change
   */
  function notifyListeners(): void {
    listeners.forEach((listener) => listener())
  }

  /**
   * Set a new stream and clean up the old one
   * This is the core operation that handles:
   * 1. Stopping the previous stream (cleanup)
   * 2. Updating the cache with the new stream
   * 3. Notifying all listeners
   */
  function setStream(
    kind: 'videoinput' | 'audioinput' | 'audiooutput',
    newStream: MediaStream | null,
  ): void {
    try {
      // Get the previous stream for cleanup
      const prevStream = cachedState[kind]

      // Stop previous stream if it exists
      if (prevStream != null) {
        console.log(`[MediaStreamStore] Stopping previous ${kind} stream`)
        stopMediaStream(prevStream)
      }
      console.log(`[MediaStreamStore] Setting ${kind} stream`, newStream)
      // Update cache with new stream
      cachedState[kind] = newStream

      console.log(
        `[MediaStreamStore] Set ${kind} stream:`,
        newStream
          ? `stream with ${newStream.getTracks().length} tracks`
          : 'null',
      )

      // Notify listeners
      notifyListeners()
    } catch (error) {
      console.error(`[MediaStreamStore] Failed to set ${kind} stream:`, error)
    }
  }

  /**
   * Clear a stream and stop it
   */
  function clearStream(
    kind: 'videoinput' | 'audioinput' | 'audiooutput',
  ): void {
    try {
      const stream = cachedState[kind]
      if (stream != null) {
        console.log(`[MediaStreamStore] Clearing ${kind} stream`)
        stopMediaStream(stream)
        cachedState[kind] = null
        notifyListeners()
      }
    } catch (error) {
      console.error(`[MediaStreamStore] Failed to clear ${kind} stream:`, error)
    }
  }

  /**
   * Subscribe to state changes
   */
  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    getSnapshot,
    getServerSnapshot,
    subscribe,
    setStream,
    clearStream,
  }
}

// Create singleton store instance
const mediaStreamStore = createMediaStreamStore()

export interface UseMediaStreamStoreReturn {
  /** Current media stream for the device kind */
  stream: MediaStream | null
  /** Set a new stream (handles cleanup of old stream) */
  setStream: (stream: MediaStream | null) => void
  /** Clear the stream and stop it */
  clearStream: () => void
}

/**
 * Hook to manage media streams with automatic cleanup
 *
 * @param kind Type of media device ('videoinput' or 'audioinput')
 * @returns Object with stream and functions to set/clear
 *
 * @example
 * ```tsx
 * function VideoCapture() {
 *   const { stream, setStream, clearStream } = useMediaStreamStore('videoinput')
 *
 *   const handleStartCamera = async () => {
 *     const { stream: newStream } = await getMediaStream({
 *       videoDeviceId: 'device-id',
 *       video: true,
 *       audio: false,
 *     })
 *     setStream(newStream)  // Old stream automatically stopped
 *   }
 *
 *   const handleStopCamera = () => {
 *     clearStream()  // Stream stopped and cleared
 *   }
 *
 *   return (
 *     <div>
 *       <video srcObject={stream} autoPlay muted playsInline />
 *       <button onClick={handleStartCamera}>Start</button>
 *       <button onClick={handleStopCamera}>Stop</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useMediaStreamStore(
  kind: 'videoinput' | 'audioinput' | 'audiooutput',
): UseMediaStreamStoreReturn {
  // Use useSyncExternalStore to sync with the media stream store
  // All components using this hook will re-render when any stream changes
  const state = useSyncExternalStore(
    mediaStreamStore.subscribe,
    mediaStreamStore.getSnapshot,
    mediaStreamStore.getServerSnapshot,
  )

  // Set stream for this kind
  const setStream = useCallback(
    (stream: MediaStream | null) => mediaStreamStore.setStream(kind, stream),
    [kind],
  )

  // Clear stream for this kind
  const clearStream = useCallback(() => {
    mediaStreamStore.clearStream(kind)
  }, [kind])

  return useMemo(
    () => ({
      stream: state[kind],
      setStream,
      clearStream,
    }),
    [clearStream, kind, setStream, state],
  )
}
