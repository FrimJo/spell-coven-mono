import { useState } from 'react'
import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import {
  Camera,
  Maximize2,
  Mic,
  MicOff,
  Minus,
  Plus,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react'

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
  const [streamStates, setStreamStates] = useState<Record<string, StreamState>>(
    players.reduce(
      (acc, player) => ({
        ...acc,
        [player.id]: { video: true, audio: true },
      }),
      {} as Record<string, StreamState>,
    ),
  )

  const toggleVideo = (playerId: string) => {
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

        return (
          <Card
            key={player.id}
            className="flex flex-col overflow-hidden border-slate-800 bg-slate-900"
          >
            <div className="relative flex-1 bg-slate-950">
              {/* Video Stream Area */}
              {state.video ? (
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
                      Camera feed of physical battlefield
                    </p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                  <div className="space-y-2 text-center">
                    <VideoOff className="mx-auto h-12 w-12 text-slate-600" />
                    <p className="text-slate-600">Camera Off</p>
                  </div>
                </div>
              )}

              {/* Player Info Badge */}
              <div className="absolute left-3 top-3 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur-sm">
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
              <div className="absolute right-3 top-3 flex gap-2">
                {!state.audio && (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/20 backdrop-blur-sm">
                    <MicOff className="h-4 w-4 text-red-400" />
                  </div>
                )}
              </div>

              {/* Life Counter Controls (Local Player Only) */}
              {isLocal && (
                <div className="absolute bottom-4 left-4 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur-sm">
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
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur-sm">
                  <Button
                    size="sm"
                    variant={state.video ? 'default' : 'destructive'}
                    onClick={() => toggleVideo(player.id)}
                    className="h-10 w-10 p-0"
                  >
                    {state.video ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <VideoOff className="h-5 w-5" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant={state.audio ? 'default' : 'destructive'}
                    onClick={() => toggleAudio(player.id)}
                    className="h-10 w-10 p-0"
                  >
                    {state.audio ? (
                      <Mic className="h-5 w-5" />
                    ) : (
                      <MicOff className="h-5 w-5" />
                    )}
                  </Button>
                  <div className="mx-1 h-6 w-px bg-slate-700" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 w-10 border-slate-700 p-0"
                  >
                    <Maximize2 className="h-5 w-5" />
                  </Button>
                </div>
              )}

              {/* Remote Audio Control */}
              {!isLocal && (
                <div className="absolute bottom-4 right-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAudio(player.id)}
                    className="h-10 w-10 border-slate-700 bg-slate-950/90 p-0 backdrop-blur-sm"
                  >
                    {state.audio ? (
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
