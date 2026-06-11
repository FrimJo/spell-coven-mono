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

type SessionListener = (state: RoomMediaSessionState) => void

export interface LiveKitMediaAdapter {
  connect: (serverUrl: string, token: string) => Promise<void>
  disconnect: () => void
  reportError: (error: Error) => void
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

function toMediaConnectionState(state: ConnectionState): MediaConnectionState {
  switch (state) {
    case ConnectionState.Disconnected:
      return 'disconnected'
    case ConnectionState.Connecting:
      return 'connecting'
    case ConnectionState.Connected:
      return 'connected'
    case ConnectionState.Reconnecting:
      return 'reconnecting'
    case ConnectionState.SignalReconnecting:
      return 'signalReconnecting'
    default: {
      const exhaustiveCheck: never = state
      return exhaustiveCheck
    }
  }
}

function mapRemoteParticipant(
  participant: RemoteParticipant,
): RemoteMediaParticipant {
  return {
    sessionId: participant.identity,
    userId: participant.attributes.userId || null,
    username: participant.name ?? participant.attributes.username ?? null,
    video: getParticipantTrackState(participant, LiveKitTrack.Source.Camera),
    audio: getParticipantTrackState(
      participant,
      LiveKitTrack.Source.Microphone,
    ),
  }
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

    onStateChange({
      connectionState: toMediaConnectionState(room.state),
      isReconnecting:
        room.state === ConnectionState.Reconnecting ||
        room.state === ConnectionState.SignalReconnecting,
      local: mapLocalParticipant(room.localParticipant, sessionId),
      remotes,
      lastError,
      lastDisconnectReason,
    })
  }

  const reportError = (error: Error) => {
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
    .on(RoomEvent.MediaDevicesError, reportError)
    .on(RoomEvent.Disconnected, (reason) => {
      lastDisconnectReason = reason === undefined ? null : String(reason)
      emitState()
    })

  emitState()

  return {
    reportError,
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
