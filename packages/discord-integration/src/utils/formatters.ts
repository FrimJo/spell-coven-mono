import type { DiscordUser, GameEventEmbed } from '../types/index.js'
import { EmbedColors } from '../types/messages.js'

/**
 * Message formatting utilities
 */

/**
 * Format Discord user display name
 * @param user Discord user object
 * @returns Formatted display name (username#discriminator or @username)
 */
export function formatUserDisplayName(user: DiscordUser): string {
  if (user.discriminator === '0' || user.discriminator === '0000') {
    // New username system (no discriminator)
    return `@${user.username}`
  }
  // Legacy username system
  return `${user.username}#${user.discriminator}`
}

/**
 * Get Discord CDN avatar URL
 * @param user Discord user object
 * @param size Avatar size (default: 128)
 * @returns Avatar URL or default avatar URL
 */
export function getAvatarUrl(user: DiscordUser, size = 128): string {
  if (user.avatar) {
    const extension = user.avatar.startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=${size}`
  }
  // Default avatar (based on discriminator or user ID)
  const defaultAvatarIndex =
    user.discriminator !== '0'
      ? parseInt(user.discriminator, 10) % 5
      : parseInt(user.id, 10) % 5
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`
}

/**
 * Format timestamp to Discord timestamp format
 * @param date Date object or ISO string
 * @param style Discord timestamp style (t, T, d, D, f, F, R)
 * @returns Discord timestamp string
 */
export function formatDiscordTimestamp(
  date: Date | string,
  style: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'f',
): string {
  const timestamp =
    typeof date === 'string' ? new Date(date).getTime() : date.getTime()
  const unixSeconds = Math.floor(timestamp / 1000)
  return `<t:${unixSeconds}:${style}>`
}

/**
 * Format game event embed for Discord message
 * @param embed Game event embed data
 * @returns Discord API embed object
 */
export function formatGameEventEmbed(
  embed: GameEventEmbed,
): Record<string, unknown> {
  const baseEmbed = {
    timestamp: embed.timestamp,
    color: embed.color,
  }

  switch (embed.type) {
    case 'card_lookup': {
      const data = embed.data as {
        cardName: string
        manaCost?: string
        oracleText?: string
        imageUrl?: string
      }
      return {
        ...baseEmbed,
        title: data.cardName,
        description: data.oracleText,
        fields: data.manaCost
          ? [{ name: 'Mana Cost', value: data.manaCost, inline: true }]
          : [],
        thumbnail: data.imageUrl ? { url: data.imageUrl } : undefined,
        color: embed.color ?? EmbedColors.CARD_LOOKUP,
      }
    }

    case 'life_total': {
      const data = embed.data as {
        playerName: string
        oldLife: number
        newLife: number
      }
      const delta = data.newLife - data.oldLife
      const deltaStr = delta > 0 ? `+${delta}` : `${delta}`
      const color = delta > 0 ? EmbedColors.LIFE_GAIN : EmbedColors.LIFE_LOSS
      return {
        ...baseEmbed,
        title: '❤️ Life Total Change',
        description: `**${data.playerName}**: ${data.oldLife} → ${data.newLife} (${deltaStr})`,
        color: embed.color ?? color,
      }
    }

    case 'turn_change': {
      const data = embed.data as { turnNumber: number; activePlayer: string }
      return {
        ...baseEmbed,
        title: '🔄 Turn Change',
        description: `**Turn ${data.turnNumber}**: ${data.activePlayer}'s turn`,
        color: embed.color ?? EmbedColors.TURN_CHANGE,
      }
    }

    default:
      return baseEmbed
  }
}

/**
 * Sanitize user input for Discord messages
 * @param text User input text
 * @returns Sanitized text
 */
export function sanitizeMessageContent(text: string): string {
  // Remove @everyone and @here mentions
  let sanitized = text.replace(/@(everyone|here)/g, '@\u200b$1')

  // Escape Discord markdown (optional - Discord handles this)
  // sanitized = sanitized.replace(/([*_~`|])/g, '\\$1');

  // Trim to Discord's 2000 character limit
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 1997) + '...'
  }

  return sanitized
}

/**
 * Format room metadata for Discord channel topic
 * @param metadata Room metadata object
 * @returns JSON string for channel topic
 */
export function formatRoomMetadata(metadata: unknown): string {
  return JSON.stringify(metadata)
}

/**
 * Parse room metadata from Discord channel topic
 * @param topic Channel topic string
 * @returns Parsed metadata object or null
 */
export function parseRoomMetadata(topic: string | undefined): unknown | null {
  if (!topic) return null

  try {
    return JSON.parse(topic)
  } catch {
    return null
  }
}

/**
 * Format bytes to human-readable size
 * @param bytes Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Format milliseconds to human-readable duration
 * @param ms Milliseconds
 * @returns Formatted string (e.g., "2m 30s")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}
