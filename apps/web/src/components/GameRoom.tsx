import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, Users, Settings } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { VideoPanel } from './VideoPanel';
import { GameBoard } from './GameBoard';
import { PlayerStats } from './PlayerStats';
import { TurnTracker } from './TurnTracker';
import { CardScanner } from './CardScanner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@repo/ui/components/tooltip';
import { toast } from 'sonner';
import { Toaster } from '@repo/ui/components/sonner';

interface GameRoomProps {
  gameId: string;
  playerName: string;
  onLeaveGame: () => void;
}

interface Player {
  id: string;
  name: string;
  life: number;
  isActive: boolean;
}

export function GameRoom({ gameId, playerName, onLeaveGame }: GameRoomProps) {
  const [copied, setCopied] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: playerName, life: 20, isActive: true },
    { id: '2', name: 'Opponent', life: 20, isActive: false },
  ]);

  const handleCopyGameId = () => {
    navigator.clipboard.writeText(gameId);
    setCopied(true);
    toast.success('Game ID copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLifeChange = (playerId: string, newLife: number) => {
    setPlayers(players.map(p => 
      p.id === playerId ? { ...p, life: newLife } : p
    ));
  };

  const handleNextTurn = () => {
    const currentIndex = players.findIndex(p => p.isActive);
    const nextIndex = (currentIndex + 1) % players.length;
    setPlayers(players.map((p, i) => ({
      ...p,
      isActive: i === nextIndex
    })));
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <Toaster />
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLeaveGame}
                    className="text-slate-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Leave
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Leave game room</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-6 w-px bg-slate-700" />

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Game ID:</span>
              <code className="px-2 py-1 bg-slate-800 text-purple-400 rounded text-sm">
                {gameId}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyGameId}
                className="text-slate-400 hover:text-white"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScanner(!showScanner)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {showScanner ? 'Hide Scanner' : 'Scan Card'}
            </Button>
            
            <div className="flex items-center gap-2 text-slate-400">
              <Users className="w-4 h-4" />
              <span className="text-sm">{players.length} Players</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-4 p-4">
          {/* Left Sidebar - Player Stats */}
          <div className="col-span-12 lg:col-span-2 space-y-4 overflow-y-auto">
            <TurnTracker 
              players={players}
              onNextTurn={handleNextTurn}
            />
            {players.map(player => (
              <PlayerStats
                key={player.id}
                player={player}
                onLifeChange={(newLife) => handleLifeChange(player.id, newLife)}
              />
            ))}
          </div>

          {/* Center - Game Board */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-4 overflow-hidden">
            {showScanner && (
              <CardScanner onClose={() => setShowScanner(false)} />
            )}
            <GameBoard />
          </div>

          {/* Right Sidebar - Video Panels */}
          <div className="col-span-12 lg:col-span-3 space-y-4 overflow-y-auto">
            {players.map(player => (
              <VideoPanel
                key={player.id}
                playerName={player.name}
                isLocal={player.name === playerName}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
