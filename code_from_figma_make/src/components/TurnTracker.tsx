import React from 'react';
import { RotateCw, Play } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface Player {
  id: string;
  name: string;
  life: number;
  isActive: boolean;
}

interface TurnTrackerProps {
  players: Player[];
  onNextTurn: () => void;
}

export function TurnTracker({ players, onNextTurn }: TurnTrackerProps) {
  const activePlayer = players.find(p => p.isActive);

  return (
    <Card className="bg-slate-900 border-slate-800 p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-slate-400">
          <Play className="w-4 h-4" />
          <span className="text-sm">Current Turn</span>
        </div>

        <div className="text-center py-2">
          <div className="text-white mb-1">{activePlayer?.name}</div>
          <div className="text-xs text-slate-500">is playing</div>
        </div>

        <Button
          onClick={onNextTurn}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          size="sm"
        >
          <RotateCw className="w-4 h-4 mr-2" />
          Next Turn
        </Button>
      </div>
    </Card>
  );
}
