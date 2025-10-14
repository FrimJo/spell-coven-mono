import React, { useState } from 'react';
import { Video, VideoOff, Mic, MicOff, Maximize2, Camera, Volume2, VolumeX, Plus, Minus } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface Player {
  id: string;
  name: string;
  life: number;
  isActive: boolean;
}

interface VideoStreamGridProps {
  players: Player[];
  localPlayerName: string;
  onLifeChange: (playerId: string, newLife: number) => void;
}

interface StreamState {
  video: boolean;
  audio: boolean;
}

export function VideoStreamGrid({ players, localPlayerName, onLifeChange }: VideoStreamGridProps) {
  const [streamStates, setStreamStates] = useState<Record<string, StreamState>>(
    players.reduce((acc, player) => ({
      ...acc,
      [player.id]: { video: true, audio: true }
    }), {})
  );

  const toggleVideo = (playerId: string) => {
    setStreamStates(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], video: !prev[playerId].video }
    }));
  };

  const toggleAudio = (playerId: string) => {
    setStreamStates(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], audio: !prev[playerId].audio }
    }));
  };

  const getGridClass = () => {
    if (players.length === 1) return 'grid-cols-1';
    if (players.length === 2) return 'grid-cols-1 lg:grid-cols-2';
    return 'grid-cols-1 lg:grid-cols-2';
  };

  return (
    <div className={`grid ${getGridClass()} gap-4 h-full`}>
      {players.map((player) => {
        const isLocal = player.name === localPlayerName;
        const state = streamStates[player.id] || { video: true, audio: true };

        return (
          <Card key={player.id} className="bg-slate-900 border-slate-800 overflow-hidden flex flex-col">
            <div className="relative flex-1 bg-slate-950">
              {/* Video Stream Area */}
              {state.video ? (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
                      <Camera className="w-10 h-10 text-purple-400" />
                    </div>
                    <p className="text-slate-400">
                      {isLocal ? 'Your Table View' : `${player.name}'s Table View`}
                    </p>
                    <p className="text-sm text-slate-500">
                      Camera feed of physical battlefield
                    </p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <VideoOff className="w-12 h-12 text-slate-600 mx-auto" />
                    <p className="text-slate-600">Camera Off</p>
                  </div>
                </div>
              )}

              {/* Player Info Badge */}
              <div className="absolute top-3 left-3 px-3 py-2 bg-slate-950/90 backdrop-blur-sm rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${player.isActive ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-white">{player.name}</span>
                  {isLocal && (
                    <span className="px-1.5 py-0.5 bg-purple-500/30 rounded text-xs text-purple-300">
                      You
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Life: {player.life}
                  {player.isActive && ' • Active Turn'}
                </div>
              </div>

              {/* Audio/Video Status Indicators */}
              <div className="absolute top-3 right-3 flex gap-2">
                {!state.audio && (
                  <div className="w-9 h-9 bg-red-500/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-red-500/30">
                    <MicOff className="w-4 h-4 text-red-400" />
                  </div>
                )}
              </div>

              {/* Life Counter Controls (Local Player Only) */}
              {isLocal && (
                <div className="absolute bottom-4 left-4 bg-slate-950/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-800">
                  <div className="text-center mb-2">
                    <div className="text-2xl text-white">{player.life}</div>
                    <div className="text-xs text-slate-400">Life</div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onLifeChange(player.id, player.life - 1)}
                      className="w-8 h-8 p-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onLifeChange(player.id, player.life + 1)}
                      className="w-8 h-8 p-0 border-green-500/30 text-green-400 hover:bg-green-500/10"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Media Controls Overlay */}
              {isLocal && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-950/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-800">
                  <Button
                    size="sm"
                    variant={state.video ? "default" : "destructive"}
                    onClick={() => toggleVideo(player.id)}
                    className="w-10 h-10 p-0"
                  >
                    {state.video ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </Button>
                  <Button
                    size="sm"
                    variant={state.audio ? "default" : "destructive"}
                    onClick={() => toggleAudio(player.id)}
                    className="w-10 h-10 p-0"
                  >
                    {state.audio ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </Button>
                  <div className="w-px h-6 bg-slate-700 mx-1" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-10 h-10 p-0 border-slate-700"
                  >
                    <Maximize2 className="w-5 h-5" />
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
                    className="w-10 h-10 p-0 border-slate-700 bg-slate-950/90 backdrop-blur-sm"
                  >
                    {state.audio ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
