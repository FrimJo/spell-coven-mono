import type {
  LocalMediaState,
  MediaConnectionState,
  MediaTrackState,
  RemoteMediaParticipant,
  RoomMediaSessionState,
} from '@/types/media-session'
import type {
  LocalParticipant,
  Participant,
  RemoteParticipant,
  Room,
  Track,
  TrackPublication,
} from 'livekit-client'
import {
  ConnectionState,
  Room as LiveKitRoom,
  Track as LiveKitTrack,
  RoomEvent,
  VideoPresets,
} from 'livekit-client'

import { createMediaDiagnosticsSnapshot } from './media-diagnostics'

type SessionListener = (state: RoomMediaSessionState) => void

export interface LiveKitMediaAdapter {
  connect: (serverUrl: string, token: string) => Promise<void>
  disconnect: () => void
  setCameraEnabled: (
    enabled: boolean,
    deviceId?: string | null,
  ) => Promise<void>
  setMicrophoneEnabled: (
    enabled: boolean,
    deviceId?: string | null,
  ) => Promise<void>
}

interface LiveKitMediaAdapterOptions {
  sessionId: string
  onStateChange: SessionListener
}

function emptyTrackState(): MediaTrackState {
  return {
    enabled: false,
    muted: true,
    subscribed: false,
    track: null,
  }
}

function publicationToTrackState(
  publication: TrackPublication | undefined,
): MediaTrackState {
  if (!publication) {
    return emptyTrackState()
  }

  const track = publication.track ?? null

  return {
    enabled: publication.isEnabled && !publication.isMuted,
    muted: publication.isMuted,
    subscribed: publication.isSubscribed,
    track,
  }
}

function parseMetadata(metadata: string | undefined): {
  userId: string | null
  username: string | null
} {
  if (!metadata) {
    return { userId: null, username: null }
  }

  try {
    const parsed = JSON.parse(metadata) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return { userId: null, username: null }
    }

    const record = parsed as Record<string, unknown>
    return {
      userId: typeof record.userId === 'string' ? record.userId : null,
      username: typeof record.username === 'string' ? record.username : null,
    }
  } catch {
    return { userId: null, username: null }
  }
}

function getParticipantTrackState(
  participant: Participant,
  source: Track.Source,
): MediaTrackState {
  return publicationToTrackState(participant.getTrackPublication(source))
}

function mapLocalParticipant(
  participant: LocalParticipant,
  sessionId: string,
): LocalMediaState {
  return {
    sessionId,
    video: getParticipantTrackState(participant, LiveKitTrack.Source.Camera),
    audio: getParticipantTrackState(
      participant,
      LiveKitTrack.Source.Microphone,
    ),
  }
}

function mapRemoteParticipant(
  participant: RemoteParticipant,
): RemoteMediaParticipant {
  const metadata = parseMetadata(participant.metadata)

  return {
    sessionId: participant.identity,
    userId: participant.attributes.userId || metadata.userId,
    username: participant.name ?? metadata.username,
    video: getParticipantTrackState(participant, LiveKitTrack.Source.Camera),
    audio: getParticipantTrackState(
      participant,
      LiveKitTrack.Source.Microphone,
    ),
  }
}

function normalizeConnectionState(
  state: ConnectionState,
): MediaConnectionState {
  return state
}

export function createLiveKitMediaAdapter({
  sessionId,
  onStateChange,
}: LiveKitMediaAdapterOptions): LiveKitMediaAdapter {
  const room: Room = new LiveKitRoom({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
  })

  let lastError: Error | null = null
  let lastDisconnectReason: string | null = null

  const emitState = () => {
    const remotes = new Map<string, RemoteMediaParticipant>()
    for (const participant of room.remoteParticipants.values()) {
      remotes.set(participant.identity, mapRemoteParticipant(participant))
    }

    const snapshotBase = {
      connectionState: normalizeConnectionState(room.state),
      isReconnecting:
        room.state === ConnectionState.Reconnecting ||
        room.state === ConnectionState.SignalReconnecting,
      local: mapLocalParticipant(room.localParticipant, sessionId),
      remotes,
      lastError,
      lastDisconnectReason,
    }

    onStateChange({
      ...snapshotBase,
      diagnostics: createMediaDiagnosticsSnapshot(snapshotBase),
    })
  }

  const setLastError = (error: Error) => {
    lastError = error
    emitState()
  }

  room
    .on(RoomEvent.ConnectionStateChanged, emitState)
    .on(RoomEvent.Connected, emitState)
    .on(RoomEvent.Reconnecting, emitState)
    .on(RoomEvent.SignalReconnecting, emitState)
    .on(RoomEvent.Reconnected, emitState)
    .on(RoomEvent.ParticipantConnected, emitState)
    .on(RoomEvent.ParticipantDisconnected, emitState)
    .on(RoomEvent.TrackPublished, emitState)
    .on(RoomEvent.TrackSubscribed, emitState)
    .on(RoomEvent.TrackUnsubscribed, (track: Track) => {
      track.detach()
      emitState()
    })
    .on(RoomEvent.TrackUnpublished, emitState)
    .on(RoomEvent.TrackMuted, emitState)
    .on(RoomEvent.TrackUnmuted, emitState)
    .on(RoomEvent.LocalTrackPublished, emitState)
    .on(RoomEvent.LocalTrackUnpublished, (publication) => {
      publication.track?.detach()
      emitState()
    })
    .on(RoomEvent.MediaDevicesError, setLastError)
    .on(RoomEvent.Disconnected, (reason) => {
      lastDisconnectReason = reason === undefined ? null : String(reason)
      emitState()
    })

  emitState()

  return {
    async connect(serverUrl, token) {
      lastError = null
      lastDisconnectReason = null
      emitState()
      await room.connect(serverUrl, token)
      emitState()
    },
    disconnect() {
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          publication.track?.detach()
        }
      }
      for (const publication of room.localParticipant.trackPublications.values()) {
        publication.track?.detach()
      }
      room.disconnect()
      emitState()
    },
    async setCameraEnabled(enabled, deviceId) {
      await room.localParticipant.setCameraEnabled(enabled, {
        deviceId: deviceId ?? undefined,
      })
      emitState()
    },
    async setMicrophoneEnabled(enabled, deviceId) {
      await room.localParticipant.setMicrophoneEnabled(enabled, {
        deviceId: deviceId ?? undefined,
      })
      emitState()
    },
  }
}
