import React from 'react';
import { Heart, Plus, Minus } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface Player {
  id: string;
  name: string;
  life: number;
  isActive: boolean;
}

interface PlayerStatsProps {
  player: Player;
  onLifeChange: (newLife: number) => void;
}

export function PlayerStats({ player, onLifeChange }: PlayerStatsProps) {
  const handleIncrement = (amount: number) => {
    onLifeChange(player.life + amount);
  };

  const handleDecrement = (amount: number) => {
    onLifeChange(Math.max(0, player.life - amount));
  };

  return (
    <Card className={`bg-slate-900 border-slate-800 p-4 transition-all ${
      player.isActive ? 'ring-2 ring-purple-500 border-purple-500' : ''
    }`}>
      <div className="space-y-3">
        {/* Player Name */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">{player.name}</span>
          {player.isActive && (
            <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
              Active
            </span>
          )}
        </div>

        {/* Life Total */}
        <div className="text-center py-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-red-400" />
            <span className="text-xs text-slate-400">LIFE</span>
          </div>
          <div className="text-4xl text-white">{player.life}</div>
        </div>

        {/* Life Adjustment Controls */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleIncrement(1)}
            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
          >
            <Plus className="w-4 h-4 mr-1" />
            1
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDecrement(1)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Minus className="w-4 h-4 mr-1" />
            1
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleIncrement(5)}
            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
          >
            <Plus className="w-4 h-4 mr-1" />
            5
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDecrement(5)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Minus className="w-4 h-4 mr-1" />
            5
          </Button>
        </div>
      </div>
    </Card>
  );
}
