import type { DetectorType } from '@/lib/detectors'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import { useVoiceChannelEvents } from '@/hooks/useVoiceChannelEvents'
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
} from 'lucide-react'

import { useServerFn } from '@tanstack/react-start'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/popover'

import { broadcastWebRTCSignal } from '@/server/handlers/webrtc-signaling.server'
import {
  parseWebRTCSignalEnvelope,
  type WebRTCSignalEnvelope,
  type WebRTCSignalPayload,
} from '@/types/webrtc'

interface Player {
  id: string
  name: string
  life: number
  isActive: boolean
}

interface VideoStreamGridProps {
  players: Player[]
  localPlayerName: string
  localPlayerId?: string
  gameId: string
  onLifeChange: (playerId: string, newLife: number) => void
  /** Enable card detection with green borders and click-to-crop */
  enableCardDetection?: boolean
  /** Detector type to use (opencv, detr, owl-vit) */
  detectorType?: DetectorType
  /** Enable perspective warp for corner refinement */
  usePerspectiveWarp?: boolean
  /** Callback when a card is cropped */
  onCardCrop?: (canvas: HTMLCanvasElement) => void
  /** JWT token for SSE connection reuse */
  voiceJwtToken?: string
}

interface StreamState {
  video: boolean
  audio: boolean
}

export function VideoStreamGrid({
  players,
  localPlayerName,
  localPlayerId,
  gameId,
  onLifeChange,
  enableCardDetection = true, // Always enabled by default
  detectorType,
  usePerspectiveWarp = true,
  onCardCrop,
  voiceJwtToken,
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

  const broadcastSignalFn = useServerFn(broadcastWebRTCSignal)
  const peersRef = useRef(new Map<string, RTCPeerConnection>())
  const pendingCandidatesRef = useRef(
    new Map<string, RTCIceCandidateInit[]>(),
  )
  const readyPeersRef = useRef(new Set<string>())
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    () => new Map(),
  )
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const readyStateRef = useRef(false)

  useEffect(() => {
    setStreamStates((prev) => {
      const next: Record<string, StreamState> = {}
      for (const player of players) {
        next[player.id] = prev[player.id] ?? { video: true, audio: true }
      }
      return next
    })
  }, [players])

  const setRemoteStream = useCallback(
    (peerId: string, stream: MediaStream | null) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev)
        if (stream) {
          next.set(peerId, stream)
        } else {
          next.delete(peerId)
        }
        return next
      })
    },
    [],
  )

  useEffect(() => {
    remoteStreams.forEach((stream, peerId) => {
      const videoEl = remoteVideoRefs.current[peerId]
      if (videoEl && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream
        videoEl.playsInline = true
        videoEl.autoplay = true
        void videoEl.play().catch((error) => {
          console.warn(
            '[VideoStreamGrid] Failed to play remote stream',
            error,
          )
        })
      }
    })

    for (const [peerId, element] of Object.entries(remoteVideoRefs.current)) {
      if (!remoteStreams.has(peerId) && element && element.srcObject) {
        element.srcObject = null
      }
    }
  }, [remoteStreams])

  useEffect(() => {
    for (const [peerId, element] of Object.entries(remoteVideoRefs.current)) {
      if (!element) continue
      const state = streamStates[peerId]
      if (state) {
        element.muted = !state.audio
      }
    }
  }, [streamStates])

  const handleRemoteVideoRef = useCallback(
    (playerId: string, element: HTMLVideoElement | null) => {
      if (!element) {
        delete remoteVideoRefs.current[playerId]
        return
      }

      remoteVideoRefs.current[playerId] = element

      const stream = remoteStreams.get(playerId)
      if (stream && element.srcObject !== stream) {
        element.srcObject = stream
        element.playsInline = true
        element.autoplay = true
        void element.play().catch((error) => {
          console.warn('[VideoStreamGrid] Failed to play remote stream', error)
        })
      }

      const state = streamStates[playerId]
      if (state) {
        element.muted = !state.audio
      }
    },
    [remoteStreams, streamStates],
  )

  const sendSignal = useCallback(
    async (targetUserId: string | null, signal: WebRTCSignalPayload) => {
      if (!localPlayerId) {
        return
      }

      try {
        await broadcastSignalFn({
          data: {
            gameId,
            fromUserId: localPlayerId,
            targetUserId,
            signal,
          } satisfies WebRTCSignalEnvelope,
        })
      } catch (error) {
        console.error('[VideoStreamGrid] Failed to send WebRTC signal', error)
      }
    },
    [broadcastSignalFn, gameId, localPlayerId],
  )

  const closePeerConnection = useCallback(
    (peerId: string) => {
      const connection = peersRef.current.get(peerId)
      if (connection) {
        try {
          connection.close()
        } catch (error) {
          console.warn(
            '[VideoStreamGrid] Error closing peer connection',
            error,
          )
        }
        peersRef.current.delete(peerId)
      }
      setRemoteStream(peerId, null)
      pendingCandidatesRef.current.delete(peerId)
      readyPeersRef.current.delete(peerId)
    },
    [setRemoteStream],
  )

  const resetPeerConnections = useCallback(() => {
    for (const peerId of peersRef.current.keys()) {
      closePeerConnection(peerId)
    }
  }, [closePeerConnection])

  const flushCandidateQueue = useCallback(
    async (peerId: string, connection: RTCPeerConnection) => {
      const queue = pendingCandidatesRef.current.get(peerId)
      if (!queue || queue.length === 0) {
        return
      }

      pendingCandidatesRef.current.delete(peerId)

      for (const candidateInit of queue) {
        try {
          const candidate = new RTCIceCandidate(candidateInit)
          await connection.addIceCandidate(candidate)
        } catch (error) {
          console.error(
            '[VideoStreamGrid] Failed to add queued ICE candidate',
            error,
          )
        }
      }
    },
    [],
  )

  const createPeerConnection = useCallback(
    (peerId: string) => {
      const existing = peersRef.current.get(peerId)
      if (existing) {
        return existing
      }

      const connection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })

      if (localStream) {
        for (const track of localStream.getTracks()) {
          connection.addTrack(track, localStream)
        }
      }

      connection.onicecandidate = (event) => {
        if (!event.candidate) {
          return
        }

        void sendSignal(peerId, {
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        })
      }

      connection.ontrack = (event) => {
        const [stream] = event.streams
        if (stream) {
          setRemoteStream(peerId, stream)
        }
      }

      connection.onconnectionstatechange = () => {
        if (
          connection.connectionState === 'failed' ||
          connection.connectionState === 'disconnected' ||
          connection.connectionState === 'closed'
        ) {
          closePeerConnection(peerId)
        }
      }

      peersRef.current.set(peerId, connection)
      return connection
    },
    [closePeerConnection, localStream, sendSignal, setRemoteStream],
  )

  const attemptOffer = useCallback(
    async (peerId: string) => {
      if (!localStream || !localPlayerId) {
        return
      }

      const connection = createPeerConnection(peerId)

      if (connection.signalingState !== 'stable') {
        return
      }

      try {
        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        await sendSignal(peerId, { type: 'offer', sdp: offer })
      } catch (error) {
        console.error('[VideoStreamGrid] Failed to create offer', error)
      }
    },
    [createPeerConnection, localPlayerId, localStream, sendSignal],
  )

  const handleSignal = useCallback(
    async (envelope: WebRTCSignalEnvelope) => {
      const { fromUserId, targetUserId, signal } = envelope

      if (!localPlayerId) {
        return
      }

      if (fromUserId === localPlayerId) {
        return
      }

      if (targetUserId && targetUserId !== localPlayerId) {
        return
      }

      switch (signal.type) {
        case 'leave': {
          closePeerConnection(fromUserId)
          return
        }
        case 'ready': {
          readyPeersRef.current.add(fromUserId)
          if (!localStream || !isVideoActive) {
            return
          }

          if (localPlayerId < fromUserId) {
            await attemptOffer(fromUserId)
          } else {
            createPeerConnection(fromUserId)
          }
          return
        }
        case 'offer': {
          readyPeersRef.current.add(fromUserId)
          if (!signal.sdp) {
            return
          }

          if (!localStream || !isVideoActive) {
            console.warn(
              '[VideoStreamGrid] Offer received without active local stream',
            )
            return
          }

          const connection = createPeerConnection(fromUserId)
          try {
            await connection.setRemoteDescription(
              new RTCSessionDescription(signal.sdp),
            )
            const answer = await connection.createAnswer()
            await connection.setLocalDescription(answer)
            await sendSignal(fromUserId, { type: 'answer', sdp: answer })
            await flushCandidateQueue(fromUserId, connection)
          } catch (error) {
            console.error('[VideoStreamGrid] Failed to handle offer', error)
          }
          return
        }
        case 'answer': {
          if (!signal.sdp) {
            return
          }

          const connection = peersRef.current.get(fromUserId)
          if (!connection) {
            return
          }

          try {
            await connection.setRemoteDescription(
              new RTCSessionDescription(signal.sdp),
            )
            await flushCandidateQueue(fromUserId, connection)
          } catch (error) {
            console.error('[VideoStreamGrid] Failed to handle answer', error)
          }
          return
        }
        case 'ice-candidate': {
          if (!signal.candidate) {
            return
          }

          const connection = createPeerConnection(fromUserId)

          if (connection.remoteDescription) {
            try {
              await connection.addIceCandidate(
                new RTCIceCandidate(signal.candidate),
              )
            } catch (error) {
              console.error(
                '[VideoStreamGrid] Failed to add ICE candidate',
                error,
              )
            }
          } else {
            const queue =
              pendingCandidatesRef.current.get(fromUserId) ?? []
            queue.push(signal.candidate)
            pendingCandidatesRef.current.set(fromUserId, queue)
          }
          return
        }
        default:
          return
      }
    },
    [
      attemptOffer,
      closePeerConnection,
      createPeerConnection,
      flushCandidateQueue,
      isVideoActive,
      localPlayerId,
      localStream,
      sendSignal,
    ],
  )

  useEffect(() => {
    peersRef.current.forEach((connection) => {
      const senders = connection.getSenders()

      if (!localStream) {
        senders.forEach((sender) => {
          if (sender.track) {
            sender.replaceTrack(null).catch((error) => {
              console.warn(
                '[VideoStreamGrid] Failed to clear sender track',
                error,
              )
            })
          }
        })
        return
      }

      for (const track of localStream.getTracks()) {
        const sender = senders.find((s) => s.track?.kind === track.kind)
        if (sender) {
          sender.replaceTrack(track).catch((error) => {
            console.warn(
              '[VideoStreamGrid] Failed to replace track on sender',
              error,
            )
          })
        } else {
          connection.addTrack(track, localStream)
        }
      }
    })
  }, [localStream])

  useEffect(() => {
    if (!localPlayerId) {
      return
    }

    const isStreaming = Boolean(localStream && isVideoActive)

    if (isStreaming && !readyStateRef.current) {
      readyStateRef.current = true
      void sendSignal(null, { type: 'ready' })
      readyPeersRef.current.forEach((peerId) => {
        if (localPlayerId < peerId) {
          void attemptOffer(peerId)
        }
      })
    } else if (!isStreaming && readyStateRef.current) {
      readyStateRef.current = false
      void sendSignal(null, { type: 'leave' })
      resetPeerConnections()
    }
  }, [attemptOffer, isVideoActive, localPlayerId, localStream, resetPeerConnections, sendSignal])

  useEffect(() => {
    return () => {
      resetPeerConnections()
      if (readyStateRef.current && localPlayerId) {
        readyStateRef.current = false
        void sendSignal(null, { type: 'leave' })
      }
    }
  }, [localPlayerId, resetPeerConnections, sendSignal])

  useEffect(() => {
    const playerIds = new Set(players.map((player) => player.id))
    peersRef.current.forEach((_, peerId) => {
      if (!playerIds.has(peerId)) {
        closePeerConnection(peerId)
      }
    })
  }, [closePeerConnection, players])

  useEffect(() => {
    if (isVideoActive && videoRef.current?.srcObject instanceof MediaStream) {
      setLocalStream(videoRef.current.srcObject)
    }

    if (!isVideoActive) {
      setLocalStream(null)
    }
  }, [isVideoActive])

  useVoiceChannelEvents({
    jwtToken: voiceJwtToken,
    onCustomEvent: (event) => {
      if (event.event !== 'webrtc.signal') {
        return
      }

      const parsed = parseWebRTCSignalEnvelope(event.payload)
      if (!parsed) {
        return
      }

      if (parsed.gameId !== gameId) {
        return
      }

      void handleSignal(parsed)
    },
  })

  // Find local player (not currently used but may be needed for future features)
  // const localPlayer = players.find((p) => p.name === localPlayerName)

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
      if (videoRef.current?.srcObject instanceof MediaStream) {
        setLocalStream(videoRef.current.srcObject)
      }
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

  return (
    <div className={`grid ${getGridClass()} h-full gap-4`}>
      {players.map((player) => {
        const isLocal = player.name === localPlayerName
        const state = streamStates[player.id] || { video: true, audio: true }

        const audioEnabled = isLocal ? !isAudioMuted : state.audio
        const remoteStream = remoteStreams.get(player.id) || null
        const remoteVideoActive = !isLocal && !!remoteStream && state.video
        const showCameraOff = !isLocal && !state.video
        const showPlaceholder =
          (isLocal && !isVideoActive) ||
          (!isLocal && state.video && !remoteVideoActive)

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

              {!isLocal && remoteVideoActive && (
                <video
                  ref={(element) => handleRemoteVideoRef(player.id, element)}
                  autoPlay
                  playsInline
                  muted={!audioEnabled}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}

              {/* Placeholder UI */}
              {showPlaceholder && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                  <div className="space-y-3 text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/20">
                      <Camera className="h-10 w-10 text-purple-400" />
                    </div>
                    <p className="text-slate-400">
                      {isLocal ? 'Your Table View' : `${player.name}'s Table View`}
                    </p>
                    <p className="text-sm text-slate-500">
                      {isLocal
                        ? 'Click camera button to start'
                        : 'Camera feed of physical battlefield'}
                    </p>
                  </div>
                </div>
              )}

              {showCameraOff && (
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

              {/* Media Controls Overlay */}
              {isLocal && (
                <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur-sm">
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
                        if (videoRef.current?.srcObject instanceof MediaStream) {
                          setLocalStream(videoRef.current.srcObject)
                        }
                        setHasStartedVideo(true)
                      } else {
                        stopVideo()
                        setLocalStream(null)
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
