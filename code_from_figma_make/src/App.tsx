import React, { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { GameRoom } from './components/GameRoom';

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');

  const handleCreateGame = (name: string) => {
    setPlayerName(name);
    setGameId(`game-${Math.random().toString(36).substr(2, 9)}`);
  };

  const handleJoinGame = (name: string, id: string) => {
    setPlayerName(name);
    setGameId(id);
  };

  const handleLeaveGame = () => {
    setGameId(null);
    setPlayerName('');
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {!gameId ? (
        <LandingPage 
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
        />
      ) : (
        <GameRoom 
          gameId={gameId}
          playerName={playerName}
          onLeaveGame={handleLeaveGame}
        />
      )}
    </div>
  );
}
