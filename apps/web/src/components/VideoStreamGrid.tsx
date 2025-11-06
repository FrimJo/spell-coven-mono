import type { DetectorType } from '@/lib/detectors'
import type { PeerConnectionState } from '@/lib/webrtc/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import {
  Camera,
  Mic,
  MicOff,
  Minus,
  Plus,
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
  life: number
  isActive: boolean
}

interface VideoStreamGridProps {
  players: Player[]
  localPlayerName: string
  onLifeChange: (playerId: string, newLife: number) => void
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
  /** Connection states from WebRTC (player ID -> PeerConnectionState) */
  connectionStates?: Map<string, PeerConnectionState>
  /** Callback when local video starts (for WebRTC integration) */
  onLocalVideoStart?: () => Promise<void>
  /** Callback when local video stops (for WebRTC integration) */
  onLocalVideoStop?: () => void
}

interface StreamState {
  video: boolean
  audio: boolean
}

export function VideoStreamGrid({
  players,
  localPlayerName,
  onLifeChange,
  enableCardDetection = true, // Always enabled by default
  detectorType,
  usePerspectiveWarp = true,
  onCardCrop,
  remoteStreams = new Map(),
  connectionStates = new Map(),
  onLocalVideoStart,
  onLocalVideoStop,
}: VideoStreamGridProps) {
  // Initialize webcam with card detection
  const {
    videoRef,
    overlayRef,
    croppedRef,
    fullResRef,
    startVideo,
    stopVideo,
    getCameras,
    isVideoActive,
  } = useWebcam({
    enableCardDetection,
    detectorType,
    usePerspectiveWarp,
    onCrop: onCardCrop,
    autoStart: false,
  })

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

  // Debug logging for remote streams (only log when streams change, not on every render)
  const prevRemoteStreamsRef = useRef<string>('')
  const prevConnectionStatesRef = useRef<string>('')
  useEffect(() => {
    const remoteStreamsStr = JSON.stringify(
      Array.from(remoteStreams.entries()).map(([id, stream]) => [
        id,
        {
          hasStream: !!stream,
          trackCount: stream?.getTracks().length || 0,
        },
      ]),
    )
    const connectionStatesStr = JSON.stringify(
      Array.from(connectionStates.entries()),
    )

    // Only log if something actually changed
    if (
      remoteStreamsStr !== prevRemoteStreamsRef.current ||
      connectionStatesStr !== prevConnectionStatesRef.current
    ) {
      const remotePlayers = players.filter(
        (p) => p.name !== localPlayerName,
      )
      remotePlayers.forEach((player) => {
        const remoteStream = remoteStreams.get(player.id)
        const connectionState = connectionStates.get(player.id)
        console.log(`[VideoStreamGrid] Player ${player.name} (${player.id}):`, {
          hasRemoteStream: !!remoteStream,
          connectionState,
          remoteStreamTracks: remoteStream?.getTracks().length || 0,
          remoteStreamsSize: remoteStreams.size,
          remoteStreamsKeys: Array.from(remoteStreams.keys()),
        })
      })

      prevRemoteStreamsRef.current = remoteStreamsStr
      prevConnectionStatesRef.current = connectionStatesStr
    }
  }, [remoteStreams, connectionStates, players, localPlayerName])

  // Load available cameras when stream becomes active
  useEffect(() => {
    if (isVideoActive) {
      getCameras().then(setAvailableCameras)
    }
  }, [isVideoActive, getCameras])

  const selectCamera = async (deviceId: string) => {
    const cameraIndex = availableCameras.findIndex(
      (cam) => cam.deviceId === deviceId,
    )
    if (cameraIndex !== -1) {
      await startVideo(deviceId)
      setCurrentCameraIndex(cameraIndex)
      setCurrentCameraId(deviceId)
      setCameraPopoverOpen(false)
    }
  }

  const toggleVideo = (playerId: string) => {
    // For remote players, just update UI state
    setStreamStates((prev) => {
      const currentState = prev[playerId]
      if (!currentState) return prev
      return {
        ...prev,
        [playerId]: { ...currentState, video: !currentState.video },
      }
    })
  }

  // Suppress unused warning - function is available for future use
  void toggleVideo

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
  const [playingRemoteVideos, setPlayingRemoteVideos] = useState<Set<string>>(new Set())

  // Update remote video elements when streams change
  useEffect(() => {
    console.log('[VideoStreamGrid] Remote streams changed:', {
      streamCount: remoteStreams.size,
      playerIds: Array.from(remoteStreams.keys()),
      streams: Array.from(remoteStreams.entries()).map(([id, stream]) => ({
        playerId: id,
        hasStream: !!stream,
        streamId: stream?.id,
        videoTracks: stream?.getVideoTracks().length || 0,
      })),
    })
    
    const cleanupFunctions: Array<() => void> = []
    
    for (const [playerId, stream] of remoteStreams) {
      const videoElement = remoteVideoRefs.current.get(playerId)
      const currentAttachedStream = attachedStreamsRef.current.get(playerId)
      
      // Skip null/undefined streams - wait for actual stream
      if (!stream) {
        if (videoElement && currentAttachedStream) {
          // Clear existing stream if we received null
          console.log(`[VideoStreamGrid] Clearing stream for ${playerId} (received null stream)`)
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
      
      // Only update if stream has changed
      if (videoElement && stream !== currentAttachedStream) {
        console.log(`[VideoStreamGrid] Setting stream for ${playerId} on video element`, {
          currentStreamId: currentAttachedStream?.id,
          newStreamId: stream?.id,
          hasVideoTracks: stream.getVideoTracks().length > 0,
          hasAudioTracks: stream.getAudioTracks().length > 0,
        })
        videoElement.srcObject = stream
        attachedStreamsRef.current.set(playerId, stream)
        
        // Track when video starts playing to hide placeholder
        const handlePlaying = () => {
          console.log(`[VideoStreamGrid] Video started playing for ${playerId}`)
          setPlayingRemoteVideos((prev) => new Set(prev).add(playerId))
        }
        const handlePause = () => {
          console.log(`[VideoStreamGrid] Video paused for ${playerId}`)
          setPlayingRemoteVideos((prev) => {
            const next = new Set(prev)
            next.delete(playerId)
            return next
          })
        }
        
        videoElement.addEventListener('playing', handlePlaying)
        videoElement.addEventListener('pause', handlePause)
        
        // Check if already playing
        if (!videoElement.paused && videoElement.readyState >= 2) {
          handlePlaying()
        }
        
        cleanupFunctions.push(() => {
          videoElement.removeEventListener('playing', handlePlaying)
          videoElement.removeEventListener('pause', handlePause)
        })
        
        // Don't call play() here - let autoplay and onLoadedMetadata handle it
        // Calling play() here causes AbortError when srcObject is set multiple times
      } else if (videoElement && !stream) {
        if (currentAttachedStream) {
          console.log(`[VideoStreamGrid] Clearing stream for ${playerId}`)
          videoElement.srcObject = null
          attachedStreamsRef.current.set(playerId, null)
          setPlayingRemoteVideos((prev) => {
            const next = new Set(prev)
            next.delete(playerId)
            return next
          })
        }
      } else if (!videoElement && stream) {
        console.warn(`[VideoStreamGrid] Stream available for ${playerId} but video element not found yet`)
      }
    }
    
    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [remoteStreams])

  // Track previous ref states to only log actual changes
  const prevRefStatesRef = useRef<Map<string, boolean>>(new Map())
  
  // Store ref callbacks in a ref so they're truly stable across renders
  // This prevents React from seeing them as "new" functions and unmounting/remounting
  const refCallbacksRef = useRef<Map<string, (element: HTMLVideoElement | null) => void>>(new Map())
  
  // Ensure callbacks exist for all current players
  useEffect(() => {
    for (const player of players) {
      if (!refCallbacksRef.current.has(player.id)) {
        // Create callback once and store it in ref (never changes)
        refCallbacksRef.current.set(player.id, (element: HTMLVideoElement | null) => {
          const wasSet = prevRefStatesRef.current.get(player.id) ?? false
          const isSet = element !== null
          
          // Only log when ref state actually changes (null -> element or element -> null)
          if (isSet && !wasSet) {
            console.log(`[VideoStreamGrid] Video element ref set for ${player.id}`)
            prevRefStatesRef.current.set(player.id, true)
            remoteVideoRefs.current.set(player.id, element)
            // Don't set srcObject here - let useEffect handle it to avoid race conditions
            // The useEffect will set it properly when the stream is available
          } else if (!isSet && wasSet) {
            console.log(`[VideoStreamGrid] Video element ref cleared for ${player.id}`)
            prevRefStatesRef.current.set(player.id, false)
            remoteVideoRefs.current.delete(player.id)
            attachedStreamsRef.current.delete(player.id)
          } else if (isSet && wasSet) {
            // Element already set, just update the reference silently (no log spam)
            remoteVideoRefs.current.set(player.id, element)
          }
          // else: element already null and was null, do nothing
        })
      }
    }
    
    // Clean up callbacks for players that no longer exist
    const currentPlayerIds = new Set(players.map(p => p.id))
    for (const [playerId] of refCallbacksRef.current) {
      if (!currentPlayerIds.has(playerId)) {
        refCallbacksRef.current.delete(playerId)
        prevRefStatesRef.current.delete(playerId)
      }
    }
  }, [players])

  // Helper to get stable video ref callback for a player
  // This always returns the same function from the ref, ensuring React sees it as stable
  const getRemoteVideoRef = useCallback((playerId: string) => {
    // Get the stable callback from the ref (never changes)
    const callback = refCallbacksRef.current.get(playerId)
    if (!callback) {
      // Fallback: create a temporary callback if somehow missing (shouldn't happen)
      const tempCallback = (element: HTMLVideoElement | null) => {
        remoteVideoRefs.current.set(playerId, element as any)
      }
      refCallbacksRef.current.set(playerId, tempCallback)
      return tempCallback
    }
    return callback
  }, [])

  return (
    <div className={`grid ${getGridClass()} h-full gap-4`}>
      {players.map((player) => {
        const isLocal = player.name === localPlayerName
        const state = streamStates[player.id] || { video: true, audio: true }
        const remoteStream = remoteStreams.get(player.id)
        const connectionState = connectionStates.get(player.id)

        // For local player, video is always enabled (card detection mode)
        // For remote players, use UI state and check if stream is available
        const videoEnabled = isLocal ? true : state.video && !!remoteStream
        const audioEnabled = isLocal ? true : state.audio
        
        // Check if remote video is actually playing (for hiding placeholder)
        const isRemoteVideoPlaying = !isLocal && remoteStream && playingRemoteVideos.has(player.id)

        return (
          <Card
            key={player.id}
            className="flex flex-col overflow-hidden border-slate-800 bg-slate-900"
          >
            <div className="relative flex-1 bg-black">
              {/* Video Stream Area - Always render video element for local player */}
              {isLocal && (
                <>
                  <video
                    ref={videoRef}
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
                      display: isVideoActive ? 'block' : 'none',
                    }}
                  />
                  {/* Overlay canvas for card detection - renders green borders */}
                  {enableCardDetection && overlayRef && (
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
                        display: isVideoActive ? 'block' : 'none',
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
              {!isLocal && (
                <video
                  ref={getRemoteVideoRef(player.id)}
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
                    display: remoteStream ? 'block' : 'none',
                  }}
                  onLoadedMetadata={() => {
                    const videoElement = remoteVideoRefs.current.get(player.id)
                    if (videoElement && remoteStream && videoElement.paused) {
                      console.log(`[VideoStreamGrid] Video metadata loaded for ${player.id}, ensuring play`, {
                        paused: videoElement.paused,
                        readyState: videoElement.readyState,
                        hasSrcObject: !!videoElement.srcObject,
                        videoWidth: videoElement.videoWidth,
                        videoHeight: videoElement.videoHeight,
                      })
                      // Use requestAnimationFrame to ensure element is ready
                      requestAnimationFrame(() => {
                        videoElement.play().catch((error) => {
                          // AbortError is expected if srcObject changes during play, ignore it
                          if (error.name !== 'AbortError') {
                            console.error(`[VideoStreamGrid] Failed to play after metadata loaded for ${player.id}:`, error, {
                              name: error.name,
                              message: error.message,
                            })
                          } else {
                            console.log(`[VideoStreamGrid] Play was aborted for ${player.id} (expected if srcObject changed)`)
                          }
                        })
                      })
                    }
                  }}
                  onCanPlay={() => {
                    // Fallback: ensure play when video can start playing
                    const videoElement = remoteVideoRefs.current.get(player.id)
                    if (videoElement && remoteStream && videoElement.paused) {
                      console.log(`[VideoStreamGrid] Video can play for ${player.id}, ensuring playback`, {
                        paused: videoElement.paused,
                        readyState: videoElement.readyState,
                        hasSrcObject: !!videoElement.srcObject,
                      })
                      requestAnimationFrame(() => {
                        videoElement.play().catch((error) => {
                          if (error.name !== 'AbortError') {
                            console.error(`[VideoStreamGrid] Failed to play on canPlay for ${player.id}:`, error)
                          } else {
                            console.log(`[VideoStreamGrid] Play was aborted for ${player.id} (expected if srcObject changed)`)
                          }
                        })
                      })
                    }
                  }}
                  onPlaying={() => {
                    // Direct handler to track when video actually starts playing
                    console.log(`[VideoStreamGrid] Video playing event fired for ${player.id}`)
                    setPlayingRemoteVideos((prev) => new Set(prev).add(player.id))
                  }}
                  onPause={() => {
                    // Track when video pauses
                    console.log(`[VideoStreamGrid] Video paused event fired for ${player.id}`)
                    setPlayingRemoteVideos((prev) => {
                      const next = new Set(prev)
                      next.delete(player.id)
                      return next
                    })
                  }}
                  onError={(e) => {
                    const videoElement = remoteVideoRefs.current.get(player.id)
                    console.error(`[VideoStreamGrid] Video error for ${player.id}:`, {
                      error: e,
                      code: videoElement?.error?.code,
                      message: videoElement?.error?.message,
                      networkState: videoElement?.networkState,
                      readyState: videoElement?.readyState,
                    })
                  }}
                />
              )}

              {/* Placeholder UI */}
              {videoEnabled ? (
                <>
                  {/* Show placeholder for local player when video is not active */}
                  {isLocal && !isVideoActive && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                      <div className="space-y-3 text-center">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/20">
                          <Camera className="h-10 w-10 text-purple-400" />
                        </div>
                        <p className="text-slate-400">Your Table View</p>
                        <p className="text-sm text-slate-500">
                          Click camera button below to start video
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Show placeholder for remote player when stream exists but video is not playing yet */}
                  {!isLocal && remoteStream && !isRemoteVideoPlaying && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                      <div className="space-y-3 text-center">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/20">
                          <Camera className="h-10 w-10 text-purple-400" />
                        </div>
                        <p className="text-slate-400">{player.name}'s Table View</p>
                        <p className="text-sm text-slate-500">
                          Camera feed of physical battlefield
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
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
                  <div
                    className={`h-2 w-2 rounded-full ${player.isActive ? 'animate-pulse bg-green-400' : 'bg-slate-600'}`}
                  />
                  <span className="text-white">{player.name}</span>
                  {isLocal && (
                    <span className="rounded bg-purple-500/30 px-1.5 py-0.5 text-xs text-purple-300">
                      You
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Life: {player.life}
                  {player.isActive && ' • Active Turn'}
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

              {/* Life Counter Controls (Local Player Only) */}
              {isLocal && (
                <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur-sm">
                  <div className="mb-2 text-center">
                    <div className="text-2xl text-white">{player.life}</div>
                    <div className="text-xs text-slate-400">Life</div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onLifeChange(player.id, player.life - 1)}
                      className="h-8 w-8 border-red-500/30 p-0 text-red-400 hover:bg-red-500/10"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onLifeChange(player.id, player.life + 1)}
                      className="h-8 w-8 border-green-500/30 p-0 text-green-400 hover:bg-green-500/10"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Media Controls Overlay - Always visible for local player */}
              {isLocal && (
                <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur-sm shadow-lg">
                  <Button
                    data-testid="video-toggle-button"
                    size="sm"
                    variant={
                      isVideoActive || !hasStartedVideo
                        ? 'outline'
                        : 'destructive'
                    }
                    onClick={async () => {
                      if (!isVideoActive) {
                        await startVideo()
                        setHasStartedVideo(true)
                        // Also start WebRTC connections if callback provided
                        if (onLocalVideoStart) {
                          try {
                            await onLocalVideoStart()
                          } catch (error) {
                            console.error('[VideoStreamGrid] Failed to start WebRTC:', error)
                          }
                        }
                      } else {
                        stopVideo()
                        // Stop WebRTC connections if callback provided
                        if (onLocalVideoStop) {
                          onLocalVideoStop()
                        }
                      }
                    }}
                    className={`h-10 w-10 p-0 ${
                      isVideoActive || !hasStartedVideo
                        ? 'border-slate-700 text-white hover:bg-slate-800'
                        : 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {isVideoActive ? (
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
                    disabled={!isVideoActive}
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
                          !isVideoActive || availableCameras.length <= 1
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
                            <button
                              key={camera.deviceId}
                              onClick={() => selectCamera(camera.deviceId)}
                              className={
                                'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-slate-800/50 ' +
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
                            </button>
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
