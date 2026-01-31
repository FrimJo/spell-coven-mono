import type { DetectorType } from '@/lib/detectors'
import { Suspense, useMemo, useRef, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { usePresence } from '@/contexts/PresenceContext'
import { useConvexWebRTC } from '@/hooks/useConvexWebRTC'
import { useVideoStreamAttachment } from '@/hooks/useVideoStreamAttachment'
import {
  AlertCircle,
  Loader2,
  MicOff,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'

import { LocalVideoCard } from './LocalVideoCard'
import { MediaPermissionGate } from './MediaPermissionGate'
import { PlayerStatsOverlay } from './PlayerStatsOverlay'
import {
  PlayerNameBadge,
  VideoDisabledPlaceholder,
} from './PlayerVideoCardParts'

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
}: VideoStreamGridProps) {
  // Get participants from context (already deduplicated)
  const {
    uniqueParticipants: gameRoomParticipants,
    isLoading: isPresenceLoading,
  } = usePresence()

  // Presence is ready when not loading (channel has been set up with correct key)
  const presenceReady = !isPresenceLoading

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

  const toggleAudio = (playerId: string) => {
    // For remote players, just update UI state
    setStreamStates((prev) => {
      const currentState = prev[playerId]
      if (!currentState) return prev
      return {
        ...prev,
        [playerId]: { ...currentState, audio: !currentState.audio },
      }
    })
  }

  // Always show 2x2 grid for 4 player slots
  const getGridClass = () => {
    return 'grid-cols-1 lg:grid-cols-2'
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
    <div className={`grid ${getGridClass()} h-full gap-4`}>
      {/* Render local player with permission gate, loading state, or video */}
      {isCheckingPermissions ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50">
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
              </div>
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-slate-200">
                Checking Permissions
              </p>
              <p className="text-xs text-slate-400">Please wait...</p>
            </div>
          </div>
        </div>
      ) : needsPermissionDialog || permissionsBlocked ? (
        <div className="h-full rounded-lg border border-slate-700 bg-slate-800/50">
          <MediaPermissionGate
            permissions={{ camera: true, microphone: true }}
            loadingFallback={
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                <p className="text-sm text-slate-400">Requesting access...</p>
              </div>
            }
          >
            {/* This renders after permissions are granted - triggers re-render */}
            <div />
          </MediaPermissionGate>
        </div>
      ) : isLocalStreamPending ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50">
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
              </div>
              <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/10" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-slate-200">
                Initializing Camera
              </p>
              <p className="text-xs text-slate-400">Starting video stream...</p>
            </div>
          </div>
        </div>
      ) : localStreamError ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-red-800/50 bg-slate-800/50">
          <div className="flex flex-col items-center space-y-4 px-6 py-8">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 ring-4 ring-red-500/10">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <p className="text-sm font-semibold text-slate-200">
                Camera Access Failed
              </p>
              <p className="max-w-md text-xs leading-relaxed text-slate-400">
                {localStreamError.message ||
                  'Unable to access your camera. Please check your permissions and try again.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs text-slate-500">
              <p className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-1 rounded-full bg-slate-500" />
                Check browser permissions
              </p>
              <p className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-1 rounded-full bg-slate-500" />
                Ensure camera is not in use by another app
              </p>
              <p className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-1 rounded-full bg-slate-500" />
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
        />
      )}

      {/* Render remote players */}
      {players.map((player) => {
        const state = streamStates[player.id] || { video: true, audio: true }
        const remoteStream = remoteStreams.get(player.id)
        const connectionState = connectionStates.get(player.id)
        const trackState = trackStates.get(player.id)

        // Remote players: use trackState which checks if track is 'live'
        const peerVideoEnabled = trackState?.videoEnabled ?? false
        const peerAudioEnabled = trackState?.audioEnabled ?? state.audio

        return (
          <Card
            key={player.id}
            className="flex flex-col overflow-hidden border-slate-800 bg-slate-900"
          >
            <div className="relative flex-1 bg-black">
              {/* Render video elements when enabled, placeholder when disabled */}
              {peerVideoEnabled ? (
                <>
                  {/* Remote player video element */}
                  {remoteStream && (
                    <video
                      ref={(element) => {
                        if (element) {
                          remoteVideoRefs.current.set(player.id, element)
                        } else {
                          remoteVideoRefs.current.delete(player.id)
                          attachedStreamsRef.current.delete(player.id)
                        }
                      }}
                      autoPlay
                      playsInline
                      muted={true}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        zIndex: 0,
                      }}
                      onLoadedMetadata={() => {
                        const videoElement = remoteVideoRefs.current.get(
                          player.id,
                        )
                        const trackState = trackStates.get(player.id)
                        const state = streamStates[player.id] || {
                          video: true,
                          audio: true,
                        }
                        const videoEnabled =
                          (trackState?.videoEnabled ?? state.video) &&
                          !!remoteStream

                        if (
                          videoElement &&
                          remoteStream &&
                          videoElement.paused &&
                          videoEnabled
                        ) {
                          // Use requestAnimationFrame to ensure element is ready
                          requestAnimationFrame(() => {
                            videoElement.play().catch((error) => {
                              // AbortError is expected if srcObject changes during play, ignore it
                              if (error.name !== 'AbortError') {
                                console.error(
                                  `[VideoStreamGrid] Failed to play after metadata loaded for ${player.id}:`,
                                  error,
                                )
                              }
                            })
                          })
                        }
                      }}
                      onCanPlay={() => {
                        // Fallback: ensure play when video can start playing
                        const videoElement = remoteVideoRefs.current.get(
                          player.id,
                        )
                        const trackState = trackStates.get(player.id)
                        const state = streamStates[player.id] || {
                          video: true,
                          audio: true,
                        }
                        const videoEnabled =
                          (trackState?.videoEnabled ?? state.video) &&
                          !!remoteStream

                        if (
                          videoElement &&
                          remoteStream &&
                          videoElement.paused &&
                          videoEnabled
                        ) {
                          requestAnimationFrame(() => {
                            videoElement.play().catch((error) => {
                              if (error.name !== 'AbortError') {
                                console.error(
                                  `[VideoStreamGrid] Failed to play on canPlay for ${player.id}:`,
                                  error,
                                )
                              }
                            })
                          })
                        }
                      }}
                      onError={(e) => {
                        console.error(
                          `[VideoStreamGrid] Video error for ${player.id}:`,
                          e,
                        )
                      }}
                    />
                  )}
                </>
              ) : (
                // Placeholder UI - Renders instead of video when disabled
                <VideoDisabledPlaceholder />
              )}

              {/* Player Info Badge */}
              <PlayerNameBadge>
                <span className="text-white">{player.name}</span>
              </PlayerNameBadge>

              {/* Stats Overlay */}
              {localParticipant && (
                <PlayerStatsOverlay
                  roomId={roomId}
                  participant={player.participantData}
                  currentUser={localParticipant}
                  participants={gameRoomParticipants}
                />
              )}

              {/* Audio/Video Status Indicators */}
              <div className="absolute right-3 top-3 z-10 flex gap-2">
                {!peerAudioEnabled && (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/20 backdrop-blur-sm">
                    <MicOff className="h-4 w-4 text-red-400" />
                  </div>
                )}
                {/* Connection status indicator for remote players */}
                {connectionState && (
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-sm ${
                      connectionState === 'connected'
                        ? 'border-green-500/30 bg-green-500/20'
                        : connectionState === 'connecting' ||
                            connectionState === 'reconnecting'
                          ? 'border-yellow-500/30 bg-yellow-500/20'
                          : connectionState === 'failed'
                            ? 'border-red-500/30 bg-red-500/20'
                            : 'border-slate-500/30 bg-slate-500/20'
                    }`}
                    title={`Connection: ${connectionState}`}
                  >
                    {connectionState === 'connected' ? (
                      <Wifi className="h-4 w-4 text-green-400" />
                    ) : connectionState === 'failed' ? (
                      <WifiOff className="h-4 w-4 text-red-400" />
                    ) : (
                      <Wifi className="h-4 w-4 text-yellow-400" />
                    )}
                  </div>
                )}
              </div>

              {/* Remote Audio Control */}
              <div className="absolute bottom-4 right-4 z-10">
                <Button
                  size="sm"
                  variant={peerAudioEnabled ? 'outline' : 'destructive'}
                  onClick={() => toggleAudio(player.id)}
                  className={`h-10 w-10 p-0 backdrop-blur-sm ${
                    peerAudioEnabled
                      ? 'border-slate-700 bg-slate-950/90 text-white hover:bg-slate-800'
                      : 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {peerAudioEnabled ? (
                    <Volume2 className="h-5 w-5" />
                  ) : (
                    <VolumeX className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )
      })}

      {/* Empty slots for players who haven't joined yet */}
      {Array.from({ length: emptySlots }).map((_, index) => (
        <Card
          key={`empty-slot-${index}`}
          className="flex flex-col overflow-hidden border-dashed border-slate-700 bg-slate-900/50"
        >
          <div className="relative flex flex-1 items-center justify-center bg-slate-950/50">
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
                <div className="h-8 w-8 rounded-full border-2 border-dashed border-slate-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500">Open Slot</p>
                <p className="text-xs text-slate-600">Waiting for player...</p>
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
    <div className="flex h-full items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50">
      <div className="flex flex-col items-center space-y-3">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
          <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/10" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-slate-200">
            Loading Video Streams
          </p>
          <p className="text-xs text-slate-400">Connecting to players...</p>
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
