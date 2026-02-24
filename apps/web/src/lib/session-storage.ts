import { GAME_ID_PATTERN } from './game-id'

interface GameState {
  gameId: string
  playerName: string
  timestamp: number
}

const GAME_STATE_KEY = 'spell-coven:game-state'

export interface CreatorInviteState {
  channelId: string
  roleId: string
  guildId: string
  creatorId: string
  token: string
  issuedAt: number
  expiresAt: number
  shareUrl: string
  deepLink: string
  maxSeats?: number
}

const CREATOR_INVITE_KEY = 'spell-coven:creator-invite'

function validateGameState(data: unknown): GameState | null {
  if (!data || typeof data !== 'object') return null

  const state = data as Partial<GameState>

  if (!state.gameId || typeof state.gameId !== 'string') return null
  if (!state.playerName || typeof state.playerName !== 'string') return null
  if (!state.timestamp || typeof state.timestamp !== 'number') return null

  if (!GAME_ID_PATTERN.test(state.gameId)) return null

  // Validate playerName length
  if (state.playerName.length < 1 || state.playerName.length > 50) return null

  // Validate timestamp (not in future, not older than 24 hours)
  const now = Date.now()
  if (state.timestamp > now || state.timestamp < now - 24 * 60 * 60 * 1000) {
    return null
  }

  return state as GameState
}

function validateCreatorInviteState(data: unknown): CreatorInviteState | null {
  if (!data || typeof data !== 'object') return null

  const invite = data as Partial<CreatorInviteState>

  const requiredStrings: Array<keyof CreatorInviteState> = [
    'channelId',
    'roleId',
    'guildId',
    'creatorId',
    'token',
    'shareUrl',
    'deepLink',
  ]

  for (const key of requiredStrings) {
    if (!invite[key] || typeof invite[key] !== 'string') {
      return null
    }
  }

  if (
    typeof invite.issuedAt !== 'number' ||
    typeof invite.expiresAt !== 'number'
  ) {
    return null
  }

  if (
    typeof invite.maxSeats !== 'undefined' &&
    (typeof invite.maxSeats !== 'number' || invite.maxSeats <= 0)
  ) {
    return null
  }

  try {
    // Validate that shareUrl is an absolute URL
    const parsedShareUrl = invite.shareUrl ? new URL(invite.shareUrl) : null
    if (!parsedShareUrl?.href) {
      return null
    }
    // Validate Discord deep link shape
    if (!invite.deepLink?.startsWith('https://discord.com/channels/')) {
      return null
    }
  } catch {
    return null
  }

  return invite as CreatorInviteState
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

  saveCreatorInviteState(state: CreatorInviteState): void {
    window.sessionStorage.setItem(CREATOR_INVITE_KEY, JSON.stringify(state))
  },

  loadCreatorInviteState(): CreatorInviteState | null {
    const data = window.sessionStorage.getItem(CREATOR_INVITE_KEY)
    if (!data) return null

    try {
      const parsed = JSON.parse(data)
      return validateCreatorInviteState(parsed)
    } catch {
      return null
    }
  },

  clearCreatorInviteState(): void {
    window.sessionStorage.removeItem(CREATOR_INVITE_KEY)
  },
}
