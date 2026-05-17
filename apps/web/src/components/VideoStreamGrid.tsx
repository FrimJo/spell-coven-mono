import type { DetectorType } from '@/lib/detectors'
import type { MediaTrack, RemoteMediaParticipant } from '@/types/media-session'
import type { Participant } from '@/types/participant'
import {
  memo,
  Suspense,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { usePresence } from '@/contexts/PresenceContext'
import { useRoomMedia } from '@/contexts/RoomMediaContext'
import { useCardDetector } from '@/hooks/useCardDetector'
import {
  createSilentAudioStream,
  createSyntheticVideoStream,
} from '@/lib/mockMedia'
import { attachVideoStream } from '@/lib/video-stream-utils'
import { domAnimation, LazyMotion, m } from 'framer-motion'
import {
  AlertCircle,
  Gamepad2,
  Loader2,
  MicOff,
  Unplug,
  Wifi,
  WifiOff,
} from 'lucide-react'

import { Card } from '@repo/ui/components/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { LiveKitTrackElement } from './LiveKitTrackElement'
import { LocalVideoCard } from './LocalVideoCard'
import { MediaPermissionGate } from './MediaPermissionGate'
import { PlayerStatsOverlay } from './PlayerStatsOverlay'
import {
  CardDetectionOverlay,
  CroppedCanvas,
  FullResCanvas,
  PlayerNameBadge,
  VideoDisabledPlaceholder,
} from './PlayerVideoCardParts'

/**
 * Threshold for considering a player "online" (15 seconds)
 * If lastSeenAt is older than this, they're shown as disconnected.
 * This matches the threshold used in GameRoomSidebar.
 */
const ONLINE_THRESHOLD_MS = 15_000

// Extract inline styles to prevent recreation on every render
const VIDEO_ELEMENT_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  zIndex: 0,
}

// Memoized remote player component to prevent unnecessary re-renders
interface RemotePlayerCardProps {
  playerId: string
  playerName: string
  participantData: Participant
  remoteVideoTrack: MediaTrack | null
  remoteAudioTrack: MediaTrack | null
  connectionState: string | undefined
  peerVideoEnabled: boolean
  peerAudioEnabled: boolean
  isMuted: boolean
  roomId: string
  localParticipant: Participant | undefined
  gameRoomParticipants: Participant[]
  isOnline: boolean // Presence-based online status (matches sidebar)
  // Card detection props
  enableCardDetection: boolean
  detectorType?: DetectorType
  usePerspectiveWarp: boolean
  onCardCrop?: (canvas: HTMLCanvasElement) => void
}

const RemotePlayerCard = memo(function RemotePlayerCard({
  playerId,
  playerName,
  participantData,
  remoteVideoTrack,
  remoteAudioTrack,
  connectionState,
  peerVideoEnabled,
  peerAudioEnabled,
  isMuted,
  roomId,
  localParticipant,
  gameRoomParticipants,
  isOnline,
  enableCardDetection,
  detectorType,
  usePerspectiveWarp,
  onCardCrop,
}: RemotePlayerCardProps) {
  // Local video ref for card detection (separate from the shared remoteVideoRefs map)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Initialize card detector for this remote player's stream
  const { overlayRef, croppedRef, fullResRef } = useCardDetector({
    videoRef: videoRef,
    enableCardDetection:
      enableCardDetection && peerVideoEnabled && !!remoteVideoTrack,
    detectorType,
    usePerspectiveWarp,
    onCrop: onCardCrop,
    reinitializeTrigger: remoteVideoTrack ? 1 : 0,
  })

  // Combined ref handler - updates both local ref and shared map
  const handleVideoRef = (element: HTMLVideoElement | null) => {
    // Update local ref for card detector
    videoRef.current = element
  }

  const videoContainerRef = useRef<HTMLDivElement>(null)

  return (
    <Card
      className="flex h-full flex-col overflow-hidden border-surface-2 bg-surface-1"
      data-testid="remote-player-card"
      data-player-id={playerId}
      data-player-name={playerName}
    >
      <div ref={videoContainerRef} className="min-h-0 bg-black relative flex-1">
        {peerVideoEnabled ? (
          <>
            {remoteVideoTrack && (
              <LiveKitTrackElement
                testId="remote-player-video"
                kind="video"
                track={remoteVideoTrack}
                muted={isMuted}
                style={VIDEO_ELEMENT_STYLE}
                onVideoElement={handleVideoRef}
              />
            )}
            {peerAudioEnabled && remoteAudioTrack && (
              <LiveKitTrackElement
                kind="audio"
                track={remoteAudioTrack}
                muted={isMuted}
                testId="remote-player-audio"
              />
            )}
            {enableCardDetection && overlayRef && (
              <CardDetectionOverlay overlayRef={overlayRef} />
            )}
            {enableCardDetection && croppedRef && (
              <CroppedCanvas croppedRef={croppedRef} />
            )}
            {enableCardDetection && fullResRef && (
              <FullResCanvas fullResRef={fullResRef} />
            )}
          </>
        ) : (
          <div data-testid="remote-player-video-off">
            <VideoDisabledPlaceholder />
          </div>
        )}

        <PlayerNameBadge position="bottom-center">
          <span className="text-white">{playerName}</span>
        </PlayerNameBadge>

        {localParticipant && (
          <>
            <PlayerStatsOverlay
              roomId={roomId}
              participant={participantData}
              participants={gameRoomParticipants}
              currentUserId={localParticipant.id}
              videoContainerRef={videoContainerRef}
            />
          </>
        )}

        <div className="right-3 top-3 gap-2 absolute z-10 flex">
          {!peerAudioEnabled && (
            <div className="h-9 w-9 backdrop-blur-sm flex items-center justify-center rounded-lg border border-destructive/30 bg-destructive/20">
              <MicOff className="h-4 w-4 text-destructive" />
            </div>
          )}
          {/* Show presence-based connection status (matches sidebar) */}
          {!isOnline && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-9 w-9 backdrop-blur-sm flex items-center justify-center rounded-lg border border-warning/30 bg-warning/20"
                  data-testid="remote-player-offline-warning"
                >
                  <Unplug className="h-4 w-4 text-warning" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Disconnected</p>
              </TooltipContent>
            </Tooltip>
          )}
          {/* Show WebRTC connection issues only when presence is online but WebRTC has problems */}
          {isOnline && connectionState && connectionState !== 'connected' && (
            <div
              data-testid="remote-player-webrtc-warning"
              data-connection-state={connectionState}
              className={`h-9 w-9 backdrop-blur-sm flex items-center justify-center rounded-lg border ${
                connectionState === 'connecting' ||
                connectionState === 'reconnecting'
                  ? 'border-warning/30 bg-warning/20'
                  : connectionState === 'failed'
                    ? 'border-destructive/30 bg-destructive/20'
                    : 'border-default/30 bg-surface-3/20'
              }`}
              title={`Video connection: ${connectionState}`}
            >
              {connectionState === 'failed' ? (
                <WifiOff className="h-4 w-4 text-destructive" />
              ) : (
                <Wifi className="h-4 w-4 text-warning" />
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
})

// Extract video element style for test stream slot
const TEST_VIDEO_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  zIndex: 0,
}

/**
 * Test stream slot component - renders a synthetic video stream for development testing.
 * Uses the mock media functions to create an animated canvas stream with a test card image.
 */
interface TestStreamSlotProps {
  enableCardDetection: boolean
  detectorType?: DetectorType
  usePerspectiveWarp: boolean
  onCardCrop?: (canvas: HTMLCanvasElement) => void
}

const TestStreamSlot = memo(function TestStreamSlot({
  enableCardDetection,
  detectorType,
  usePerspectiveWarp,
  onCardCrop,
}: TestStreamSlotProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [testStream, setTestStream] = useState<MediaStream | null>(null)

  // Effect Event: create synthetic test stream (mount-only setup)
  const initTestStream = useEffectEvent((): MediaStream => {
    const videoStream = createSyntheticVideoStream()
    const audioStream = createSilentAudioStream()
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ])
    setTestStream(combinedStream)
    return combinedStream
  })

  // Create the test stream on mount
  useEffect(() => {
    const combinedStream = initTestStream()
    return () => {
      combinedStream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  // Attach stream to video element when ready
  useEffect(() => {
    const video = videoRef.current
    if (!video || !testStream) return

    attachVideoStream(video, testStream)
  }, [testStream])

  // Initialize card detector for the test stream
  const { overlayRef, croppedRef, fullResRef } = useCardDetector({
    videoRef: videoRef,
    enableCardDetection: enableCardDetection && !!testStream,
    detectorType,
    usePerspectiveWarp,
    onCrop: onCardCrop,
    reinitializeTrigger: testStream ? 1 : 0,
  })

  return (
    <Card className="flex h-full flex-col overflow-hidden border-surface-2 bg-surface-1">
      <div className="min-h-0 bg-black relative flex-1">
        {testStream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={TEST_VIDEO_STYLE}
            />
            {enableCardDetection && overlayRef && (
              <CardDetectionOverlay overlayRef={overlayRef} />
            )}
            {enableCardDetection && croppedRef && (
              <CroppedCanvas croppedRef={croppedRef} />
            )}
            {enableCardDetection && fullResRef && (
              <FullResCanvas fullResRef={fullResRef} />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-muted-foreground" />
          </div>
        )}

        <PlayerNameBadge position="bottom-center">
          <span className="text-white">Test Stream</span>
        </PlayerNameBadge>

        {/* Indicator that this is a test stream */}
        <div className="left-3 top-3 absolute z-10">
          <div className="gap-1.5 px-2 py-1 text-xs backdrop-blur-sm flex items-center rounded-lg border border-brand/30 bg-brand/20">
            <span className="text-brand-foreground">🧪 Test</span>
          </div>
        </div>
      </div>
    </Card>
  )
})

interface VideoStreamGridProps {
  // Room and user identification (for fetching participants)
  roomId: string
  userId: string
  localPlayerName: string
  // Card detection
  /** Detector type to use (opencv, detr, owl-vit) */
  detectorType?: DetectorType
  /** Enable perspective warp for corner refinement */
  usePerspectiveWarp?: boolean
  /** Callback when a card is cropped */
  onCardCrop?: (canvas: HTMLCanvasElement) => void
  /** Set of muted player IDs (controlled by parent) */
  mutedPlayers?: Set<string>
  /** Show a synthetic test stream in an empty slot (for development) */
  showTestStream?: boolean
}

interface StreamState {
  video: boolean
  audio: boolean
}

interface RemoteGridSession {
  id: string
  name: string
  participantData: Participant
  remoteVideoTrack: MediaTrack | null
  remoteAudioTrack: MediaTrack | null
  connectionState: string | undefined
  peerVideoEnabled: boolean
  peerAudioEnabled: boolean
  isMuted: boolean
  isOnline: boolean
}

function buildRemotePlayers(participants: Participant[], userId: string) {
  return participants
    .filter((participant) => participant.id !== userId)
    .map((participant) => ({
      id: participant.id,
      name: participant.username,
      participantData: participant,
    }))
}

function isParticipantOnline(lastSeenAt: number, now: number) {
  return now - lastSeenAt < ONLINE_THRESHOLD_MS
}

function resolvePeerMediaEnabled({
  presenceEnabled,
  trackEnabled,
  fallbackEnabled,
}: {
  presenceEnabled: boolean | undefined
  trackEnabled: boolean | undefined
  fallbackEnabled: boolean
}) {
  if (presenceEnabled === false) {
    return false
  }

  if (trackEnabled !== undefined) {
    return trackEnabled
  }

  return presenceEnabled ?? fallbackEnabled
}

function buildRemoteGridSessions({
  players,
  remoteParticipants,
  roomConnectionState,
  streamStates,
  mutedPlayers,
  now,
}: {
  players: Array<{
    id: string
    name: string
    participantData: Participant
  }>
  remoteParticipants: Map<string, RemoteMediaParticipant>
  roomConnectionState: string
  streamStates: Record<string, StreamState>
  mutedPlayers: Set<string>
  now: number
}): RemoteGridSession[] {
  return players.map((player) => {
    const fallbackState = streamStates[player.id] || {
      video: true,
      audio: true,
    }
    const remoteMedia = remoteParticipants.get(player.participantData.sessionId)

    return {
      id: player.id,
      name: player.name,
      participantData: player.participantData,
      remoteVideoTrack: remoteMedia?.video.track ?? null,
      remoteAudioTrack: remoteMedia?.audio.track ?? null,
      connectionState: remoteMedia ? 'connected' : roomConnectionState,
      peerVideoEnabled: resolvePeerMediaEnabled({
        presenceEnabled: player.participantData.videoEnabled,
        trackEnabled: remoteMedia?.video.enabled,
        fallbackEnabled: fallbackState.video,
      }),
      peerAudioEnabled: resolvePeerMediaEnabled({
        presenceEnabled: player.participantData.audioEnabled,
        trackEnabled: remoteMedia?.audio.enabled,
        fallbackEnabled: fallbackState.audio,
      }),
      isMuted: mutedPlayers.has(player.id),
      isOnline: isParticipantOnline(player.participantData.lastSeenAt, now),
    }
  })
}

export function VideoStreamGrid({
  roomId,
  userId,
  localPlayerName,
  detectorType,
  usePerspectiveWarp = true,
  onCardCrop,
  mutedPlayers,
  showTestStream = false,
}: VideoStreamGridProps) {
  const enableCardDetection = !!detectorType
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

  // --- Local Media Management (from context) ---
  // Note: Toggle functions are used directly in LocalVideoCard via useMediaStreams()
  const {
    video: videoResult,
    audio: audioResult,
    combinedStream: localStream,
    permissions: {
      isChecking: isCheckingPermissions,
      needsPermissionDialog,
      permissionsBlocked,
    },
  } = useMediaStreams()

  // Extract error and pending states for convenience
  const videoError = videoResult.error
  const audioError = audioResult.error
  const isVideoPending = videoResult.isPending
  const isAudioPending = audioResult.isPending

  // Local stream error and pending state
  const localStreamError = roomMedia.lastError ?? videoError ?? audioError
  const isLocalStreamPending =
    roomMedia.connectionState === 'connecting' ||
    isVideoPending ||
    isAudioPending

  const players = useMemo(
    () => buildRemotePlayers(gameRoomParticipants, userId),
    [gameRoomParticipants, userId],
  )

  const localParticipant = useMemo(
    () => gameRoomParticipants.find((p) => p.username === localPlayerName),
    [gameRoomParticipants, localPlayerName],
  )

  const streamStates = useMemo<Record<string, StreamState>>(
    () =>
      players.reduce(
        (acc, player) => ({
          ...acc,
          [player.id]: { video: true, audio: true },
        }),
        {},
      ),
    [players],
  )

  const remoteSessions = useMemo(
    () =>
      buildRemoteGridSessions({
        players,
        remoteParticipants: roomMedia.remotes,
        roomConnectionState: roomMedia.connectionState,
        streamStates,
        mutedPlayers: effectiveMutedPlayers,
        now,
      }),
    [
      players,
      roomMedia.remotes,
      roomMedia.connectionState,
      streamStates,
      effectiveMutedPlayers,
      now,
    ],
  )

  // Find local player (not currently used but may be needed for future features)
  // const localPlayer = players.find((p) => p.name === localPlayerName)

  // Always show 2x2 grid for 4 player slots
  const getGridClass = () => {
    return 'grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-2'
  }

  // Calculate empty slots needed (total seatCount slots: 1 local + up to seatCount-1 remote)
  const maxRemoteSlots = roomSeatCount - 1
  const emptySlots = Math.max(0, maxRemoteSlots - players.length)

  return (
    <LazyMotion features={domAnimation}>
      <div className={`grid ${getGridClass()} gap-4 h-full items-stretch`}>
        {/* Render local player with permission gate, loading state, or video */}
        {isCheckingPermissions ? (
          <div className="border-default flex h-full items-center justify-center rounded-lg border bg-surface-2/50">
            <div className="space-y-3 flex flex-col items-center">
              <div className="relative">
                <div className="h-16 w-16 flex items-center justify-center rounded-full bg-brand/20">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium text-text-secondary">
                  Checking Permissions
                </p>
                <p className="text-xs text-text-muted">Please wait...</p>
              </div>
            </div>
          </div>
        ) : needsPermissionDialog || permissionsBlocked ? (
          <div className="border-default h-full rounded-lg border bg-surface-2/50">
            <MediaPermissionGate
              permissions={{ camera: true, microphone: true }}
              loadingFallback={
                <div className="space-y-3 flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-muted-foreground" />
                  <p className="text-sm text-text-muted">
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
          <div className="border-default flex h-full items-center justify-center rounded-lg border bg-surface-2/50">
            <div className="space-y-3 flex flex-col items-center">
              <div className="relative">
                <div className="h-16 w-16 flex items-center justify-center rounded-full bg-brand/20">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-muted-foreground" />
                </div>
                <div className="inset-0 animate-ping absolute rounded-full bg-brand/10" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium text-text-secondary">
                  Initializing Camera
                </p>
                <p className="text-xs text-text-muted">
                  Starting video stream...
                </p>
              </div>
            </div>
          </div>
        ) : localStreamError ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-destructive/50 bg-surface-2/50">
            <div className="space-y-4 px-6 py-8 flex flex-col items-center">
              <div className="relative">
                <div className="h-16 w-16 flex items-center justify-center rounded-full bg-destructive/20 ring-4 ring-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <div className="space-y-2 text-center">
                <p className="text-sm font-semibold text-text-secondary">
                  Camera Access Failed
                </p>
                <p className="max-w-md text-xs leading-relaxed text-text-muted">
                  {localStreamError.message ||
                    'Unable to access your camera. Please check your permissions and try again.'}
                </p>
              </div>
              <div className="gap-2 text-xs flex flex-col text-text-muted">
                <p className="gap-1.5 flex items-center">
                  <span className="h-1 w-1 inline-block rounded-full bg-surface-3" />
                  Check browser permissions
                </p>
                <p className="gap-1.5 flex items-center">
                  <span className="h-1 w-1 inline-block rounded-full bg-surface-3" />
                  Ensure camera is not in use by another app
                </p>
                <p className="gap-1.5 flex items-center">
                  <span className="h-1 w-1 inline-block rounded-full bg-surface-3" />
                  Try refreshing the page
                </p>
              </div>
            </div>
          </div>
        ) : (
          <LocalVideoCard
            stream={localStream}
            videoTrack={roomMedia.local?.video.track ?? null}
            enableCardDetection={enableCardDetection}
            detectorType={detectorType}
            usePerspectiveWarp={usePerspectiveWarp}
            onCardCrop={onCardCrop}
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
            connectionState={player.connectionState}
            peerVideoEnabled={player.peerVideoEnabled}
            peerAudioEnabled={player.peerAudioEnabled}
            isMuted={player.isMuted}
            roomId={roomId}
            localParticipant={localParticipant}
            gameRoomParticipants={gameRoomParticipants}
            isOnline={player.isOnline}
            enableCardDetection={enableCardDetection}
            detectorType={detectorType}
            usePerspectiveWarp={usePerspectiveWarp}
            onCardCrop={onCardCrop}
          />
        ))}

        {/* Test stream slot - rendered when showTestStream is true and there are empty slots */}
        {showTestStream && emptySlots > 0 && (
          <TestStreamSlot
            key="test-stream-slot"
            enableCardDetection={enableCardDetection}
            detectorType={detectorType}
            usePerspectiveWarp={usePerspectiveWarp}
            onCardCrop={onCardCrop}
          />
        )}

        {/* Empty slots for players who haven't joined yet */}
        {Array.from({
          length: showTestStream ? emptySlots - 1 : emptySlots,
        }).map((_, index) => (
          <Card
            key={`empty-slot-${index}`}
            className="border-default flex h-full flex-col overflow-hidden border-dashed bg-surface-1/50"
          >
            <div className="min-h-0 relative flex flex-1 items-center justify-center bg-surface-0/50">
              <div className="space-y-4 text-center">
                <m.div className="h-16 w-16 relative mx-auto flex items-center justify-center rounded-full bg-brand/10">
                  <m.div
                    className="inset-0 absolute rounded-full bg-brand/20"
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
                    <Gamepad2 className="h-8 w-8 text-brand-muted-foreground" />
                  </m.div>
                </m.div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text-muted">
                    Open seat
                  </p>
                  <p className="text-xs text-text-muted/60">
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
    <div className="border-default flex h-full items-center justify-center rounded-lg border bg-surface-2/50">
      <div className="space-y-3 flex flex-col items-center">
        <div className="relative">
          <div className="h-16 w-16 flex items-center justify-center rounded-full bg-brand/20">
            <Loader2 className="h-8 w-8 animate-spin text-brand-muted-foreground" />
          </div>
          <div className="inset-0 animate-ping absolute rounded-full bg-brand/10" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-text-secondary">
            Loading Video Streams
          </p>
          <p className="text-xs text-text-muted">Connecting to players...</p>
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
