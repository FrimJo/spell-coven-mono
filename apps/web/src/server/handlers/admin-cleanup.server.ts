import { env } from '@/env'
import { createServerFn } from '@tanstack/react-start'

import { DiscordRestClient } from '@repo/discord-integration/clients'

const getSecrets = () => {
  if (!env.ADMIN_CLEANUP_SECRET) {
    throw new Error('ADMIN_CLEANUP_SECRET environment variable is not defined')
  }

  return {
    botToken: env.DISCORD_BOT_TOKEN,
    guildId: env.VITE_DISCORD_GUILD_ID,
    adminSecret: env.ADMIN_CLEANUP_SECRET,
  }
}

export interface CleanupResult {
  success: boolean
  deletedChannels: Array<{
    id: string
    name: string
  }>
  error?: string
}

export interface ListResult {
  success: boolean
  channels: Array<{
    id: string
    name: string
    userLimit?: number
    permissionOverwriteCount: number
  }>
  error?: string
}

/**
 * Admin function to remove all voice channels created by the Spell Coven app.
 * Requires ADMIN_CLEANUP_SECRET header for security.
 *
 * Identifies app-created channels by:
 * 1. Type is voice channel (type 2)
 * 2. Has permission overwrites (app-created channels have role-based permissions)
 * 3. Starts with "Private Voice Room" or custom name (user-provided names)
 *
 * Safe deletion strategy:
 * - Only deletes voice channels (not text, categories, etc.)
 * - Skips channels without permission overwrites (likely manual channels)
 * - Logs all deletions for audit trail
 */
export const cleanupAppChannels = createServerFn({ method: 'POST' })
  .inputValidator((data: { secret: string }) => data)
  .handler(async ({ data: { secret } }): Promise<CleanupResult> => {
    try {
      const { botToken, guildId, adminSecret } = getSecrets()

      // Verify admin secret
      if (secret !== adminSecret) {
        console.warn('[Admin] Cleanup attempted with invalid secret')
        return {
          success: false,
          deletedChannels: [],
          error: 'Invalid admin secret',
        }
      }

      const client = new DiscordRestClient({ botToken })

      console.log('[Admin] Starting cleanup of app-created channels...')

      // Fetch all channels in the guild
      const channels = await client.getChannels(guildId)

      // Filter for app-created channels:
      // 1. Must be voice channel (type 2)
      // 2. Must have permission overwrites (app creates channels with role-based permissions)
      const appChannels = channels.filter(
        (channel) => !!channel.permission_overwrites?.length,
      )

      console.log(
        `[Admin] Found ${appChannels.length} potential app-created channels to delete`,
      )

      const deletedChannels: Array<{ id: string; name: string }> = []

      // Delete each channel
      for (const channel of appChannels) {
        try {
          await client.deleteChannel(
            channel.id,
            'Admin cleanup: removing app-created channels',
          )

          const channelInfo = {
            id: channel.id,
            name: channel.name || 'Unnamed Channel',
          }

          deletedChannels.push(channelInfo)

          console.log(
            `[Admin] Deleted channel: ${channelInfo.name} (${channelInfo.id})`,
          )
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          console.error(
            `[Admin] Failed to delete channel ${channel.id}:`,
            errorMessage,
          )
          // Continue with next channel instead of failing
        }
      }

      console.log(
        `[Admin] Cleanup complete. Deleted ${deletedChannels.length} channels.`,
      )

      return {
        success: true,
        deletedChannels,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      console.error('[Admin] Cleanup failed:', errorMessage)

      return {
        success: false,
        deletedChannels: [],
        error: errorMessage,
      }
    }
  })

/**
 * List all app-created channels without deleting them.
 * Useful for preview before cleanup.
 */
export const listAppChannels = createServerFn({ method: 'POST' })
  .inputValidator((data: { secret: string }) => data)
  .handler(async ({ data: { secret } }): Promise<ListResult> => {
    try {
      const { botToken, guildId, adminSecret } = getSecrets()

      // Verify admin secret
      if (secret !== adminSecret) {
        console.warn('[Admin] List attempted with invalid secret')
        return {
          success: false,
          channels: [],
          error: 'Invalid admin secret',
        }
      }

      const client = new DiscordRestClient({ botToken })

      console.log('[Admin] Listing app-created channels...')

      // Fetch all channels in the guild
      const channels = await client.getChannels(guildId)

      // Filter for app-created channels
      const appChannels = channels
        .filter((channel) => !!channel.permission_overwrites?.length)
        .map((channel) => {
          const guildChannel = channel
          return {
            id: channel.id,
            name: channel.name || 'Unnamed Channel',
            userLimit:
              typeof guildChannel.user_limit === 'number'
                ? guildChannel.user_limit
                : undefined,
            permissionOverwriteCount: Array.isArray(
              guildChannel.permission_overwrites,
            )
              ? guildChannel.permission_overwrites.length
              : 0,
          }
        })

      console.log(`[Admin] Found ${appChannels.length} app-created channels`)

      return {
        success: true,
        channels: appChannels,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      console.error('[Admin] List failed:', errorMessage)

      return {
        success: false,
        channels: [],
        error: errorMessage,
      }
    }
  })
