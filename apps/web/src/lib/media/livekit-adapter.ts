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
  addAppBreadcrumb,
  captureAppException,
  startAppSpan,
} from '@/integrations/sentry/reporting'
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
    // Prefer the attached track's mute state when available. Remote
    // publications can briefly keep stale mute metadata across republishes.
    muted: track ? track.isMuted : publication.isMuted,
    subscribed: publication.isSubscribed,
    track,
  }
}

function getTrackState(
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
    video: getTrackState(participant, LiveKitTrack.Source.Camera),
    audio: getTrackState(participant, LiveKitTrack.Source.Microphone),
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
    role: participant.attributes.role || null,
    ownerSessionId: participant.attributes.ownerSessionId || null,
    pairingId: participant.attributes.pairingId || null,
    video: getTrackState(participant, LiveKitTrack.Source.Camera),
    audio: getTrackState(participant, LiveKitTrack.Source.Microphone),
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

  const trackConfig = {
    camera: {
      source: LiveKitTrack.Source.Camera,
      kind: 'videoinput' as const,
      // Disabling the camera fully unpublishes so the device/indicator releases.
      unpublishOnDisable: true,
      setEnabled: (enabled: boolean, opts?: { deviceId?: string }) =>
        room.localParticipant.setCameraEnabled(enabled, opts),
    },
    microphone: {
      source: LiveKitTrack.Source.Microphone,
      kind: 'audioinput' as const,
      unpublishOnDisable: false,
      setEnabled: (enabled: boolean, opts?: { deviceId?: string }) =>
        room.localParticipant.setMicrophoneEnabled(enabled, opts),
    },
  }

  const normalizeDeviceId = (deviceId: string | null | undefined) =>
    deviceId && deviceId.length > 0 ? deviceId : null

  const setLocalTrackEnabled = async (
    track: keyof typeof trackConfig,
    enabled: boolean,
    deviceId: string | null | undefined,
  ) => {
    const { source, kind, unpublishOnDisable, setEnabled } = trackConfig[track]
    const nextDeviceId = normalizeDeviceId(deviceId)
    const publication = room.localParticipant.getTrackPublication(source)
    // A muted track is republished via setEnabled (which can pick the new
    // device), so only swap the device in place when the track is actually live.
    const isLive = Boolean(publication?.track && !publication.isMuted)

    // Track mutate/publish events (TrackMuted, LocalTrackPublished/Unpublished,
    // etc.) drive emitState, so no manual emit is needed here.
    await startAppSpan(
      {
        name: `${track} ${enabled ? 'enable' : 'disable'}`,
        op: 'media.track',
        attributes: { track, enabled },
      },
      async () => {
        if (!enabled) {
          if (unpublishOnDisable) {
            if (publication?.track) {
              await room.localParticipant.unpublishTrack(
                publication.track,
                true,
              )
            }
            return
          }

          if (isLive) {
            await setEnabled(false)
          }
          return
        }

        if (isLive) {
          const activeDeviceId = room.getActiveDevice(kind)
          if (nextDeviceId !== null && nextDeviceId !== activeDeviceId) {
            await startAppSpan(
              {
                name: `Switch ${track} device`,
                op: 'media.device.switch',
                attributes: { kind },
              },
              () => room.switchActiveDevice(kind, nextDeviceId),
            )
          }
          return
        }

        await setEnabled(true, { deviceId: nextDeviceId ?? undefined })
      },
    )
  }

  const emitState = () => {
    const remotes = new Map<string, RemoteMediaParticipant>()
    const phoneCameras = new Map<string, RemoteMediaParticipant>()
    for (const participant of room.remoteParticipants.values()) {
      const mapped = mapRemoteParticipant(participant)
      if (mapped.role === 'phone-camera' && mapped.ownerSessionId) {
        phoneCameras.set(mapped.ownerSessionId, mapped)
      } else {
        remotes.set(participant.identity, mapped)
      }
    }

    onStateChange({
      connectionState: toMediaConnectionState(room.state),
      isReconnecting:
        room.state === ConnectionState.Reconnecting ||
        room.state === ConnectionState.SignalReconnecting,
      local: mapLocalParticipant(room.localParticipant, sessionId),
      remotes,
      phoneCameras,
      lastError,
      lastDisconnectReason,
    })
  }

  const reportError = (error: Error) => {
    lastError = error
    captureAppException(error, {
      tags: { feature: 'media', operation: 'livekit_error' },
    })
    emitState()
  }

  room
    .on(RoomEvent.ConnectionStateChanged, (state) => {
      addAppBreadcrumb('livekit', 'Connection state changed', {
        state: String(state),
      })
      emitState()
    })
    .on(RoomEvent.Connected, () => {
      addAppBreadcrumb('livekit', 'Connected')
      emitState()
    })
    .on(RoomEvent.Reconnecting, () => {
      addAppBreadcrumb('livekit', 'Reconnecting')
      emitState()
    })
    .on(RoomEvent.SignalReconnecting, () => {
      addAppBreadcrumb('livekit', 'Signal reconnecting')
      emitState()
    })
    .on(RoomEvent.Reconnected, () => {
      addAppBreadcrumb('livekit', 'Reconnected')
      emitState()
    })
    .on(RoomEvent.ParticipantConnected, () => {
      addAppBreadcrumb('livekit', 'Participant connected')
      emitState()
    })
    .on(RoomEvent.ParticipantDisconnected, () => {
      addAppBreadcrumb('livekit', 'Participant disconnected')
      emitState()
    })
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
    .on(RoomEvent.ActiveDeviceChanged, emitState)
    .on(RoomEvent.MediaDevicesError, (error) => {
      addAppBreadcrumb('media', 'LiveKit media devices error')
      reportError(error)
    })
    .on(RoomEvent.Disconnected, (reason) => {
      lastDisconnectReason = reason === undefined ? null : String(reason)
      addAppBreadcrumb('livekit', 'Disconnected', {
        reason: lastDisconnectReason,
      })
      emitState()
    })

  emitState()

  return {
    reportError,
    async connect(serverUrl, token) {
      lastError = null
      lastDisconnectReason = null
      emitState()
      await startAppSpan(
        { name: 'LiveKit connect', op: 'livekit.connect' },
        () => room.connect(serverUrl, token),
      )
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
    setCameraEnabled: (enabled, deviceId) =>
      setLocalTrackEnabled('camera', enabled, deviceId),
    setMicrophoneEnabled: (enabled, deviceId) =>
      setLocalTrackEnabled('microphone', enabled, deviceId),
  }
}
