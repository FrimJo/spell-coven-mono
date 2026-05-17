import type { Track } from 'livekit-client'

export type MediaConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'signalReconnecting'

export type MediaTrack = Track

export interface MediaTrackState {
  enabled: boolean
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
  diagnostics: MediaDiagnosticsSnapshot
}

export interface RoomMediaControls {
  setCameraEnabled: (enabled: boolean) => Promise<void>
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>
}

export interface RoomMediaContextValue extends RoomMediaSessionState {
  controls: RoomMediaControls
}
