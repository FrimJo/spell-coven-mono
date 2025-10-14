import React, { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { GameRoom } from './components/GameRoom';

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [isLobbyOwner, setIsLobbyOwner] = useState<boolean>(false);

  const handleCreateGame = (name: string) => {
    setPlayerName(name);
    setGameId(`game-${Math.random().toString(36).substr(2, 9)}`);
    setIsLobbyOwner(true);
  };

  const handleJoinGame = (name: string, id: string) => {
    setPlayerName(name);
    setGameId(id);
    setIsLobbyOwner(false);
  };

  const handleLeaveGame = () => {
    setGameId(null);
    setPlayerName('');
    setIsLobbyOwner(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground ">
      {!gameId ? (
        <LandingPage
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
        />
      ) : (
        <GameRoom
          gameId={gameId}
          playerName={playerName}
          isLobbyOwner={isLobbyOwner}
          onLeaveGame={handleLeaveGame}
        />
      )}
    </div>
  );
}
