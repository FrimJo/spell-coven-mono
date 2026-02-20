/**
 * Custom hook to manage video stream attachments to video elements
 * Handles the complex logic of attaching/detaching streams based on track states
 */

import type { TrackState } from '@/types/connection'
import { useEffect, useEffectEvent, useRef } from 'react'

interface UseVideoStreamAttachmentOptions {
  /** Map of player IDs to their MediaStreams */
  remoteStreams: Map<string, MediaStream | null>
  /** Map of player IDs to their track states */
  trackStates: Map<string, TrackState>
  /** Ref to video elements map */
  videoElementsRef: React.MutableRefObject<Map<string, HTMLVideoElement>>
  /** Ref to track attached streams */
  attachedStreamsRef: React.MutableRefObject<Map<string, MediaStream | null>>
  /** Callback when video starts playing */
  onVideoPlaying?: (playerId: string) => void
  /** Callback when video stops playing */
  onVideoStopped?: (playerId: string) => void
}

/**
 * Hook to manage video stream attachments
 * Only updates when streams or track states actually change
 */
export function useVideoStreamAttachment({
  remoteStreams,
  trackStates,
  videoElementsRef,
  attachedStreamsRef,
  onVideoPlaying,
  onVideoStopped,
}: UseVideoStreamAttachmentOptions) {
  const lastStreamsRef = useRef<Map<string, MediaStream | null>>(new Map())
  const lastTrackStatesRef = useRef<Map<string, TrackState>>(new Map())
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const onPlaying = useEffectEvent((playerId: string) => {
    onVideoPlaying?.(playerId)
  })

  const onStopped = useEffectEvent((playerId: string) => {
    onVideoStopped?.(playerId)
  })

  useEffect(() => {
    // Quick check: compare sizes first
    if (
      remoteStreams.size === lastStreamsRef.current.size &&
      trackStates.size === lastTrackStatesRef.current.size
    ) {
      let streamsChanged = false
      for (const [id, stream] of remoteStreams) {
        if (lastStreamsRef.current.get(id) !== stream) {
          streamsChanged = true
          break
        }
      }

      let trackStatesChanged = false
      if (!streamsChanged) {
        for (const [id, state] of trackStates) {
          const last = lastTrackStatesRef.current.get(id)
          if (
            !last ||
            state.videoEnabled !== last.videoEnabled ||
            state.audioEnabled !== last.audioEnabled
          ) {
            trackStatesChanged = true
            break
          }
        }
      }

      if (!streamsChanged && !trackStatesChanged) {
        return
      }
    }

    // Snapshot the *previous* state before overwriting so per-player diffs are correct
    const prevTrackStates = lastTrackStatesRef.current

    // Process each stream
    for (const [playerId, stream] of remoteStreams) {
      const videoElement = videoElementsRef.current.get(playerId)
      if (!videoElement) continue

      const trackState = trackStates.get(playerId)
      const currentAttachedStream = attachedStreamsRef.current.get(playerId)

      if (!stream) {
        if (currentAttachedStream && videoElement.srcObject) {
          videoElement.srcObject = null
          attachedStreamsRef.current.set(playerId, null)
          onStopped(playerId)
        }
        continue
      }

      const hasLiveVideoTrack =
        trackState?.videoEnabled ??
        stream.getVideoTracks().some((t) => t.readyState === 'live')

      const currentSrcObject = videoElement.srcObject as MediaStream | null
      const shouldHaveStream = hasLiveVideoTrack
      const hasCorrectSrcObject = shouldHaveStream
        ? currentSrcObject === stream
        : currentSrcObject === null
      const attachedStreamMatches = currentAttachedStream === stream

      const prevTrackState = prevTrackStates.get(playerId)
      const trackStateChanged =
        prevTrackState !== undefined &&
        prevTrackState.videoEnabled !== trackState?.videoEnabled

      if (
        !hasCorrectSrcObject ||
        !attachedStreamMatches ||
        (trackStateChanged && shouldHaveStream)
      ) {
        if (shouldHaveStream) {
          if (currentSrcObject && currentSrcObject !== stream) {
            videoElement.srcObject = null
          }

          if (trackStateChanged && currentSrcObject === stream) {
            console.log(
              `[useVideoStreamAttachment] Force reload for ${playerId} due to track state change`,
            )
            videoElement.srcObject = null
            const timer = setTimeout(() => {
              pendingTimersRef.current.delete(timer)
              videoElement.srcObject = stream
              videoElement.load()
              videoElement.play().catch((error) => {
                if (error.name !== 'AbortError') {
                  console.error(
                    `[useVideoStreamAttachment] Failed to play video for ${playerId}:`,
                    error,
                  )
                }
              })
            }, 10)
            pendingTimersRef.current.add(timer)
          } else {
            videoElement.srcObject = stream
            videoElement.load()
            videoElement.play().catch((error) => {
              if (error.name !== 'AbortError') {
                console.error(
                  `[useVideoStreamAttachment] Failed to play video for ${playerId}:`,
                  error,
                )
              }
            })
          }

          attachedStreamsRef.current.set(playerId, stream)
          onPlaying(playerId)
        } else {
          videoElement.srcObject = null
          attachedStreamsRef.current.set(playerId, stream)
          onStopped(playerId)
        }
      }
    }

    // Update snapshot refs *after* processing so next run diffs correctly
    lastStreamsRef.current = new Map(remoteStreams)
    lastTrackStatesRef.current = new Map(trackStates)

    return () => {
      for (const timer of pendingTimersRef.current) {
        clearTimeout(timer)
      }
      pendingTimersRef.current.clear()
    }
  }, [
    remoteStreams,
    trackStates,
    videoElementsRef,
    attachedStreamsRef,
    onPlaying,
    onStopped,
  ])
}
