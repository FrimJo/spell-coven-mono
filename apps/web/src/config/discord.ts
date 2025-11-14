/**
 * Discord Configuration
 * Public configuration values for Discord integration
 */

import { env } from '@/env'

/**
 * Discord Client ID (public, safe to commit)
 * Get from Discord Developer Portal: https://discord.com/developers/applications
 */
export const clientId = env.VITE_DISCORD_CLIENT_ID

/**
 * OAuth2 Redirect URI
 * Must match exactly with Discord Developer Portal configuration
 */
export const DISCORD_REDIRECT_URI =
  typeof window !== 'undefined'
    ? `${window.location.origin}/auth/discord/callback`
    : 'https://localhost:1234/auth/discord/callback'

/**
 * OAuth2 Scopes
 * Phase 1: Authentication only
 *
 * Valid Discord OAuth2 scopes:
 * - identify: Get user's Discord username, avatar, ID
 * - guilds: See which Discord servers the user is in
 * - guilds.join: Add user to guild (required for ensureUserInGuild)
 */
export const DISCORD_SCOPES: string[] = [
  'identify', // Get user's Discord username, avatar, ID
  'guilds', // See which Discord servers the user is in
  'guilds.join', // Add user to guild (required for ensureUserInGuild)
]

/**
 * Discord API Base URL
 */
export const DISCORD_API_BASE = 'https://discord.com/api/v10'

/**
 * Discord Gateway URL
 */
export const DISCORD_GATEWAY_URL =
  'wss://gateway.discord.gg/?v=10&encoding=json'

/**
 * Token refresh buffer (milliseconds)
 * Refresh token this many ms before expiration
 */
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Validate Discord configuration
 * @throws {Error} if configuration is invalid
 */
export function validateDiscordConfig(): void {
  if (!clientId) {
    throw new Error(
      'VITE_DISCORD_CLIENT_ID environment variable is not set. Please add it to .env.development',
    )
  }

  if (!/^\d+$/.test(clientId)) {
    throw new Error(
      'VITE_DISCORD_CLIENT_ID must be a valid Discord Application ID (numeric string)',
    )
  }
}

// Validate on module load (development only)
if (import.meta.env.DEV) {
  try {
    validateDiscordConfig()
  } catch (error) {
    console.error('❌ Discord configuration error:', error)
  }
}
