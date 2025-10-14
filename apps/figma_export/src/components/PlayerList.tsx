import React from 'react';
import { Crown, UserX, Heart } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';

interface Player {
  id: string;
  name: string;
  life: number;
  isActive: boolean;
}

interface PlayerListProps {
  players: Player[];
  isLobbyOwner: boolean;
  localPlayerName: string;
  onRemovePlayer: (playerId: string) => void;
}

export function PlayerList({ players, isLobbyOwner, localPlayerName, onRemovePlayer }: PlayerListProps) {
  return (
    <Card className="bg-slate-900 border-slate-800 p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Players</span>
          <span className="text-xs text-slate-500">{players.length}/4</span>
        </div>

        <div className="space-y-2">
          {players.map((player) => {
            const isLocal = player.name === localPlayerName;
            const isOwner = player.id === '1'; // First player is owner

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                  player.isActive 
                    ? 'bg-purple-500/10 border border-purple-500/30' 
                    : 'bg-slate-800/50 border border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    player.isActive ? 'bg-green-400 animate-pulse' : 'bg-slate-600'
                  }`} />
                  <span className="text-sm text-white truncate">
                    {player.name}
                  </span>
                  {isOwner && (
                    <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                  )}
                  {isLocal && (
                    <span className="text-xs px-1.5 py-0.5 bg-purple-500/30 text-purple-300 rounded flex-shrink-0">
                      You
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Heart className="w-3 h-3 text-red-400" />
                    <span>{player.life}</span>
                  </div>

                  {isLobbyOwner && !isLocal && !isOwner && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <UserX className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-800">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Remove Player</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            Are you sure you want to remove {player.name} from the game? They will need a new invite to rejoin.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onRemovePlayer(player.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
