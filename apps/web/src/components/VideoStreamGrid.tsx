import type {
  MediaConnectionState,
  MediaTrack,
  PeerMediaPresence,
  RemoteMediaParticipant,
  RemoteMediaStatus,
} from '@/types/media-session'
import type { Participant } from '@/types/participant'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { usePresence } from '@/contexts/PresenceContext'
import { useRoomMedia } from '@/contexts/RoomMediaContext'
import { resolvePeerMediaPresence } from '@/types/media-session'
import { domAnimation, LazyMotion, m } from 'framer-motion'
import { AlertCircle, Gamepad2, Loader2 } from 'lucide-react'

import { Card } from '@repo/ui/components/card'

import { LocalVideoCard } from './LocalVideoCard'
import { MediaPermissionGate } from './MediaPermissionGate'
import { RemotePlayerCard } from './RemotePlayerCard'

/**
 * Threshold for considering a player "online" (15 seconds)
 * If lastSeenAt is older than this, they're shown as disconnected.
 * This matches the threshold used in GameRoomSidebar.
 */
const ONLINE_THRESHOLD_MS = 15_000

// Always a 2x2 grid: 1 local + up to 3 remote slots.
const GRID_CLASS = 'grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-2'

interface VideoStreamGridProps {
  // Room and user identification (for fetching participants)
  roomId: string
  userId: string
  localPlayerName: string
  /** Set of muted player IDs (controlled by parent) */
  mutedPlayers?: Set<string>
}

interface RemoteGridSession {
  id: string
  name: string
  participantData: Participant
  remoteVideoTrack: MediaTrack | null
  remoteAudioTrack: MediaTrack | null
  remoteMediaStatus: RemoteMediaStatus
  peerMediaPresenceState: PeerMediaPresence
  isMuted: boolean
  isOnline: boolean
}

function buildRemotePlayers(participants: Participant[], userId: string) {
  return participants.flatMap((participant) =>
    participant.id === userId
      ? []
      : [
          {
            id: participant.id,
            name: participant.username,
            participantData: participant,
          },
        ],
  )
}

function isParticipantOnline(lastSeenAt: number, now: number) {
  return now - lastSeenAt < ONLINE_THRESHOLD_MS
}

function buildRemoteGridSessions({
  players,
  remoteParticipants,
  phoneCameras,
  roomConnectionState,
  mutedPlayers,
  now,
}: {
  players: Array<{
    id: string
    name: string
    participantData: Participant
  }>
  remoteParticipants: Map<string, RemoteMediaParticipant>
  phoneCameras: Map<string, RemoteMediaParticipant>
  roomConnectionState: MediaConnectionState
  mutedPlayers: Set<string>
  now: number
}): RemoteGridSession[] {
  return players.map((player) => {
    const remoteMedia = remoteParticipants.get(player.participantData.sessionId)
    const phoneCamera = phoneCameras.get(player.participantData.sessionId)
    const videoMedia = phoneCamera ?? remoteMedia

    return {
      id: player.id,
      name: player.name,
      participantData: player.participantData,
      remoteVideoTrack: videoMedia?.video.track ?? null,
      remoteAudioTrack: remoteMedia?.audio.track ?? null,
      remoteMediaStatus: {
        videoSubscribed: videoMedia?.video.subscribed ?? false,
        audioSubscribed: remoteMedia?.audio.subscribed ?? false,
        videoMuted: videoMedia?.video.muted ?? true,
        audioMuted: remoteMedia?.audio.muted ?? true,
      },
      peerMediaPresenceState: resolvePeerMediaPresence(
        videoMedia ?? remoteMedia,
        roomConnectionState,
      ),
      isMuted: mutedPlayers.has(player.id),
      isOnline: isParticipantOnline(player.participantData.lastSeenAt, now),
    }
  })
}

function VideoStreamGrid({
  roomId,
  userId,
  localPlayerName,
  mutedPlayers,
}: VideoStreamGridProps) {
  const effectiveMutedPlayers = useMemo(
    () => mutedPlayers ?? new Set<string>(),
    [mutedPlayers],
  )

  // Get participants from context (already deduplicated)
  const { uniqueParticipants: gameRoomParticipants, roomSeatCount } =
    usePresence()

  const roomMedia = useRoomMedia()

  // Current time state for computing online status (updates every 5 seconds)
  // This matches the logic in GameRoomSidebar to keep status synchronized
  const [now, setNow] = useState(() => Date.now())

  // Update current time periodically to re-evaluate online status
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 5_000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const {
    mediaPreferences: { selectedVideoSource },
    permissions: {
      isChecking: isCheckingPermissions,
      needsPermissionDialog,
      permissionsBlocked,
    },
  } = useMediaStreams()

  const localStreamError = roomMedia.lastError
  // Only replace the local card with a spinner on the very first connect, before
  // a local participant exists. Reconnects keep the existing preview visible and
  // surface a non-destructive badge instead (see LocalVideoCard isReconnecting).
  const isLocalStreamPending =
    roomMedia.connectionState === 'connecting' && !roomMedia.local

  const players = useMemo(
    () => buildRemotePlayers(gameRoomParticipants, userId),
    [gameRoomParticipants, userId],
  )

  const localParticipant = useMemo(
    () => gameRoomParticipants.find((p) => p.username === localPlayerName),
    [gameRoomParticipants, localPlayerName],
  )

  const effectiveLocalVideoTrack =
    selectedVideoSource.type === 'phone'
      ? localParticipant?.sessionId
        ? (roomMedia.phoneCameras.get(localParticipant.sessionId)?.video
            .track ?? null)
        : null
      : (roomMedia.local?.video.track ?? null)

  const remoteSessions = useMemo(
    () =>
      buildRemoteGridSessions({
        players,
        remoteParticipants: roomMedia.remotes,
        phoneCameras: roomMedia.phoneCameras,
        roomConnectionState: roomMedia.connectionState,
        mutedPlayers: effectiveMutedPlayers,
        now,
      }),
    [
      players,
      roomMedia.remotes,
      roomMedia.phoneCameras,
      roomMedia.connectionState,
      effectiveMutedPlayers,
      now,
    ],
  )

  // Calculate empty slots needed (total seatCount slots: 1 local + up to seatCount-1 remote)
  const maxRemoteSlots = roomSeatCount - 1
  const emptySlots = Math.max(0, maxRemoteSlots - players.length)

  return (
    <LazyMotion features={domAnimation}>
      <div className={`grid ${GRID_CLASS} h-full items-stretch gap-4`}>
        {/* Render local player with permission gate, loading state, or video */}
        {isCheckingPermissions ? (
          <div className="border-border-default bg-surface-2/50 flex h-full items-center justify-center rounded-lg border">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <div className="bg-brand/20 flex size-16 items-center justify-center rounded-full">
                  <Loader2 className="text-brand-muted-foreground size-8 animate-spin" />
                </div>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-text-secondary text-sm font-medium">
                  Checking Permissions
                </p>
                <p className="text-text-muted text-xs">Please wait...</p>
              </div>
            </div>
          </div>
        ) : needsPermissionDialog || permissionsBlocked ? (
          <div className="border-border-default bg-surface-2/50 h-full rounded-lg border">
            <MediaPermissionGate
              permissions={{ camera: true, microphone: true }}
              loadingFallback={
                <div className="flex flex-col items-center space-y-3">
                  <Loader2 className="text-brand-muted-foreground size-8 animate-spin" />
                  <p className="text-text-muted text-sm">
                    Requesting access...
                  </p>
                </div>
              }
            >
              {/* This renders after permissions are granted - triggers re-render */}
              <div />
            </MediaPermissionGate>
          </div>
        ) : isLocalStreamPending ? (
          <div className="border-border-default bg-surface-2/50 flex h-full items-center justify-center rounded-lg border">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <div className="bg-brand/20 flex size-16 items-center justify-center rounded-full">
                  <Loader2 className="text-brand-muted-foreground size-8 animate-spin" />
                </div>
                <div className="bg-brand/10 absolute inset-0 animate-ping rounded-full" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-text-secondary text-sm font-medium">
                  Initializing Camera
                </p>
                <p className="text-text-muted text-xs">
                  Starting video stream...
                </p>
              </div>
            </div>
          </div>
        ) : localStreamError ? (
          <div className="border-destructive/50 bg-surface-2/50 flex h-full items-center justify-center rounded-lg border">
            <div className="flex flex-col items-center space-y-4 px-6 py-8">
              <div className="relative">
                <div className="bg-destructive/20 ring-destructive/10 flex size-16 items-center justify-center rounded-full ring-4">
                  <AlertCircle className="text-destructive size-8" />
                </div>
              </div>
              <div className="space-y-2 text-center">
                <p className="text-text-secondary text-sm font-semibold">
                  Media Connection Error
                </p>
                <p className="text-text-muted max-w-md text-xs leading-relaxed">
                  {localStreamError.message ||
                    'Unable to start your media session. Please check your permissions and try again.'}
                </p>
              </div>
              <div className="text-text-muted flex flex-col gap-2 text-xs">
                <p className="flex items-center gap-1.5">
                  <span className="bg-surface-3 inline-block size-1 rounded-full" />
                  Check browser permissions
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="bg-surface-3 inline-block size-1 rounded-full" />
                  Ensure camera is not in use by another app
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="bg-surface-3 inline-block size-1 rounded-full" />
                  Try refreshing the page
                </p>
              </div>
            </div>
          </div>
        ) : (
          <LocalVideoCard
            videoTrack={effectiveLocalVideoTrack}
            isReconnecting={roomMedia.isReconnecting}
            roomId={roomId}
            participant={localParticipant}
            currentUser={localParticipant}
            participants={gameRoomParticipants}
            gridIndex={0}
          />
        )}

        {/* Render remote players */}
        {remoteSessions.map((player) => (
          <RemotePlayerCard
            key={player.id}
            playerId={player.id}
            playerName={player.name}
            participantData={player.participantData}
            remoteVideoTrack={player.remoteVideoTrack}
            remoteAudioTrack={player.remoteAudioTrack}
            remoteMediaStatus={player.remoteMediaStatus}
            peerMediaPresenceState={player.peerMediaPresenceState}
            isMuted={player.isMuted}
            roomId={roomId}
            localParticipant={localParticipant}
            gameRoomParticipants={gameRoomParticipants}
            isOnline={player.isOnline}
          />
        ))}

        {/* Empty slots for players who haven't joined yet */}
        {Array.from({
          length: emptySlots,
        }).map((_, index) => (
          <Card
            key={`empty-slot-${index}`}
            className="border-border-default bg-surface-1/50 flex h-full flex-col overflow-hidden border-dashed"
          >
            <div className="bg-surface-0/50 relative flex min-h-0 flex-1 items-center justify-center">
              <div className="space-y-4 text-center">
                <m.div className="bg-brand/10 relative mx-auto flex size-16 items-center justify-center rounded-full">
                  <m.div
                    className="bg-brand/20 absolute inset-0 rounded-full"
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  <m.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    <Gamepad2 className="text-brand-muted-foreground size-8" />
                  </m.div>
                </m.div>
                <div className="space-y-1">
                  <p className="text-text-muted text-sm font-medium">
                    Open seat
                  </p>
                  <p className="text-text-muted/60 text-xs">
                    Waiting for player...
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </LazyMotion>
  )
}

function VideoStreamGridLoading() {
  return (
    <div className="border-border-default bg-surface-2/50 flex h-full items-center justify-center rounded-lg border">
      <div className="flex flex-col items-center space-y-3">
        <div className="relative">
          <div className="bg-brand/20 flex size-16 items-center justify-center rounded-full">
            <Loader2 className="text-brand-muted-foreground size-8 animate-spin" />
          </div>
          <div className="bg-brand/10 absolute inset-0 animate-ping rounded-full" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-text-secondary text-sm font-medium">
            Loading Video Streams
          </p>
          <p className="text-text-muted text-xs">Connecting to players...</p>
        </div>
      </div>
    </div>
  )
}

export function VideoStreamGridWithSuspense(props: VideoStreamGridProps) {
  return (
    <Suspense fallback={<VideoStreamGridLoading />}>
      <VideoStreamGrid {...props} />
    </Suspense>
  )
}
