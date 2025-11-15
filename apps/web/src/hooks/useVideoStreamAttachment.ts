/**
 * Custom hook to manage video stream attachments to video elements
 * Handles the complex logic of attaching/detaching streams based on track states
 */

import { useEffect, useRef } from 'react'
import type { PeerTrackState } from '@/types/peerjs'

interface UseVideoStreamAttachmentOptions {
  /** Map of player IDs to their MediaStreams */
  remoteStreams: Map<string, MediaStream | null>
  /** Map of player IDs to their track states */
  peerTrackStates: Map<string, PeerTrackState>
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
  peerTrackStates,
  videoElementsRef,
  attachedStreamsRef,
  onVideoPlaying,
  onVideoStopped,
}: UseVideoStreamAttachmentOptions) {
  // Track last known states to detect actual changes
  const lastStreamsRef = useRef<Map<string, MediaStream | null>>(new Map())
  const lastTrackStatesRef = useRef<Map<string, PeerTrackState>>(new Map())

  useEffect(() => {
    // Quick check: compare sizes first
    if (
      remoteStreams.size === lastStreamsRef.current.size &&
      peerTrackStates.size === lastTrackStatesRef.current.size
    ) {
      // Check if any streams changed
      let streamsChanged = false
      for (const [id, stream] of remoteStreams) {
        if (lastStreamsRef.current.get(id) !== stream) {
          streamsChanged = true
          break
        }
      }

      // Check if any track states changed
      let trackStatesChanged = false
      if (!streamsChanged) {
        for (const [id, state] of peerTrackStates) {
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

      // Early return if nothing changed
      if (!streamsChanged && !trackStatesChanged) {
        return
      }
    }

    // Update refs with current state
    lastStreamsRef.current = new Map(remoteStreams)
    lastTrackStatesRef.current = new Map(peerTrackStates)

    // Process each stream
    for (const [playerId, stream] of remoteStreams) {
      const videoElement = videoElementsRef.current.get(playerId)
      if (!videoElement) continue

      const trackState = peerTrackStates.get(playerId)
      const currentAttachedStream = attachedStreamsRef.current.get(playerId)

      // Handle no stream case
      if (!stream) {
        if (currentAttachedStream && videoElement.srcObject) {
          videoElement.srcObject = null
          attachedStreamsRef.current.set(playerId, null)
          onVideoStopped?.(playerId)
        }
        continue
      }

      // Determine if video track is live
      const hasLiveVideoTrack =
        trackState?.videoEnabled ??
        stream.getVideoTracks().some((t) => t.readyState === 'live')

      const currentSrcObject = videoElement.srcObject as MediaStream | null
      const shouldHaveStream = hasLiveVideoTrack
      const hasCorrectSrcObject = shouldHaveStream
        ? currentSrcObject === stream
        : currentSrcObject === null
      const attachedStreamMatches = currentAttachedStream === stream

      // Check if track state changed (for forcing reload when tracks are replaced)
      const lastTrackState = lastTrackStatesRef.current.get(playerId)
      const trackStateChanged = lastTrackState?.videoEnabled !== trackState?.videoEnabled

      // Update if needed OR if track state changed (to handle replaceTrack scenarios)
      if (!hasCorrectSrcObject || !attachedStreamMatches || (trackStateChanged && shouldHaveStream)) {
        if (shouldHaveStream) {
          // Attach stream or force reload if track state changed
          if (currentSrcObject && currentSrcObject !== stream) {
            videoElement.srcObject = null
          }
          
          // Force reload by clearing and resetting srcObject if track was re-enabled
          if (trackStateChanged && currentSrcObject === stream) {
            console.log(`[useVideoStreamAttachment] Force reload for ${playerId} due to track state change`)
            videoElement.srcObject = null
            // Small delay to ensure the clear takes effect
            setTimeout(() => {
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
          onVideoPlaying?.(playerId)
        } else {
          // Clear stream
          videoElement.srcObject = null
          attachedStreamsRef.current.set(playerId, stream) // Keep ref for audio
          onVideoStopped?.(playerId)
        }
      }
    }
  }, [remoteStreams, peerTrackStates, videoElementsRef, attachedStreamsRef, onVideoPlaying, onVideoStopped])
}

