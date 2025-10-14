import { useEffect, useState } from 'react'
import { useMediaStream } from '@/hooks/useMediaStream'
import {
  Camera,
  Maximize2,
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

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'

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
}

interface StreamState {
  video: boolean
  audio: boolean
}

export function VideoStreamGrid({
  players,
  localPlayerName,
  onLifeChange,
}: VideoStreamGridProps) {
  // Initialize media stream for local player
  const {
    videoRef: localVideoRef,
    toggleVideo: toggleLocalVideo,
    toggleAudio: toggleLocalAudio,
    isVideoEnabled: localVideoEnabled,
    isAudioEnabled: localAudioEnabled,
    isActive: localStreamActive,
    startStream,
    stopStream,
    getCameras,
  } = useMediaStream({
    autoStart: false,
    audio: true,
  })

  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>(
    [],
  )
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)

  const [streamStates, setStreamStates] = useState<Record<string, StreamState>>(
    players.reduce(
      (acc, player) => ({
        ...acc,
        [player.id]: { video: true, audio: true },
      }),
      {} as Record<string, StreamState>,
    ),
  )

  // Find local player
  const localPlayer = players.find((p) => p.name === localPlayerName)

  // Load available cameras when stream becomes active
  useEffect(() => {
    if (localStreamActive) {
      getCameras().then(setAvailableCameras)
    }
  }, [localStreamActive, getCameras])

  const switchCamera = async () => {
    if (availableCameras.length <= 1) return

    const nextIndex = (currentCameraIndex + 1) % availableCameras.length
    const nextCamera = availableCameras[nextIndex]

    if (nextCamera) {
      await startStream(nextCamera.deviceId)
      setCurrentCameraIndex(nextIndex)
    }
  }

  const toggleVideo = (playerId: string) => {
    // If it's the local player, use the actual media stream controls
    if (localPlayer && playerId === localPlayer.id) {
      toggleLocalVideo()
      return
    }

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

  const toggleAudio = (playerId: string) => {
    // If it's the local player, use the actual media stream controls
    if (localPlayer && playerId === localPlayer.id) {
      toggleLocalAudio()
      return
    }

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

        // For local player, use actual stream state
        const videoEnabled = isLocal ? localVideoEnabled : state.video
        const audioEnabled = isLocal ? localAudioEnabled : state.audio

        return (
          <Card
            key={player.id}
            className="flex flex-col overflow-hidden border-slate-800 bg-slate-900"
          >
            <div className="relative flex-1 bg-slate-950">
              {/* Video Stream Area - Always render video element for local player */}
              {isLocal && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    zIndex: 0,
                    display: videoEnabled && localStreamActive ? 'block' : 'none',
                  }}
                />
              )}
              
              {/* Placeholder UI */}
              {videoEnabled ? (
                <>
                  {!(isLocal && localStreamActive) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                      <div className="space-y-3 text-center">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/20">
                          <Camera className="h-10 w-10 text-purple-400" />
                        </div>
                        <p className="text-slate-400">
                          {isLocal
                            ? 'Your Table View'
                            : `${player.name}'s Table View`}
                        </p>
                        <p className="text-sm text-slate-500">
                          {isLocal
                            ? 'Click camera button to start'
                            : 'Camera feed of physical battlefield'}
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
                {!audioEnabled && (
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
                    size="sm"
                    variant={videoEnabled ? 'outline' : 'destructive'}
                    onClick={async () => {
                      if (!localStreamActive) {
                        await startStream()
                      } else {
                        toggleVideo(player.id)
                      }
                    }}
                    className={`h-10 w-10 p-0 ${
                      videoEnabled
                        ? 'border-slate-700 text-white hover:bg-slate-800'
                        : 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                    }`}
                  >
                    {videoEnabled ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <VideoOff className="h-5 w-5" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant={audioEnabled ? 'outline' : 'destructive'}
                    onClick={() => toggleAudio(player.id)}
                    className={`h-10 w-10 p-0 ${
                      audioEnabled
                        ? 'border-slate-700 text-white hover:bg-slate-800'
                        : 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                    }`}
                    disabled={!localStreamActive}
                  >
                    {audioEnabled ? (
                      <Mic className="h-5 w-5" />
                    ) : (
                      <MicOff className="h-5 w-5" />
                    )}
                  </Button>
                  <div className="mx-1 h-6 w-px bg-slate-700" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={switchCamera}
                    className="h-10 w-10 border-white bg-white p-0 text-black hover:bg-gray-100"
                    disabled={!localStreamActive || availableCameras.length <= 1}
                    title={
                      availableCameras.length > 1
                        ? `Switch camera (${availableCameras.length} available)`
                        : 'No other cameras available'
                    }
                  >
                    <SwitchCamera className="h-5 w-5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 w-10 border-white bg-white p-0 text-black hover:bg-gray-100"
                  >
                    <Maximize2 className="h-5 w-5" />
                  </Button>
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
                        : 'bg-red-600 hover:bg-red-700 text-white border-red-600'
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
