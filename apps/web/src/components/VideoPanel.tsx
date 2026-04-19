import { useState } from 'react'
import { Camera, Maximize2, Mic, MicOff, Video, VideoOff } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'

interface VideoPanelProps {
  playerName: string
  isLocal: boolean
}

export function VideoPanel({ playerName, isLocal }: VideoPanelProps) {
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)

  return (
    <Card className="overflow-hidden border-surface-2 bg-surface-1">
      <div className="aspect-video relative bg-surface-0">
        {/* Simulated Video Feed */}
        {videoEnabled ? (
          <div className="inset-0 from-slate-800 to-slate-900 absolute flex items-center justify-center bg-gradient-to-br">
            <div className="space-y-2 text-center">
              <div className="h-16 w-16 mx-auto flex items-center justify-center rounded-full bg-brand/20">
                <Camera className="h-8 w-8 text-brand-muted-foreground" />
              </div>
              <p className="text-sm text-text-muted">
                {isLocal ? 'Your Camera' : `${playerName}'s Camera`}
              </p>
            </div>
          </div>
        ) : (
          <div className="inset-0 absolute flex items-center justify-center bg-surface-0">
            <div className="space-y-2 text-center">
              <VideoOff className="h-8 w-8 mx-auto text-text-muted" />
              <p className="text-sm text-text-muted">Camera Off</p>
            </div>
          </div>
        )}

        {/* Player Name Badge */}
        <div className="left-2 top-2 gap-2 rounded px-2 py-1 text-sm text-white backdrop-blur-sm absolute flex items-center bg-surface-0/80">
          {playerName}
          {isLocal && (
            <span className="px-1.5 py-0.5 text-xs rounded-sm bg-brand/30 text-brand-muted-foreground">
              You
            </span>
          )}
        </div>

        {/* Audio Indicator */}
        {!audioEnabled && (
          <div className="right-2 top-2 absolute">
            <div className="h-8 w-8 backdrop-blur-sm flex items-center justify-center rounded-full bg-destructive/20">
              <MicOff className="h-4 w-4 text-destructive" />
            </div>
          </div>
        )}

        {/* Controls */}
        {isLocal && (
          <div className="bottom-2 gap-2 absolute left-1/2 flex -translate-x-1/2 items-center">
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
              className="h-9 w-9 p-0 border-surface-3"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
