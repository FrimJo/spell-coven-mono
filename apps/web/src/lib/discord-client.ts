import { DiscordOAuthClient } from '@repo/discord-integration/clients'

import {
  DISCORD_CLIENT_ID,
  DISCORD_REDIRECT_URI,
  DISCORD_SCOPES,
} from '../config/discord'

export const STORAGE_KEY = 'discord_token'

/**
 * Shared Discord OAuth Client instance
 * Used across all hooks and components for Discord API interactions
 */
export const discordClient = new DiscordOAuthClient({
  clientId: DISCORD_CLIENT_ID,
  redirectUri: DISCORD_REDIRECT_URI,
  scopes: DISCORD_SCOPES,
  storage: localStorage,
})
