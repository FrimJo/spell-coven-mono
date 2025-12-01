/**
 * Utilities for detecting track state from MediaStream
 */

import type { TrackState } from '@/types/connection'

/**
 * Get track state from a MediaStream
 */
export function getTrackState(stream: MediaStream | null): TrackState {
  if (!stream) {
    return { videoEnabled: false, audioEnabled: false }
  }

  const videoTrack = stream.getVideoTracks()[0]
  const audioTrack = stream.getAudioTracks()[0]

  return {
    videoEnabled:
      !!videoTrack &&
      videoTrack.readyState === 'live' &&
      videoTrack.enabled &&
      !videoTrack.muted,
    audioEnabled: audioTrack?.enabled ?? false,
  }
}

/**
 * Check if a track is enabled and active
 */
export function isTrackEnabled(track: MediaStreamTrack | null): boolean {
  return !!track && track.readyState === 'live' && track.enabled && !track.muted
}
