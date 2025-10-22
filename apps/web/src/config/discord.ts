/**
 * Discord API Configuration
 * Type-safe access to Discord environment variables
 */

/**
 * Discord Client ID (public, safe to commit)
 * Get from Discord Developer Portal: https://discord.com/developers/applications
 */
export const DISCORD_CLIENT_ID = import.meta.env
  .VITE_DISCORD_CLIENT_ID as string

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
 */
export const DISCORD_SCOPES: string[] = [
  'identify', // Get user's Discord username, avatar, ID
  'guilds', // See which Discord servers the user is in
  'messages.read', // Read messages in channels
  'rpc.voice.read', // Read voice state
  'rpc.video.read', // Read video state
  'rpc', // Voice/video connection
  'rpc.activities.write', // Update user activity
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
  if (!DISCORD_CLIENT_ID) {
    throw new Error(
      'VITE_DISCORD_CLIENT_ID environment variable is not set. Please add it to .env.development',
    )
  }

  if (!/^\d+$/.test(DISCORD_CLIENT_ID)) {
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
