import { createClientOnlyFn } from '@tanstack/react-start'

import type { DiscordToken } from '@repo/discord-integration/types'
import { DiscordOAuthClient } from '@repo/discord-integration/clients'
import { DiscordTokenSchema } from '@repo/discord-integration/types'
import { isTokenExpired } from '@repo/discord-integration/utils'

import {
  DISCORD_CLIENT_ID,
  DISCORD_REDIRECT_URI,
  DISCORD_SCOPES,
} from '../config/discord'

export const STORAGE_KEY = 'discord_token'

/**
 * Lazy-initialized Discord OAuth Client instance
 * Used across all hooks and components for Discord API interactions
 *
 * Uses createClientOnlyFn to ensure it only runs on the client where localStorage is available
 */
let _discordClient: DiscordOAuthClient | null = null

export const getDiscordClient = createClientOnlyFn((): DiscordOAuthClient => {
  if (!_discordClient) {
    _discordClient = new DiscordOAuthClient({
      clientId: DISCORD_CLIENT_ID,
      redirectUri: DISCORD_REDIRECT_URI,
      scopes: DISCORD_SCOPES,
      storage: localStorage,
    })
  }

  return _discordClient
})

const getStorage = createClientOnlyFn((): Storage => {
  return window.localStorage
})

export function getStoredDiscordToken(): DiscordToken | null {
  const storage = getStorage()
  if (!storage) return null

  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return DiscordTokenSchema.parse(JSON.parse(raw))
  } catch (error) {
    console.error('Failed to parse stored Discord token:', error)
    storage.removeItem(STORAGE_KEY)
    return null
  }
}

export function setStoredDiscordToken(token: DiscordToken): void {
  const storage = getStorage()
  storage.setItem(STORAGE_KEY, JSON.stringify(token))
}

export function clearStoredDiscordToken(): void {
  const storage = getStorage()
  storage.removeItem(STORAGE_KEY)
}

export async function refreshDiscordToken(
  refreshToken: string,
): Promise<DiscordToken> {
  const client = getDiscordClient()
  const newToken = await client.refreshToken(refreshToken)

  setStoredDiscordToken(newToken)

  return newToken
}

export async function ensureValidDiscordToken(): Promise<DiscordToken | null> {
  const token = getStoredDiscordToken()
  if (!token) return null

  if (!isTokenExpired(token, 0)) {
    return token
  }

  try {
    return await refreshDiscordToken(token.refreshToken)
  } catch (error) {
    console.error('Failed to refresh Discord token:', error)
    clearStoredDiscordToken()
    return null
  }
}

export interface AuthContext {
  accessToken: string
  userId: string
}

export async function requireDiscordAuth(
  onUnauthenticated: () => never,
): Promise<AuthContext> {
  const token = await ensureValidDiscordToken()

  if (!token) {
    return onUnauthenticated()
  }

  const client = getDiscordClient()
  const user = await client.fetchUser(token.accessToken)

  return {
    accessToken: token.accessToken,
    userId: user.id,
  }
}
