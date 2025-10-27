import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { DiscordRestClient } from '@repo/discord-integration/clients'

const getSecrets = createServerOnlyFn(() => {
  const botToken = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.PRIMARY_GUILD_ID

  if (!botToken?.length) {
    throw new Error('DISCORD_BOT_TOKEN environment variable is not defined')
  }
  if (!guildId?.length) {
    throw new Error('PRIMARY_GUILD_ID environment variable is not defined')
  }

  return { botToken, guildId }
})

// Create a singleton Discord REST client
let discordClient: DiscordRestClient | null = null

const getDiscordClient = createServerOnlyFn(() => {
  if (!discordClient) {
    const { botToken } = getSecrets()
    discordClient = new DiscordRestClient({
      botToken,
      onRateLimit: (retryAfter, isGlobal) => {
        console.warn(
          `[Discord] Rate limited for ${retryAfter}s (global: ${isGlobal})`,
        )
      },
      onError: (error) => {
        console.error('[Discord] API error:', error.message)
      },
    })
  }
  return discordClient
})

interface RoomCheckResult {
  exists: boolean
  channel?: {
    id: string
    name: string
    type: number
  }
  error?: string
}

interface CreateRoomOptions {
  name?: string
  parentId?: string
  userLimit?: number
}

interface CreateRoomResult {
  channelId: string
  name: string
  guildId: string
}

interface DeleteRoomResult {
  ok: boolean
}

interface ListRoomsResult {
  id: string
  name: string
  createdAt: string
}

/**
 * Check if a Discord voice channel exists
 * Server function that can be called directly from loaders/beforeLoad
 */
export const checkRoomExists = createServerFn({ method: 'POST' })
  .inputValidator((data: { channelId: string }) => data)
  .handler(async ({ data: { channelId } }): Promise<RoomCheckResult> => {
    try {
      const client = getDiscordClient()
      const { guildId } = getSecrets()

      // Get all channels and find the specific one
      const channels = await client.getChannels(guildId)
      const channel = channels.find((ch) => ch.id === channelId)

      if (!channel) {
        return { exists: false }
      }

      // Check if it's a voice channel (type 2)
      if (channel.type !== 2) {
        return {
          exists: false,
          error: 'Not a voice channel',
        }
      }

      return {
        exists: true,
        channel: {
          id: channel.id,
          name: channel.name || 'Voice Channel',
          type: channel.type,
        },
      }
    } catch (error) {
      console.error('[Discord] Error checking room:', error)
      return {
        exists: false,
        error: 'Internal server error',
      }
    }
  })

/**
 * Create a Discord voice channel
 * Server-only function that can be called directly from mutations
 */
export const createRoom = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateRoomOptions) => data)
  .handler(async ({ data: options }): Promise<CreateRoomResult> => {
    const client = getDiscordClient()
    const { guildId } = getSecrets()

    const channel = await client.createVoiceChannel(
      guildId,
      {
        name: options?.name || 'Voice Channel',
        parent_id: options?.parentId,
        user_limit: options?.userLimit,
      },
      'Created by Spell Coven app',
    )

    console.log(
      `[Discord] Created voice channel: ${channel.name} (${channel.id})`,
    )

    return {
      channelId: channel.id,
      name: channel.name || 'Voice Channel',
      guildId,
    }
  })

/**
 * Delete a Discord voice channel
 * Server-only function that can be called directly from mutations
 */
export const deleteRoom = createServerFn({ method: 'POST' })
  .inputValidator((data: { channelId: string }) => data)
  .handler(async ({ data: { channelId } }): Promise<DeleteRoomResult> => {
    const client = getDiscordClient()

    await client.deleteChannel(channelId, 'Deleted by Spell Coven app')

    console.log(`[Discord] Deleted voice channel: ${channelId}`)

    return { ok: true }
  })

/**
 * List all voice channels in the guild
 * Server-only function for cleanup operations
 *
 * @param onlyGameRooms - If true, only return rooms created by our app (with 🎮 prefix)
 */
export const listRooms = createServerFn({ method: 'POST' })
  .inputValidator((data: { onlyGameRooms?: boolean }) => data)
  .handler(async ({ data: options }): Promise<ListRoomsResult[]> => {
    const { onlyGameRooms = false } = options || {}
    const client = getDiscordClient()
    const { guildId } = getSecrets()

    const channels = await client.getChannels(guildId)

    // Filter to only voice channels (type 2)
    let voiceChannels = channels.filter((channel) => channel.type === 2)

    // Optionally filter to only our game rooms (identified by 🎮 prefix)
    if (onlyGameRooms) {
      voiceChannels = voiceChannels.filter((channel) =>
        channel.name?.startsWith('🎮'),
      )
    }

    return voiceChannels.map((channel) => ({
      id: channel.id,
      name: channel.name || 'Voice Channel',
      createdAt: new Date(
        Number(BigInt(channel.id) >> 22n) + 1420070400000,
      ).toISOString(),
    }))
  })

/**
 * Clean up old/empty voice channels
 * Server-only function for scheduled cleanup
 *
 * Deletes rooms that are:
 * - Created more than X hours ago AND have no recent activity
 * - OR created more than X hours ago (if activity tracking unavailable)
 */
export const cleanupOldRooms = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      inactiveForHours?: number
      createdBeforeHours?: number
      dryRun?: boolean
    }) => data,
  )
  .handler(async ({ data: options }) => {
    const {
      inactiveForHours: _inactiveForHours = 24, // TODO: Use when activity tracking is implemented
      createdBeforeHours = 48,
      dryRun = false,
    } = options || {}

    // Only list our game rooms (with 🎮 prefix)
    const rooms = await listRooms({ data: { onlyGameRooms: true } })
    const now = Date.now()
    const createdCutoff = now - createdBeforeHours * 60 * 60 * 1000
    // const inactiveCutoff = now - _inactiveForHours * 60 * 60 * 1000 // TODO: Use when activity tracking is implemented

    // Filter rooms that should be deleted
    const oldRooms = rooms.filter((room) => {
      const createdAt = new Date(room.createdAt).getTime()

      // Room must be at least X hours old
      if (createdAt > createdCutoff) {
        return false
      }

      // If room is old enough, it's a candidate for deletion
      // TODO: In future, also check if (lastActivity < inactiveCutoff) using Gateway Worker data
      return true
    })

    console.log(
      `[Cleanup] Found ${oldRooms.length} game rooms (🎮) created before ${createdBeforeHours} hours ago`,
    )

    if (dryRun) {
      return {
        deleted: 0,
        wouldDelete: oldRooms.length,
        rooms: oldRooms,
      }
    }

    const deleted: string[] = []
    const failed: Array<{ id: string; error: string }> = []

    for (const room of oldRooms) {
      try {
        await deleteRoom({ data: { channelId: room.id } })
        deleted.push(room.id)
        console.log(`[Cleanup] Deleted room: ${room.name} (${room.id})`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        failed.push({ id: room.id, error: message })
        console.error(`[Cleanup] Failed to delete room ${room.id}:`, message)
      }
    }

    return {
      deleted: deleted.length,
      failed: failed.length,
      deletedRooms: deleted,
      failedRooms: failed,
    }
  })
