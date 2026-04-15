import type {
  LocalTrackPublication,
  RemoteAudioTrack,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteVideoTrack,
} from 'livekit-client'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { api } from '@convex/_generated/api'
import { useMutation } from 'convex/react'
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client'

export type RoomMediaConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

export interface RemoteParticipantMedia {
  sessionId: string
  userId: string | null
  username: string | null
  participant: RemoteParticipant
  cameraPublication?: RemoteTrackPublication
  microphonePublication?: RemoteTrackPublication
  videoTrack: RemoteVideoTrack | null
  audioTrack: RemoteAudioTrack | null
  videoEnabled: boolean
  audioEnabled: boolean
}

interface UseRoomMediaSessionOptions {
  roomId: string
  sessionId: string
  userId: string
  username: string
  enabled: boolean
  presenceReady?: boolean
  videoTrack: MediaStreamTrack | null
  audioTrack: MediaStreamTrack | null
  cameraEnabled: boolean
  microphoneEnabled: boolean
}

interface UseRoomMediaSessionReturn {
  connectionState: RoomMediaConnectionState
  remoteParticipantMedia: Map<string, RemoteParticipantMedia>
  publishError: Error | null
  subscriptionError: Error | null
  lastError: Error | null
  localCameraEnabled: boolean
  localMicrophoneEnabled: boolean
}

interface LiveKitParticipantMetadata {
  roomId?: string
  sessionId?: string
  userId?: string
  username?: string
}

function normalizeConnectionState(
  state: ConnectionState | undefined,
): RoomMediaConnectionState {
  switch (state) {
    case ConnectionState.Connected:
      return 'connected'
    case ConnectionState.Connecting:
      return 'connecting'
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      return 'reconnecting'
    case ConnectionState.Disconnected:
    default:
      return 'disconnected'
  }
}

function parseParticipantMetadata(metadata: string | undefined) {
  if (!metadata) {
    return {} satisfies LiveKitParticipantMetadata
  }

  try {
    return JSON.parse(metadata) as LiveKitParticipantMetadata
  } catch {
    return {} satisfies LiveKitParticipantMetadata
  }
}

function buildRemoteParticipantMediaMap(room: Room) {
  const remoteParticipantMedia = new Map<string, RemoteParticipantMedia>()

  for (const participant of room.remoteParticipants.values()) {
    const metadata = parseParticipantMetadata(participant.metadata)
    const cameraPublication = participant.getTrackPublication(
      Track.Source.Camera,
    )
    const microphonePublication = participant.getTrackPublication(
      Track.Source.Microphone,
    )
    const media = {
      sessionId: metadata.sessionId ?? participant.identity,
      userId: metadata.userId ?? null,
      username: metadata.username ?? participant.name ?? null,
      participant,
      cameraPublication,
      microphonePublication,
      videoTrack:
        (cameraPublication?.track as RemoteVideoTrack | undefined) ?? null,
      audioTrack:
        (microphonePublication?.track as RemoteAudioTrack | undefined) ?? null,
      videoEnabled: participant.isCameraEnabled,
      audioEnabled: participant.isMicrophoneEnabled,
    } satisfies RemoteParticipantMedia

    remoteParticipantMedia.set(media.sessionId, media)
  }

  return remoteParticipantMedia
}

export function useRoomMediaSession({
  roomId,
  sessionId,
  userId,
  username: _username,
  enabled,
  presenceReady = true,
  videoTrack,
  audioTrack,
  cameraEnabled,
  microphoneEnabled,
}: UseRoomMediaSessionOptions): UseRoomMediaSessionReturn {
  const issueAccessTokenMutation = useMutation(api.media.issueAccessToken)

  const [connectionState, setConnectionState] =
    useState<RoomMediaConnectionState>('disconnected')
  const [remoteParticipantMedia, setRemoteParticipantMedia] = useState<
    Map<string, RemoteParticipantMedia>
  >(new Map())
  const [publishError, setPublishError] = useState<Error | null>(null)
  const [subscriptionError, setSubscriptionError] = useState<Error | null>(null)

  const roomRef = useRef<Room | null>(null)
  const publishedVideoTrackRef = useRef<MediaStreamTrack | null>(null)
  const publishedAudioTrackRef = useRef<MediaStreamTrack | null>(null)
  const cameraPublicationRef = useRef<LocalTrackPublication | null>(null)
  const microphonePublicationRef = useRef<LocalTrackPublication | null>(null)
  const issueAccessTokenLatest = useEffectEvent(
    async (args: { roomId: string; sessionId: string }) =>
      issueAccessTokenMutation(args),
  )

  const syncRemoteParticipantMedia = useEffectEvent((room: Room) => {
    setRemoteParticipantMedia(buildRemoteParticipantMediaMap(room))
  })

  useEffect(() => {
    if (!enabled || !presenceReady || !roomId || !sessionId || !userId) {
      return
    }

    let cancelled = false
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    })

    roomRef.current = room
    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      setConnectionState('connecting')
      setRemoteParticipantMedia(new Map())
      setPublishError(null)
      setSubscriptionError(null)
    })

    const handleConnectionStateChanged = (state: ConnectionState) => {
      if (cancelled) {
        return
      }

      setConnectionState(normalizeConnectionState(state))
      if (state === ConnectionState.Disconnected) {
        setRemoteParticipantMedia(new Map())
      }
    }

    const handleParticipantMutation = () => {
      if (!cancelled) {
        syncRemoteParticipantMedia(room)
      }
    }

    const handleTrackSubscriptionFailed = (
      trackSid: string,
      participant?: RemoteParticipant,
    ) => {
      if (cancelled) {
        return
      }

      setSubscriptionError(
        new Error(
          `Failed to subscribe to ${trackSid} from ${participant?.identity ?? 'remote participant'}`,
        ),
      )
    }

    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged)
    room.on(RoomEvent.ParticipantConnected, handleParticipantMutation)
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantMutation)
    room.on(RoomEvent.TrackPublished, handleParticipantMutation)
    room.on(RoomEvent.TrackUnpublished, handleParticipantMutation)
    room.on(RoomEvent.TrackSubscribed, handleParticipantMutation)
    room.on(RoomEvent.TrackUnsubscribed, handleParticipantMutation)
    room.on(RoomEvent.TrackMuted, handleParticipantMutation)
    room.on(RoomEvent.TrackUnmuted, handleParticipantMutation)
    room.on(RoomEvent.ParticipantMetadataChanged, handleParticipantMutation)
    room.on(RoomEvent.Reconnected, handleParticipantMutation)
    room.on(RoomEvent.TrackSubscriptionFailed, handleTrackSubscriptionFailed)

    void (async () => {
      try {
        const access = await issueAccessTokenLatest({
          roomId,
          sessionId,
        })

        if (cancelled) {
          return
        }

        await room.connect(access.url, access.token)

        if (cancelled) {
          room.disconnect()
          return
        }

        setConnectionState(normalizeConnectionState(room.state))
        syncRemoteParticipantMedia(room)
      } catch (error) {
        if (cancelled) {
          return
        }

        const nextError =
          error instanceof Error ? error : new Error(String(error))
        setPublishError(nextError)
        setConnectionState('disconnected')
      }
    })()

    return () => {
      cancelled = true
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged)
      room.off(RoomEvent.ParticipantConnected, handleParticipantMutation)
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantMutation)
      room.off(RoomEvent.TrackPublished, handleParticipantMutation)
      room.off(RoomEvent.TrackUnpublished, handleParticipantMutation)
      room.off(RoomEvent.TrackSubscribed, handleParticipantMutation)
      room.off(RoomEvent.TrackUnsubscribed, handleParticipantMutation)
      room.off(RoomEvent.TrackMuted, handleParticipantMutation)
      room.off(RoomEvent.TrackUnmuted, handleParticipantMutation)
      room.off(RoomEvent.ParticipantMetadataChanged, handleParticipantMutation)
      room.off(RoomEvent.Reconnected, handleParticipantMutation)
      room.off(RoomEvent.TrackSubscriptionFailed, handleTrackSubscriptionFailed)
      room.disconnect()

      if (roomRef.current === room) {
        roomRef.current = null
      }

      publishedVideoTrackRef.current = null
      publishedAudioTrackRef.current = null
      cameraPublicationRef.current = null
      microphonePublicationRef.current = null
      setRemoteParticipantMedia(new Map())
      setConnectionState('disconnected')
    }
  }, [enabled, presenceReady, roomId, sessionId, userId])

  useEffect(() => {
    const room = roomRef.current
    if (!room || connectionState !== 'connected') {
      return
    }

    let cancelled = false
    const previousTrack = publishedVideoTrackRef.current

    if (!videoTrack || !cameraEnabled) {
      if (!previousTrack) {
        cameraPublicationRef.current = null
        return
      }

      void room.localParticipant
        .unpublishTrack(previousTrack, false)
        .then(() => {
          if (cancelled) {
            return
          }

          publishedVideoTrackRef.current = null
          cameraPublicationRef.current = null
        })
        .catch((error) => {
          if (!cancelled) {
            setPublishError(
              error instanceof Error ? error : new Error(String(error)),
            )
          }
        })

      return () => {
        cancelled = true
      }
    }

    if (previousTrack === videoTrack && cameraPublicationRef.current) {
      return
    }

    void (async () => {
      try {
        if (previousTrack && previousTrack !== videoTrack) {
          await room.localParticipant.unpublishTrack(previousTrack, false)
        }

        const publication = await room.localParticipant.publishTrack(
          videoTrack,
          {
            source: Track.Source.Camera,
          },
        )

        if (cancelled) {
          await room.localParticipant
            .unpublishTrack(videoTrack, false)
            .catch(() => {})
          return
        }

        publishedVideoTrackRef.current = videoTrack
        cameraPublicationRef.current = publication
        setPublishError(null)
      } catch (error) {
        if (!cancelled) {
          setPublishError(
            error instanceof Error ? error : new Error(String(error)),
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [cameraEnabled, connectionState, videoTrack])

  useEffect(() => {
    const room = roomRef.current
    if (!room || connectionState !== 'connected') {
      return
    }

    let cancelled = false
    const previousTrack = publishedAudioTrackRef.current
    const syncMuteState = async (publication: LocalTrackPublication | null) => {
      if (!publication || cancelled) {
        return
      }

      if (microphoneEnabled) {
        await publication.unmute()
      } else {
        await publication.mute()
      }
    }

    if (!audioTrack) {
      if (!previousTrack) {
        microphonePublicationRef.current = null
        return
      }

      void room.localParticipant
        .unpublishTrack(previousTrack, false)
        .then(() => {
          if (cancelled) {
            return
          }

          publishedAudioTrackRef.current = null
          microphonePublicationRef.current = null
        })
        .catch((error) => {
          if (!cancelled) {
            setPublishError(
              error instanceof Error ? error : new Error(String(error)),
            )
          }
        })

      return () => {
        cancelled = true
      }
    }

    if (previousTrack === audioTrack && microphonePublicationRef.current) {
      void syncMuteState(microphonePublicationRef.current).catch((error) => {
        if (!cancelled) {
          setPublishError(
            error instanceof Error ? error : new Error(String(error)),
          )
        }
      })

      return () => {
        cancelled = true
      }
    }

    void (async () => {
      try {
        if (previousTrack && previousTrack !== audioTrack) {
          await room.localParticipant.unpublishTrack(previousTrack, false)
        }

        const publication = await room.localParticipant.publishTrack(
          audioTrack,
          {
            source: Track.Source.Microphone,
          },
        )

        if (cancelled) {
          await room.localParticipant
            .unpublishTrack(audioTrack, false)
            .catch(() => {})
          return
        }

        publishedAudioTrackRef.current = audioTrack
        microphonePublicationRef.current = publication
        await syncMuteState(publication)
        setPublishError(null)
      } catch (error) {
        if (!cancelled) {
          setPublishError(
            error instanceof Error ? error : new Error(String(error)),
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [audioTrack, connectionState, microphoneEnabled])

  return {
    connectionState,
    remoteParticipantMedia,
    publishError,
    subscriptionError,
    lastError: publishError ?? subscriptionError,
    localCameraEnabled: cameraEnabled && !!videoTrack,
    localMicrophoneEnabled: microphoneEnabled && !!audioTrack,
  }
}
