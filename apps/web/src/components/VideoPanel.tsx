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
      <div className="relative aspect-video bg-surface-0">
        {/* Simulated Video Feed */}
        {videoEnabled ? (
          <div
            className="
              absolute inset-0 flex items-center justify-center bg-linear-to-br
              from-slate-800 to-slate-900
            "
          >
            <div className="space-y-2 text-center">
              <div
                className="
                  mx-auto flex size-16 items-center justify-center rounded-full
                  bg-brand/20
                "
              >
                <Camera className="size-8 text-brand-muted-foreground" />
              </div>
              <p className="text-sm text-text-muted">
                {isLocal ? 'Your Camera' : `${playerName}'s Camera`}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="
              absolute inset-0 flex items-center justify-center bg-surface-0
            "
          >
            <div className="space-y-2 text-center">
              <VideoOff className="mx-auto size-8 text-text-muted" />
              <p className="text-sm text-text-muted">Camera Off</p>
            </div>
          </div>
        )}

        {/* Player Name Badge */}
        <div
          className="
            absolute top-2 left-2 flex items-center gap-2 rounded-sm
            bg-surface-0/80 px-2 py-1 text-sm text-white backdrop-blur-sm
          "
        >
          {playerName}
          {isLocal && (
            <span
              className="
                rounded-sm bg-brand/30 px-1.5 py-0.5 text-xs
                text-brand-muted-foreground
              "
            >
              You
            </span>
          )}
        </div>

        {/* Audio Indicator */}
        {!audioEnabled && (
          <div className="absolute top-2 right-2">
            <div
              className="
                flex size-8 items-center justify-center rounded-full
                bg-destructive/20 backdrop-blur-sm
              "
            >
              <MicOff className="size-4 text-destructive" />
            </div>
          </div>
        )}

        {/* Controls */}
        {isLocal && (
          <div
            className="
              absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center
              gap-2
            "
          >
            <Button
              size="sm"
              variant={videoEnabled ? 'default' : 'destructive'}
              onClick={() => setVideoEnabled(!videoEnabled)}
              className="size-9 p-0"
            >
              {videoEnabled ? (
                <Video className="size-4" />
              ) : (
                <VideoOff className="size-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant={audioEnabled ? 'default' : 'destructive'}
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="size-9 p-0"
            >
              {audioEnabled ? (
                <Mic className="size-4" />
              ) : (
                <MicOff className="size-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="size-9 border-surface-3 p-0"
            >
              <Maximize2 className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
