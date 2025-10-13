interface GameState {
  gameId: string
  playerName: string
  timestamp: number
}

const GAME_STATE_KEY = 'spell-coven:game-state'

function validateGameState(data: unknown): GameState | null {
  if (!data || typeof data !== 'object') return null
  
  const state = data as Partial<GameState>
  
  if (!state.gameId || typeof state.gameId !== 'string') return null
  if (!state.playerName || typeof state.playerName !== 'string') return null
  if (!state.timestamp || typeof state.timestamp !== 'number') return null
  
  // Validate gameId format
  if (!/^game-[a-z0-9]{9}$/.test(state.gameId)) return null
  
  // Validate playerName length
  if (state.playerName.length < 1 || state.playerName.length > 50) return null
  
  // Validate timestamp (not in future, not older than 24 hours)
  const now = Date.now()
  if (state.timestamp > now || state.timestamp < now - 24 * 60 * 60 * 1000) {
    return null
  }
  
  return state as GameState
}

export const sessionStorage = {
  saveGameState(state: GameState): void {
    window.sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(state))
  },
  
  loadGameState(): GameState | null {
    const data = window.sessionStorage.getItem(GAME_STATE_KEY)
    if (!data) return null
    
    try {
      const parsed = JSON.parse(data)
      return validateGameState(parsed)
    } catch {
      return null
    }
  },
  
  clearGameState(): void {
    window.sessionStorage.removeItem(GAME_STATE_KEY)
  },
}
