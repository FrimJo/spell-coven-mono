import { useState } from 'react'
import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import { Camera, Maximize2, Mic, MicOff, Video, VideoOff } from 'lucide-react'

interface VideoPanelProps {
  playerName: string
  isLocal: boolean
}

export function VideoPanel({ playerName, isLocal }: VideoPanelProps) {
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900">
      <div className="relative aspect-video bg-slate-950">
        {/* Simulated Video Feed */}
        {videoEnabled ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
                <Camera className="h-8 w-8 text-purple-400" />
              </div>
              <p className="text-sm text-slate-400">
                {isLocal ? 'Your Camera' : `${playerName}'s Camera`}
              </p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
            <div className="space-y-2 text-center">
              <VideoOff className="mx-auto h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-600">Camera Off</p>
            </div>
          </div>
        )}

        {/* Player Name Badge */}
        <div className="absolute left-2 top-2 flex items-center gap-2 rounded bg-slate-950/80 px-2 py-1 text-sm text-white backdrop-blur-sm">
          {playerName}
          {isLocal && (
            <span className="rounded-sm bg-purple-500/30 px-1.5 py-0.5 text-xs text-purple-300">
              You
            </span>
          )}
        </div>

        {/* Audio Indicator */}
        {!audioEnabled && (
          <div className="absolute right-2 top-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 backdrop-blur-sm">
              <MicOff className="h-4 w-4 text-red-400" />
            </div>
          </div>
        )}

        {/* Controls */}
        {isLocal && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2">
            <Button
              size="sm"
              variant={videoEnabled ? 'default' : 'destructive'}
              onClick={() => setVideoEnabled(!videoEnabled)}
              className="h-9 w-9 p-0"
            >
              {videoEnabled ? (
                <Video className="h-4 w-4" />
              ) : (
                <VideoOff className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant={audioEnabled ? 'default' : 'destructive'}
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="h-9 w-9 p-0"
            >
              {audioEnabled ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 border-slate-700 p-0"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
