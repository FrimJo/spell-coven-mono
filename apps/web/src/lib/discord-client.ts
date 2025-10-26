import { createClientOnlyFn } from '@tanstack/react-start'

import { DiscordOAuthClient } from '@repo/discord-integration/clients'

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
