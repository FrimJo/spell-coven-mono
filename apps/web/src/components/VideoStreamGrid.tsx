import type { DetectorType } from '@/lib/detectors'
import type { ConnectionState, PeerTrackState } from '@/types/peerjs'
import { Suspense, useMemo, useRef, useState } from 'react'
import { useCardDetector } from '@/hooks/useCardDetector'
import { useGameRoomParticipants } from '@/hooks/useGameRoomParticipants'
import { useLocalVideoState } from '@/hooks/useLocalVideoState'
import { useMediaDevice } from '@/hooks/useMediaDevice'
import { useVideoStreamAttachment } from '@/hooks/useVideoStreamAttachment'
import { Loader2, MicOff, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'

import { PlayerVideoCard } from './PlayerVideoCard'
import {
  CardDetectionOverlay,
  CroppedCanvas,
  FullResCanvas,
  LocalMediaControls,
  LocalVideo,
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
  // WebRTC streams and states
  /** Remote streams from WebRTC (player ID -> MediaStream) */
  remoteStreams?: Map<string, MediaStream | null>
  /** Connection states from WebRTC (player ID -> ConnectionState) */
  connectionStates?: Map<string, ConnectionState>
  /** Peer track states from PeerJS (player ID -> track state) */
  peerTrackStates?: Map<string, PeerTrackState>
  // Callbacks
  /** Callback to toggle video track enabled/disabled (for WebRTC integration) */
  onToggleVideo?: (enabled: boolean) => Promise<void>
  /** Callback to toggle audio track enabled/disabled (for WebRTC integration) */
  onToggleAudio?: (enabled: boolean) => void
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
  remoteStreams = new Map(),
  connectionStates = new Map(),
  peerTrackStates = new Map(),
  onToggleVideo,
  onToggleAudio: _onToggleAudio,
}: VideoStreamGridProps) {
  // Fetch remote players (exclude local player)
  const { participants: gameRoomParticipants } = useGameRoomParticipants({
    roomId,
    userId,
    username: localPlayerName,
    enabled: true,
  })

  // Build remote player list
  const players = useMemo(() => {
    return gameRoomParticipants
      .filter((participant) => participant.username !== localPlayerName)
      .map((participant) => ({
        id: participant.id,
        name: participant.username,
      }))
  }, [gameRoomParticipants, localPlayerName])

  // State declarations first (needed before useWebcam hook)
  const [cameraPopoverOpen, setCameraPopoverOpen] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)

  // Create a ref for useMediaDevice to attach the stream
  // This is separate from useWebcam's videoRef which is for canvas-based processing
  const mediaDeviceVideoRef = useRef<HTMLVideoElement>(null)

  // Get available cameras via useMediaDevice hook
  // Pass videoRef so the stream is attached to the video element
  // autoStart: true - automatically start the camera stream when entering game room
  const { selectedDeviceId: currentCameraId } = useMediaDevice({
    kind: 'videoinput',
    videoRef: mediaDeviceVideoRef,
    autoStart: true,
  })

  // Manage local video state with synchronization across:
  // 1. UI button state (show enabled/disabled)
  // 2. Physical webcam track (enable/disable)
  // 3. Peer stream (send/don't send video to peers)
  // initialEnabled: true because useMediaDevice with autoStart: true starts the stream enabled
  const { videoEnabled, toggleVideo } = useLocalVideoState({
    videoRef: mediaDeviceVideoRef,
    onVideoStateChanged: async (enabled) => {
      if (onToggleVideo) {
        await onToggleVideo(enabled)
      }
    },
    initialEnabled: true,
  })

  // Initialize card detector
  // Uses currentCameraId from useMediaDevice to trigger re-initialization on camera switch
  const { overlayRef, croppedRef, fullResRef } = useCardDetector({
    videoRef: mediaDeviceVideoRef,
    enableCardDetection,
    detectorType,
    usePerspectiveWarp,
    onCrop: onCardCrop,
    reinitializeTrigger: currentCameraId ? 1 : 0,
  })

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

  const toggleLocalAudio = () => {
    if (mediaDeviceVideoRef.current && mediaDeviceVideoRef.current.srcObject) {
      const stream = mediaDeviceVideoRef.current.srcObject as MediaStream
      const audioTracks = stream.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsAudioMuted(!isAudioMuted)
    }
  }

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

  const getGridClass = () => {
    if (players.length === 1) return 'grid-cols-1'
    if (players.length === 2) return 'grid-cols-1 lg:grid-cols-2'
    return 'grid-cols-1 lg:grid-cols-2'
  }

  // Store refs for remote video elements
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  // Track which streams are already attached to avoid unnecessary updates
  const attachedStreamsRef = useRef<Map<string, MediaStream | null>>(new Map())

  // Use custom hook to manage video stream attachments
  // This handles all the complex logic of attaching/detaching streams
  useVideoStreamAttachment({
    remoteStreams,
    peerTrackStates,
    videoElementsRef: remoteVideoRefs,
    attachedStreamsRef,
  })

  return (
    <div className={`grid ${getGridClass()} h-full gap-4`}>
      {/* Render local player first */}
      <PlayerVideoCard>
        {videoEnabled ? (
          <>
            <LocalVideo videoRef={mediaDeviceVideoRef} />
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
          <VideoDisabledPlaceholder />
        )}

        {/* Player Info Badge */}
        <PlayerNameBadge>
          <span className="text-white">{localPlayerName}</span>
          <span className="rounded bg-purple-500/30 px-1.5 py-0.5 text-xs text-purple-300">
            You
          </span>
        </PlayerNameBadge>

        {/* Media Controls */}
        <LocalMediaControls
          videoEnabled={videoEnabled}
          isAudioMuted={isAudioMuted}
          cameraPopoverOpen={cameraPopoverOpen}
          onToggleVideo={toggleVideo}
          onToggleAudio={toggleLocalAudio}
          onCameraPopoverOpenChange={setCameraPopoverOpen}
        />
      </PlayerVideoCard>

      {/* Render remote players */}
      {players.map((player) => {
        const state = streamStates[player.id] || { video: true, audio: true }
        const remoteStream = remoteStreams.get(player.id)
        const connectionState = connectionStates.get(player.id)
        const peerTrackState = peerTrackStates.get(player.id)

        // Remote players: use peerTrackState which checks if track is 'live'
        const videoEnabled = peerTrackState?.videoEnabled ?? false
        const audioEnabled = peerTrackState?.audioEnabled ?? state.audio

        return (
          <Card
            key={player.id}
            className="flex flex-col overflow-hidden border-slate-800 bg-slate-900"
          >
            <div className="relative flex-1 bg-black">
              {/* Render video elements when enabled, placeholder when disabled */}
              {videoEnabled ? (
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
                        const peerTrackState = peerTrackStates.get(player.id)
                        const state = streamStates[player.id] || {
                          video: true,
                          audio: true,
                        }
                        const videoEnabled =
                          (peerTrackState?.videoEnabled ?? state.video) &&
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
                        const peerTrackState = peerTrackStates.get(player.id)
                        const state = streamStates[player.id] || {
                          video: true,
                          audio: true,
                        }
                        const videoEnabled =
                          (peerTrackState?.videoEnabled ?? state.video) &&
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

              {/* Audio/Video Status Indicators */}
              <div className="absolute right-3 top-3 z-10 flex gap-2">
                {!audioEnabled && (
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
                  variant={audioEnabled ? 'outline' : 'destructive'}
                  onClick={() => toggleAudio(player.id)}
                  className={`h-10 w-10 p-0 backdrop-blur-sm ${
                    audioEnabled
                      ? 'border-slate-700 bg-slate-950/90 text-white hover:bg-slate-800'
                      : 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {audioEnabled ? (
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
