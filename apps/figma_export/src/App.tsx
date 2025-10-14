import { useState } from 'react'

import { GameRoom } from './components/GameRoom'
import { LandingPage } from './components/LandingPage'

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string>('')
  const [isLobbyOwner, setIsLobbyOwner] = useState<boolean>(false)

  const handleCreateGame = (name: string) => {
    setPlayerName(name)
    setGameId(`game-${Math.random().toString(36).substr(2, 9)}`)
    setIsLobbyOwner(true)
  }

  const handleJoinGame = (name: string, id: string) => {
    setPlayerName(name)
    setGameId(id)
    setIsLobbyOwner(false)
  }

  const handleLeaveGame = () => {
    setGameId(null)
    setPlayerName('')
    setIsLobbyOwner(false)
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
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
  )
}
