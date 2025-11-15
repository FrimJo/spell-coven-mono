import type { DetectorType } from '@/lib/detectors'
import type { ConnectionState, PeerTrackState } from '@/types/peerjs'
import { useEffect, useRef, useState } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import {
  Camera,
  Mic,
  MicOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/popover'

interface Player {
  id: string
  name: string
}

interface VideoStreamGridProps {
  players: Player[]
  localPlayerName: string
  /** Enable card detection with green borders and click-to-crop */
  enableCardDetection?: boolean
  /** Detector type to use (opencv, detr, owl-vit) */
  detectorType?: DetectorType
  /** Enable perspective warp for corner refinement */
  usePerspectiveWarp?: boolean
  /** Callback when a card is cropped */
  onCardCrop?: (canvas: HTMLCanvasElement) => void
  /** Remote streams from WebRTC (player ID -> MediaStream) */
  remoteStreams?: Map<string, MediaStream | null>
  /** Connection states from WebRTC (player ID -> ConnectionState) */
  connectionStates?: Map<string, ConnectionState>
  /** Peer track states from PeerJS (player ID -> track state) */
  peerTrackStates?: Map<string, PeerTrackState>
  /** Callback when local video starts (for WebRTC integration) */
  onLocalVideoStart?: () => Promise<void>
  /** Callback when local video stops (for WebRTC integration) */
  onLocalVideoStop?: () => void
  /** Local stream for video/audio */
  localStream?: MediaStream | null
  /** Local track state (video/audio enabled) */
  localTrackState?: PeerTrackState
  /** Callback to toggle video track enabled/disabled (for WebRTC integration) */
  onToggleVideo?: (enabled: boolean) => void
  /** Callback to toggle audio track enabled/disabled (for WebRTC integration) */
  onToggleAudio?: (enabled: boolean) => void
  /** Callback to switch camera device */
  onSwitchCamera?: (deviceId: string) => Promise<void>
}

interface StreamState {
  video: boolean
  audio: boolean
}

export function VideoStreamGrid({
  players,
  localPlayerName,
  enableCardDetection = true, // Always enabled by default
  detectorType,
  usePerspectiveWarp = true,
  onCardCrop,
  remoteStreams = new Map(),
  connectionStates = new Map(),
  peerTrackStates = new Map(),
  onLocalVideoStart: _onLocalVideoStart,
  onLocalVideoStop: _onLocalVideoStop,
  localStream,
  localTrackState,
  onToggleVideo,
  onToggleAudio: _onToggleAudio,
  onSwitchCamera,
}: VideoStreamGridProps) {
  // State declarations first (needed before useWebcam hook)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>(
    [],
  )
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  const [currentCameraId, setCurrentCameraId] = useState<string | undefined>(
    undefined,
  )
  const [cameraPopoverOpen, setCameraPopoverOpen] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [hasStartedVideo, setHasStartedVideo] = useState(false)

  // Initialize webcam with card detection
  const { videoRef, overlayRef, croppedRef, fullResRef, getCameras } =
    useWebcam({
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

  // Load available cameras when local stream becomes available
  useEffect(() => {
    if (localStream && localStream.getVideoTracks().length > 0) {
      getCameras().then(setAvailableCameras)
    }
  }, [localStream, getCameras])

  // When localStream is available, mark video as started
  useEffect(() => {
    if (localStream && localStream.getVideoTracks().length > 0) {
      console.log(
        '[VideoStreamGrid] Local stream available, setting hasStartedVideo=true',
      )
      setHasStartedVideo(true)
    } else if (localStream && localStream.getVideoTracks().length === 0) {
      console.log('[VideoStreamGrid] Local stream has no video tracks')
    }
  }, [localStream])

  const selectCamera = async (deviceId: string) => {
    const cameraIndex = availableCameras.findIndex(
      (cam) => cam.deviceId === deviceId,
    )
    if (cameraIndex !== -1) {
      // Switch camera via the callback (managed by usePeerJS)
      if (onSwitchCamera) {
        try {
          await onSwitchCamera(deviceId)
          setCurrentCameraIndex(cameraIndex)
          setCurrentCameraId(deviceId)
          setHasStartedVideo(true)
          setCameraPopoverOpen(false)
        } catch (error) {
          console.error('[VideoStreamGrid] Failed to switch camera:', error)
        }
      }
    }
  }

  const toggleLocalAudio = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
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

  // Track which remote videos are actually playing
  const [playingRemoteVideos, setPlayingRemoteVideos] = useState<Set<string>>(
    new Set(),
  )

  // Track last known stream/track state to detect actual changes
  const lastStreamsRef = useRef<Map<string, MediaStream | null>>(new Map())
  const lastTrackStatesRef = useRef<Map<string, PeerTrackState>>(new Map())
  const pendingMountsRef = useRef<Set<string>>(new Set())
  const mountCheckTriggerRef = useRef(0)
  const [mountCheckTrigger, setMountCheckTrigger] = useState(0)

  // Update remote video elements when streams change or tracks change
  useEffect(() => {
    // Check if anything actually changed
    const streamsChanged =
      remoteStreams.size !== lastStreamsRef.current.size ||
      Array.from(remoteStreams.keys()).some(
        (id) => remoteStreams.get(id) !== lastStreamsRef.current.get(id),
      ) ||
      Array.from(lastStreamsRef.current.keys()).some(
        (id) => !remoteStreams.has(id),
      )

    const trackStatesChanged =
      peerTrackStates.size !== lastTrackStatesRef.current.size ||
      Array.from(peerTrackStates.keys()).some((id) => {
        const current = peerTrackStates.get(id)
        const last = lastTrackStatesRef.current.get(id)
        return (
          !last ||
          current?.videoEnabled !== last.videoEnabled ||
          current?.audioEnabled !== last.audioEnabled
        )
      })

    const hasPendingMounts = pendingMountsRef.current.size > 0

    // Only run if something actually changed or there are pending mounts
    if (!streamsChanged && !trackStatesChanged && !hasPendingMounts) {
      return
    }

    // Only log when something actually changed (not on every run)
    if (streamsChanged || trackStatesChanged || hasPendingMounts) {
      console.log('[VideoStreamGrid] Remote streams effect triggered:', {
        streamsChanged,
        trackStatesChanged,
        hasPendingMounts,
        pendingMounts: Array.from(pendingMountsRef.current),
      })
    }

    // Update refs
    lastStreamsRef.current = new Map(remoteStreams)
    lastTrackStatesRef.current = new Map(peerTrackStates)
    pendingMountsRef.current.clear()

    for (const [playerId, stream] of remoteStreams) {
      const videoElement = remoteVideoRefs.current.get(playerId)
      const currentAttachedStream = attachedStreamsRef.current.get(playerId)
      const trackState = peerTrackStates.get(playerId)

      if (!videoElement) {
        continue
      }

      if (!stream) {
        if (currentAttachedStream) {
          console.log(
            `[VideoStreamGrid] Clearing video element for ${playerId}`,
          )
          videoElement.srcObject = null
          attachedStreamsRef.current.set(playerId, null)
          setPlayingRemoteVideos((prev) => {
            const next = new Set(prev)
            next.delete(playerId)
            return next
          })
        }
        continue
      }

      // Check if video is actually enabled (track is live, not just present)
      // Use trackState first, then check actual track readyState as fallback
      const hasLiveVideoTrack =
        trackState?.videoEnabled ??
        stream.getVideoTracks().some((t) => t.readyState === 'live')

      // Check if the video element already has the correct srcObject
      const currentSrcObject = videoElement.srcObject as MediaStream | null

      // Determine if we need to update the video element
      const shouldHaveStream = hasLiveVideoTrack
      
      // Check if srcObject matches what it should be
      // If video should be playing, srcObject must be the stream
      // If video should NOT be playing, srcObject must be null
      const hasCorrectSrcObject = shouldHaveStream
        ? currentSrcObject === stream
        : currentSrcObject === null

      // Also check if attachedStreamsRef is out of sync
      const attachedStreamMatches = currentAttachedStream === stream

      // Only log and update if something actually needs to change
      if (!hasCorrectSrcObject || !attachedStreamMatches) {
        console.log(
          `[VideoStreamGrid] Video element update needed for ${playerId}:`,
          {
            hasLiveVideoTrack,
            shouldHaveStream,
            currentSrcObjectIsNull: currentSrcObject === null,
            currentSrcObjectMatches: currentSrcObject === stream,
            hasCorrectSrcObject,
            attachedStreamMatches,
          },
        )
        if (shouldHaveStream) {
          console.log(
            `[VideoStreamGrid] Attaching stream to video element for ${playerId}`,
          )
          
          // Clear first to ensure clean state
          if (currentSrcObject && currentSrcObject !== stream) {
            videoElement.srcObject = null
          }
          
          // Set the stream
          videoElement.srcObject = stream
          attachedStreamsRef.current.set(playerId, stream)

          // Force reload and play
          videoElement.load()
          videoElement.play().catch((error) => {
            if (error.name !== 'AbortError') {
              console.error(
                `[VideoStreamGrid] Failed to play video for ${playerId}:`,
                error,
              )
            }
          })

          setPlayingRemoteVideos((prev) => new Set(prev).add(playerId))
        } else {
          console.log(
            `[VideoStreamGrid] Clearing video element (no live track) for ${playerId}`,
          )
          videoElement.srcObject = null
          attachedStreamsRef.current.set(playerId, stream) // Keep stream ref for audio

          setPlayingRemoteVideos((prev) => {
            const next = new Set(prev)
            next.delete(playerId)
            return next
          })
        }
      }
    }
  }, [remoteStreams, peerTrackStates, mountCheckTrigger])

  return (
    <div className={`grid ${getGridClass()} h-full gap-4`}>
      {players.map((player) => {
        const isLocal = player.name === localPlayerName
        const state = streamStates[player.id] || { video: true, audio: true }
        const remoteStream = remoteStreams.get(player.id)
        const connectionState = connectionStates.get(player.id)
        const peerTrackState = peerTrackStates.get(player.id)

        // For local: check if started and enabled
        // For remote: use peerTrackState which checks if track is 'live', not just present
        const localVideoEnabled = localTrackState?.videoEnabled ?? true
        const hasVideoTrack = remoteStream
          ? remoteStream.getVideoTracks().length > 0
          : false
        const videoEnabled = isLocal
          ? hasStartedVideo && localVideoEnabled
          : (peerTrackState?.videoEnabled ?? hasVideoTrack)
        const audioEnabled = isLocal
          ? (localTrackState?.audioEnabled ?? true)
          : (peerTrackState?.audioEnabled ?? state.audio)

        // Check if remote video is actually playing (for hiding placeholder)
        const _isRemoteVideoPlaying =
          !isLocal && remoteStream && playingRemoteVideos.has(player.id)

        return (
          <Card
            key={player.id}
            className="flex flex-col overflow-hidden border-slate-800 bg-slate-900"
          >
            <div className="relative flex-1 bg-black">
              {/* Render video elements when enabled, placeholder when disabled */}
              {videoEnabled ? (
                <>
                  {/* Local player video */}
                  {isLocal && (
                    <>
                      <video
                        ref={(el) => {
                          if (el && localStream && el.srcObject !== localStream) {
                            el.srcObject = localStream
                          }
                          // Also keep videoRef for card detection
                          if (videoRef.current !== el) {
                            videoRef.current = el
                          }
                        }}
                        autoPlay
                        muted
                        playsInline
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          zIndex: 0,
                        }}
                      />
                      {/* Overlay canvas for card detection - renders green borders */}
                      {enableCardDetection && overlayRef && localStream && (
                        <canvas
                          ref={overlayRef}
                          width={1280}
                          height={720}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            cursor: 'pointer',
                            zIndex: 1,
                          }}
                        />
                      )}
                      {/* Hidden canvases for card detection processing */}
                      {enableCardDetection && croppedRef && (
                        <canvas
                          ref={croppedRef}
                          width={446}
                          height={620}
                          style={{ display: 'none' }}
                        />
                      )}
                      {enableCardDetection && fullResRef && (
                        <canvas
                          ref={fullResRef}
                          width={640}
                          height={480}
                          style={{ display: 'none' }}
                        />
                      )}
                    </>
                  )}

                  {/* Remote player video element */}
                  {!isLocal && remoteStream && (
                    <video
                      ref={(element) => {
                        if (element) {
                          remoteVideoRefs.current.set(player.id, element)
                          
                          // Check if stream needs to be attached
                          const trackState = peerTrackStates.get(player.id)
                          const hasLiveVideoTrack =
                            trackState?.videoEnabled ??
                            remoteStream.getVideoTracks().some((t) => t.readyState === 'live')
                          const currentSrcObject = element.srcObject as MediaStream | null
                          const currentAttached = attachedStreamsRef.current.get(player.id)
                          const needsAttachment = hasLiveVideoTrack && 
                            (currentSrcObject !== remoteStream || currentAttached !== remoteStream)
                          
                          // Only trigger mount check if stream needs to be attached
                          if (needsAttachment) {
                            pendingMountsRef.current.add(player.id)
                            // Defer state update to avoid infinite loop
                            requestAnimationFrame(() => {
                              mountCheckTriggerRef.current += 1
                              setMountCheckTrigger(mountCheckTriggerRef.current)
                            })
                          }
                        } else {
                          remoteVideoRefs.current.delete(player.id)
                          attachedStreamsRef.current.delete(player.id)
                          pendingMountsRef.current.delete(player.id)
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
                        const videoElement = remoteVideoRefs.current.get(player.id)
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
                        const videoElement = remoteVideoRefs.current.get(player.id)
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
                      onPlaying={() => {
                        // Direct handler to track when video actually starts playing
                        setPlayingRemoteVideos((prev) =>
                          new Set(prev).add(player.id),
                        )
                      }}
                      onPause={() => {
                        // Track when video pauses
                        setPlayingRemoteVideos((prev) => {
                          const next = new Set(prev)
                          next.delete(player.id)
                          return next
                        })
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
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                  <div className="space-y-2 text-center">
                    <VideoOff className="mx-auto h-12 w-12 text-slate-600" />
                    <p className="text-slate-600">Camera Off</p>
                  </div>
                </div>
              )}

              {/* Player Info Badge */}
              <div className="absolute left-3 top-3 z-10 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="text-white">{player.name}</span>
                  {isLocal && (
                    <span className="rounded bg-purple-500/30 px-1.5 py-0.5 text-xs text-purple-300">
                      You
                    </span>
                  )}
                </div>
              </div>

              {/* Audio/Video Status Indicators */}
              <div className="absolute right-3 top-3 z-10 flex gap-2">
                {((isLocal && isAudioMuted) || (!isLocal && !audioEnabled)) && (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/20 backdrop-blur-sm">
                    <MicOff className="h-4 w-4 text-red-400" />
                  </div>
                )}
                {/* Connection status indicator for remote players */}
                {!isLocal && connectionState && (
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

              {/* Media Controls Overlay - Always visible for local player */}
              {isLocal && (
                <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/95 px-3 py-2 shadow-lg backdrop-blur-sm">
                  <Button
                    data-testid="video-toggle-button"
                    size="sm"
                    variant={localVideoEnabled ? 'outline' : 'destructive'}
                    onClick={() => {
                      console.log('[VideoStreamGrid] Video button clicked', {
                        localVideoEnabled,
                        hasOnToggleVideo: !!onToggleVideo,
                      })
                      if (onToggleVideo) {
                        const newState = !localVideoEnabled
                        onToggleVideo(newState)
                      } else {
                        console.warn(
                          '[VideoStreamGrid] onToggleVideo not provided!',
                        )
                      }
                    }}
                    className={`h-10 w-10 p-0 ${
                      localVideoEnabled
                        ? 'border-slate-700 text-white hover:bg-slate-800'
                        : 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {localVideoEnabled ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <VideoOff className="h-5 w-5" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant={!isAudioMuted ? 'outline' : 'destructive'}
                    onClick={toggleLocalAudio}
                    className={`h-10 w-10 p-0 ${
                      !isAudioMuted
                        ? 'border-slate-700 text-white hover:bg-slate-800'
                        : 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                    }`}
                    disabled={!localStream}
                  >
                    {!isAudioMuted ? (
                      <Mic className="h-5 w-5" />
                    ) : (
                      <MicOff className="h-5 w-5" />
                    )}
                  </Button>
                  <div className="mx-1 h-6 w-px bg-slate-700" />
                  {/* Camera selection popover */}
                  <Popover
                    open={cameraPopoverOpen}
                    onOpenChange={setCameraPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 w-10 border-white bg-white p-0 text-black hover:bg-gray-100"
                        disabled={
                          !hasStartedVideo || availableCameras.length <= 1
                        }
                        title={
                          availableCameras.length > 1
                            ? `Switch camera (${availableCameras.length} available)`
                            : 'No other cameras available'
                        }
                      >
                        <SwitchCamera className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-80 border-slate-800 bg-slate-950/95 p-0 backdrop-blur-sm"
                      align="end"
                      sideOffset={8}
                    >
                      <div className="border-b border-slate-800 px-4 py-3">
                        <h3 className="text-sm font-semibold text-white">
                          Select Camera
                        </h3>
                        <p className="text-xs text-slate-400">
                          {availableCameras.length} camera
                          {availableCameras.length !== 1 ? 's' : ''} available
                        </p>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2">
                        {availableCameras.map((camera, index) => {
                          const isActive =
                            currentCameraId === camera.deviceId ||
                            (!currentCameraId && index === currentCameraIndex)
                          return (
                            <div
                              key={camera.deviceId}
                              onClick={() => selectCamera(camera.deviceId)}
                              className={
                                'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-slate-800/50 ' +
                                (isActive
                                  ? 'bg-purple-500/20 text-white'
                                  : 'text-slate-300')
                              }
                            >
                              <div
                                className={
                                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' +
                                  (isActive
                                    ? 'bg-purple-500/30'
                                    : 'bg-slate-800')
                                }
                              >
                                <Camera
                                  className={
                                    'h-4 w-4 ' +
                                    (isActive
                                      ? 'text-purple-400'
                                      : 'text-slate-400')
                                  }
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium">
                                  {camera.label || `Camera ${index + 1}`}
                                </div>
                                {isActive && (
                                  <div className="text-xs text-purple-400">
                                    Currently active
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Remote Audio Control */}
              {!isLocal && (
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
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
