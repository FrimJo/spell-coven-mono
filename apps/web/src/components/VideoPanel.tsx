import { useState } from 'react';
import { Video, VideoOff, Mic, MicOff, Maximize2, Camera } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { Card } from '@repo/ui/components/card';

interface VideoPanelProps {
  playerName: string;
  isLocal: boolean;
}

export function VideoPanel({ playerName, isLocal }: VideoPanelProps) {
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      <div className="relative aspect-video bg-slate-950">
        {/* Simulated Video Feed */}
        {videoEnabled ? (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
                <Camera className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-slate-400 text-sm">
                {isLocal ? 'Your Camera' : `${playerName}'s Camera`}
              </p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
            <div className="text-center space-y-2">
              <VideoOff className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-slate-600 text-sm">Camera Off</p>
            </div>
          </div>
        )}

        {/* Player Name Badge */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-slate-950/80 backdrop-blur-sm rounded text-sm text-white flex items-center gap-2">
          {playerName}
          {isLocal && (
            <span className="px-1.5 py-0.5 bg-purple-500/30 rounded-sm text-xs text-purple-300">
              You
            </span>
          )}
        </div>

        {/* Audio Indicator */}
        {!audioEnabled && (
          <div className="absolute top-2 right-2">
            <div className="w-8 h-8 bg-red-500/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <MicOff className="w-4 h-4 text-red-400" />
            </div>
          </div>
        )}

        {/* Controls */}
        {isLocal && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <Button
              size="sm"
              variant={videoEnabled ? "default" : "destructive"}
              onClick={() => setVideoEnabled(!videoEnabled)}
              className="w-9 h-9 p-0"
            >
              {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant={audioEnabled ? "default" : "destructive"}
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="w-9 h-9 p-0"
            >
              {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-9 h-9 p-0 border-slate-700"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
