import type { Track } from 'livekit-client'

export type MediaConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'signalReconnecting'

/**
 * Presence of a single remote peer's media, as opposed to our own room
 * transport state (`MediaConnectionState`). A peer can be known via Convex
 * presence yet not yet visible as a LiveKit remote participant.
 *
 * - `connected`: peer is a live LiveKit remote participant.
 * - `pending`: our room is connected but the peer has not joined LiveKit yet.
 * - `connecting`: our room transport is (re)connecting, so peer media is unknown.
 * - `disconnected`: our room transport is down.
 */
export type PeerMediaPresence =
  | 'connected'
  | 'pending'
  | 'connecting'
  | 'disconnected'

/**
 * Subscription/mute state for a remote participant's tracks, surfaced as
 * data-* attributes for e2e media diagnostics.
 */
export interface RemoteMediaStatus {
  videoSubscribed: boolean
  audioSubscribed: boolean
  videoMuted: boolean
  audioMuted: boolean
}

/**
 * Resolve a peer's media presence from whether it is a live LiveKit remote
 * participant and our own room transport state. Keeping these two concepts
 * separate is what lets the "waiting for peer" warning fire while our room is
 * otherwise healthy.
 */
export function resolvePeerMediaPresence(
  remoteMedia: RemoteMediaParticipant | undefined,
  roomConnectionState: MediaConnectionState,
): PeerMediaPresence {
  if (remoteMedia) {
    return 'connected'
  }

  switch (roomConnectionState) {
    case 'connected':
      // Our room is up but this peer has not published to LiveKit yet.
      return 'pending'
    case 'disconnected':
      return 'disconnected'
    default:
      // connecting / reconnecting / signalReconnecting
      return 'connecting'
  }
}

export type MediaTrack = Track

export interface MediaTrackState {
  muted: boolean
  subscribed: boolean
  track: MediaTrack | null
}

export interface RemoteMediaParticipant {
  sessionId: string
  userId: string | null
  username: string | null
  video: MediaTrackState
  audio: MediaTrackState
}

export interface LocalMediaState {
  sessionId: string
  video: MediaTrackState
  audio: MediaTrackState
}

export interface MediaDiagnosticPublication {
  source: string
  kind: string
  subscribed: boolean
  muted: boolean
}

export interface MediaDiagnosticsSnapshot {
  connectionState: MediaConnectionState
  localSessionId: string
  remoteSessionIds: string[]
  publications: Record<string, MediaDiagnosticPublication[]>
  lastDisconnectReason: string | null
  lastError: string | null
}

export interface RoomMediaSessionState {
  connectionState: MediaConnectionState
  isReconnecting: boolean
  local: LocalMediaState | null
  remotes: Map<string, RemoteMediaParticipant>
  lastError: Error | null
  lastDisconnectReason: string | null
}

export interface RoomMediaContextValue extends RoomMediaSessionState {
  setCameraEnabled: (
    enabled: boolean,
    deviceId?: string | null,
  ) => Promise<void>
  setMicrophoneEnabled: (
    enabled: boolean,
    deviceId?: string | null,
  ) => Promise<void>
}
