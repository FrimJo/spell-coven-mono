import type {
  MediaDiagnosticPublication,
  MediaDiagnosticsSnapshot,
  MediaTrackState,
  RemoteMediaParticipant,
  RoomMediaSessionState,
} from '@/types/media-session'

function describeTrackState(
  source: string,
  kind: string,
  state: MediaTrackState,
): MediaDiagnosticPublication {
  return {
    source,
    kind,
    subscribed: state.subscribed,
    muted: state.muted,
  }
}

export function createMediaDiagnosticsSnapshot(
  state: Pick<
    RoomMediaSessionState,
    | 'connectionState'
    | 'local'
    | 'remotes'
    | 'lastDisconnectReason'
    | 'lastError'
  >,
): MediaDiagnosticsSnapshot {
  const publications: Record<string, MediaDiagnosticPublication[]> = {}

  if (state.local) {
    publications[state.local.sessionId] = [
      describeTrackState('camera', 'video', state.local.video),
      describeTrackState('microphone', 'audio', state.local.audio),
    ]
  }

  for (const participant of state.remotes.values()) {
    publications[participant.sessionId] = describeRemoteParticipant(participant)
  }

  return {
    connectionState: state.connectionState,
    localSessionId: state.local?.sessionId ?? '',
    remoteSessionIds: Array.from(state.remotes.keys()),
    publications,
    lastDisconnectReason: state.lastDisconnectReason,
    lastError: state.lastError?.message ?? null,
  }
}

function describeRemoteParticipant(
  participant: RemoteMediaParticipant,
): MediaDiagnosticPublication[] {
  return [
    describeTrackState('camera', 'video', participant.video),
    describeTrackState('microphone', 'audio', participant.audio),
  ]
}
