import type { VoiceChannel } from '@repo/discord-gateway-worker/types'

/**
 * Discord REST API helpers
 *
 * Provides simple wrappers for Discord API operations used by TanStack Start routes.
 * For more complete implementation, see DiscordRestClient in packages/discord-integration.
 */

const DISCORD_API_BASE = 'https://discord.com/api/v10'

export interface CreateVoiceChannelOptions {
  name: string
  guildId: string
  parentId?: string
  userLimit?: number
}

/**
 * Create a voice channel in Discord
 */
export async function createVoiceChannel(
  botToken: string,
  options: CreateVoiceChannelOptions,
): Promise<VoiceChannel> {
  const response = await fetch(
    `${DISCORD_API_BASE}/guilds/${options.guildId}/channels`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: options.name,
        type: 2, // Voice channel
        parent_id: options.parentId,
        user_limit: options.userLimit ?? 4,
      }),
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Discord API error (${response.status}): ${error}`)
  }

  return response.json()
}

/**
 * Delete a channel in Discord
 */
export async function deleteChannel(
  botToken: string,
  channelId: string,
): Promise<void> {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Discord API error (${response.status}): ${error}`)
  }
}

/**
 * Check if Discord API rate limit was hit
 */
export function isRateLimited(error: Error): boolean {
  return error.message.includes('429')
}

/**
 * Extract retry-after duration from rate limit error
 */
export function getRetryAfter(error: Error): number {
  const match = error.message.match(/retry_after[":]+\s*(\d+)/i)
  return match ? parseInt(match[1], 10) : 5
}
