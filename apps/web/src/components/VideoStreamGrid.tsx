import type { DetectorType } from '@/lib/detectors'
import type { Participant } from '@/types/participant'
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { usePresence } from '@/contexts/PresenceContext'
import { useConvexWebRTC } from '@/hooks/useConvexWebRTC'
import { useVideoStreamAttachment } from '@/hooks/useVideoStreamAttachment'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  Gamepad2,
  Loader2,
  MicOff,
  Unplug,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'

import { Card } from '@repo/ui/components/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { CommanderOverlay } from './CommanderOverlay'
import { LocalVideoCard } from './LocalVideoCard'
import { MediaPermissionGate } from './MediaPermissionGate'
import { PlayerStatsOverlay } from './PlayerStatsOverlay'
import {
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
  remoteStream: MediaStream | undefined
  connectionState: string | undefined
  trackState: { videoEnabled: boolean; audioEnabled: boolean } | undefined
  streamState: { video: boolean; audio: boolean }
  remoteVideoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>
  attachedStreamsRef: React.MutableRefObject<Map<string, MediaStream | null>>
  trackStates: Map<string, { videoEnabled: boolean; audioEnabled: boolean }>
  streamStates: Record<string, { video: boolean; audio: boolean }>
  isMuted: boolean
  roomId: string
  localParticipant: Participant | undefined
  gameRoomParticipants: Participant[]
  gridIndex: number
  isOnline: boolean // Presence-based online status (matches sidebar)
}

const RemotePlayerCard = memo(function RemotePlayerCard({
  playerId,
  playerName,
  participantData,
  remoteStream,
  connectionState,
  trackState,
  streamState,
  remoteVideoRefs,
  attachedStreamsRef,
  trackStates,
  streamStates,
  isMuted,
  roomId,
  localParticipant,
  gameRoomParticipants,
  gridIndex,
  isOnline,
}: RemotePlayerCardProps) {
  // Remote players: use trackState which checks if track is 'live'
  const peerVideoEnabled = trackState?.videoEnabled ?? false
  const peerAudioEnabled = trackState?.audioEnabled ?? streamState.audio

  // These handlers use refs which are stable, so no need to memoize
  const handleVideoRef = (element: HTMLVideoElement | null) => {
    if (element) {
      remoteVideoRefs.current.set(playerId, element)
    } else {
      remoteVideoRefs.current.delete(playerId)
      attachedStreamsRef.current.delete(playerId)
    }
  }

  const handleLoadedMetadata = () => {
    const videoElement = remoteVideoRefs.current.get(playerId)
    const trackState = trackStates.get(playerId)
    const state = streamStates[playerId] || { video: true, audio: true }
    const videoEnabled =
      (trackState?.videoEnabled ?? state.video) && !!remoteStream

    if (videoElement && remoteStream && videoElement.paused && videoEnabled) {
      requestAnimationFrame(() => {
        videoElement.play().catch((error) => {
          if (error.name !== 'AbortError') {
            console.error(
              `[VideoStreamGrid] Failed to play after metadata loaded for ${playerId}:`,
              error,
            )
          }
        })
      })
    }
  }

  const handleCanPlay = () => {
    const videoElement = remoteVideoRefs.current.get(playerId)
    const trackState = trackStates.get(playerId)
    const state = streamStates[playerId] || { video: true, audio: true }
    const videoEnabled =
      (trackState?.videoEnabled ?? state.video) && !!remoteStream

    if (videoElement && remoteStream && videoElement.paused && videoEnabled) {
      requestAnimationFrame(() => {
        videoElement.play().catch((error) => {
          if (error.name !== 'AbortError') {
            console.error(
              `[VideoStreamGrid] Failed to play on canPlay for ${playerId}:`,
              error,
            )
          }
        })
      })
    }
  }

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error(`[VideoStreamGrid] Video error for ${playerId}:`, e)
  }

  return (
    <Card className="border-surface-2 bg-surface-1 flex h-full flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1 bg-black">
        {peerVideoEnabled ? (
          <>
            {remoteStream && (
              <video
                ref={handleVideoRef}
                autoPlay
                playsInline
                muted={isMuted}
                style={VIDEO_ELEMENT_STYLE}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={handleCanPlay}
                onError={handleVideoError}
              />
            )}
          </>
        ) : (
          <VideoDisabledPlaceholder />
        )}

        <PlayerNameBadge position="bottom-center">
          <span className="text-white">{playerName}</span>
        </PlayerNameBadge>

        {localParticipant && (
          <>
            <CommanderOverlay
              participant={participantData}
              currentUser={localParticipant}
              roomId={roomId}
              gridIndex={gridIndex}
            />
            <PlayerStatsOverlay
              roomId={roomId}
              participant={participantData}
              currentUser={localParticipant}
              participants={gameRoomParticipants}
            />
          </>
        )}

        <div className="absolute right-3 top-3 z-10 flex gap-2">
          {!peerAudioEnabled && (
            <div className="border-destructive/30 bg-destructive/20 flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-sm">
              <MicOff className="text-destructive h-4 w-4" />
            </div>
          )}
          {/* Show presence-based connection status (matches sidebar) */}
          {!isOnline && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="border-warning/30 bg-warning/20 flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-sm">
                  <Unplug className="text-warning h-4 w-4" />
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
              className={`flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-sm ${
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
                <WifiOff className="text-destructive h-4 w-4" />
              ) : (
                <Wifi className="text-warning h-4 w-4" />
              )}
            </div>
          )}
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
  /** Enable card detection with green borders and click-to-crop */
  enableCardDetection?: boolean
  /** Detector type to use (opencv, detr, owl-vit) */
  detectorType?: DetectorType
  /** Enable perspective warp for corner refinement */
  usePerspectiveWarp?: boolean
  /** Callback when a card is cropped */
  onCardCrop?: (canvas: HTMLCanvasElement) => void
  /** Set of muted player IDs (controlled by parent) */
  mutedPlayers?: Set<string>
}

interface StreamState {
  video: boolean
  audio: boolean
}

export function VideoStreamGrid({
  roomId,
  userId,
  localPlayerName,
  enableCardDetection = true, // Always enabled by default
  detectorType,
  usePerspectiveWarp = true,
  onCardCrop,
  mutedPlayers = new Set(),
}: VideoStreamGridProps) {
  // Get participants from context (already deduplicated)
  const {
    uniqueParticipants: gameRoomParticipants,
    isLoading: isPresenceLoading,
  } = usePresence()

  // Presence is ready when not loading (channel has been set up with correct key)
  const presenceReady = !isPresenceLoading

  // Current time state for computing online status (updates every 5 seconds)
  // This matches the logic in GameRoomSidebar to keep status synchronized
  const [now, setNow] = useState(Date.now())

  // Update current time periodically to re-evaluate online status
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 5_000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [])

  // Compute remote player IDs for WebRTC
  const remotePlayerIds = useMemo(() => {
    const filtered = gameRoomParticipants
      .filter((p) => p.id !== userId)
      .map((p) => p.id)
    console.log('[WebRTC:VideoStreamGrid] remotePlayerIds calculated:', {
      allParticipants: gameRoomParticipants.length,
      localUserId: userId,
      remotePlayerIds: filtered,
      gameRoomParticipants: gameRoomParticipants.map((p) => ({
        id: p.id,
        username: p.username,
      })),
    })
    return filtered
  }, [gameRoomParticipants, userId])

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

  // WebRTC hook for peer-to-peer video streaming
  // Wait for presence to be ready before initializing signaling
  // This ensures the channel is created with the correct presence key

  // WebRTC hook for peer connections using Convex signaling
  const {
    remoteStreams,
    connectionStates,
    trackStates,
    error: _webrtcError,
    isInitialized: _isInitialized,
  } = useConvexWebRTC({
    localPlayerId: userId,
    remotePlayerIds: remotePlayerIds,
    roomId: roomId,
    localStream, // Pass the managed local stream
    presenceReady, // Wait for presence before initializing signaling
    onError: (error: Error) => {
      console.error('[VideoStreamGrid] WebRTC error:', error)
      toast.error(error.message)
    },
  })

  // Debug: Log remote streams state
  // useEffect(() => {
  //   console.log('[VideoStreamGrid] 🎥 Remote streams update:', {
  //     size: remoteStreams.size,
  //     keys: Array.from(remoteStreams.keys()),
  //     gameRoomParticipants: gameRoomParticipants.map((p) => p.id),
  //     remotePlayerIds,
  //   })
  // }, [remoteStreams, gameRoomParticipants, remotePlayerIds])

  // Local stream error and pending state
  const localStreamError = videoError || audioError
  const isLocalStreamPending = isVideoPending || isAudioPending

  // Build remote player list
  const players = useMemo(() => {
    return gameRoomParticipants
      .filter((participant) => participant.username !== localPlayerName)
      .map((participant) => ({
        id: participant.id,
        name: participant.username,
        // Pass full participant object for stats
        participantData: participant,
      }))
  }, [gameRoomParticipants, localPlayerName])

  const localParticipant = useMemo(
    () => gameRoomParticipants.find((p) => p.username === localPlayerName),
    [gameRoomParticipants, localPlayerName],
  )

  const [streamStates, setStreamStates] = useState<Record<string, StreamState>>(
    players.reduce(
      (acc, player) => ({
        ...acc,
        [player.id]: { video: true, audio: true },
      }),
      {} as Record<string, StreamState>,
    ),
  )

  // Find local player (not currently used but may be needed for future features)
  // const localPlayer = players.find((p) => p.name === localPlayerName)

  // Always show 2x2 grid for 4 player slots
  const getGridClass = () => {
    return 'grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-2'
  }

  // Calculate empty slots needed (total 4 slots: 1 local + up to 3 remote)
  const maxRemoteSlots = 3
  const emptySlots = Math.max(0, maxRemoteSlots - players.length)

  // Store refs for remote video elements
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  // Track which streams are already attached to avoid unnecessary updates
  const attachedStreamsRef = useRef<Map<string, MediaStream | null>>(new Map())

  // Use custom hook to manage video stream attachments
  // This handles all the complex logic of attaching/detaching streams
  useVideoStreamAttachment({
    remoteStreams,
    trackStates,
    videoElementsRef: remoteVideoRefs,
    attachedStreamsRef,
  })

  return (
    <div className={`grid ${getGridClass()} h-full items-stretch gap-4`}>
      {/* Render local player with permission gate, loading state, or video */}
      {isCheckingPermissions ? (
        <div className="border-default bg-surface-2/50 flex h-full items-center justify-center rounded-lg border">
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="bg-brand/20 flex h-16 w-16 items-center justify-center rounded-full">
                <Loader2 className="text-brand-muted-foreground h-8 w-8 animate-spin" />
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
        <div className="border-default bg-surface-2/50 h-full rounded-lg border">
          <MediaPermissionGate
            permissions={{ camera: true, microphone: true }}
            loadingFallback={
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="text-brand-muted-foreground h-8 w-8 animate-spin" />
                <p className="text-text-muted text-sm">Requesting access...</p>
              </div>
            }
          >
            {/* This renders after permissions are granted - triggers re-render */}
            <div />
          </MediaPermissionGate>
        </div>
      ) : isLocalStreamPending ? (
        <div className="border-default bg-surface-2/50 flex h-full items-center justify-center rounded-lg border">
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="bg-brand/20 flex h-16 w-16 items-center justify-center rounded-full">
                <Loader2 className="text-brand-muted-foreground h-8 w-8 animate-spin" />
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
              <div className="bg-destructive/20 ring-destructive/10 flex h-16 w-16 items-center justify-center rounded-full ring-4">
                <AlertCircle className="text-destructive h-8 w-8" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <p className="text-text-secondary text-sm font-semibold">
                Camera Access Failed
              </p>
              <p className="text-text-muted max-w-md text-xs leading-relaxed">
                {localStreamError.message ||
                  'Unable to access your camera. Please check your permissions and try again.'}
              </p>
            </div>
            <div className="text-text-muted flex flex-col gap-2 text-xs">
              <p className="flex items-center gap-1.5">
                <span className="bg-surface-3 inline-block h-1 w-1 rounded-full" />
                Check browser permissions
              </p>
              <p className="flex items-center gap-1.5">
                <span className="bg-surface-3 inline-block h-1 w-1 rounded-full" />
                Ensure camera is not in use by another app
              </p>
              <p className="flex items-center gap-1.5">
                <span className="bg-surface-3 inline-block h-1 w-1 rounded-full" />
                Try refreshing the page
              </p>
            </div>
          </div>
        </div>
      ) : (
        <LocalVideoCard
          localPlayerName={localPlayerName}
          stream={localStream}
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
      {players.map((player, index) => {
        const state = streamStates[player.id] || { video: true, audio: true }
        const remoteStream = remoteStreams.get(player.id)
        const connectionState = connectionStates.get(player.id)
        const trackState = trackStates.get(player.id)
        const isMuted = mutedPlayers.has(player.id)
        // Calculate online status based on presence (matches sidebar logic)
        const isOnline =
          now - player.participantData.lastSeenAt < ONLINE_THRESHOLD_MS

        return (
          <RemotePlayerCard
            key={player.id}
            playerId={player.id}
            playerName={player.name}
            participantData={player.participantData}
            remoteStream={remoteStream}
            connectionState={connectionState}
            trackState={trackState}
            streamState={state}
            remoteVideoRefs={remoteVideoRefs}
            attachedStreamsRef={attachedStreamsRef}
            trackStates={trackStates}
            streamStates={streamStates}
            isMuted={isMuted}
            roomId={roomId}
            localParticipant={localParticipant}
            gameRoomParticipants={gameRoomParticipants}
            gridIndex={index + 1}
            isOnline={isOnline}
          />
        )
      })}

      {/* Empty slots for players who haven't joined yet */}
      {Array.from({ length: emptySlots }).map((_, index) => (
        <Card
          key={`empty-slot-${index}`}
          className="border-default bg-surface-1/50 flex h-full flex-col overflow-hidden border-dashed"
        >
          <div className="bg-surface-0/50 relative flex min-h-0 flex-1 items-center justify-center">
            <div className="space-y-4 text-center">
              <motion.div className="bg-brand/10 relative mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                <motion.div
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
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Gamepad2 className="text-brand-muted-foreground h-8 w-8" />
                </motion.div>
              </motion.div>
              <div className="space-y-1">
                <p className="text-text-muted text-sm font-medium">Open Slot</p>
                <p className="text-text-muted/60 text-xs">
                  Waiting for player...
                </p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function VideoStreamGridLoading() {
  return (
    <div className="border-default bg-surface-2/50 flex h-full items-center justify-center rounded-lg border">
      <div className="flex flex-col items-center space-y-3">
        <div className="relative">
          <div className="bg-brand/20 flex h-16 w-16 items-center justify-center rounded-full">
            <Loader2 className="text-brand-muted-foreground h-8 w-8 animate-spin" />
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
