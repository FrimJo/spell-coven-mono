/**
 * Discord Room Management Server Functions
 * Handles room creation, validation, and voice channel access
 */

import { createServerFn } from '@tanstack/react-start'

import { DiscordRestClient } from '@repo/discord-integration/clients'

const GUILD_ID = process.env.VITE_DISCORD_GUILD_ID || ''
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || ''

export const ensureUserInGuild = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; accessToken: string }) => data)
  .handler(async ({ data: { userId, accessToken } }) => {
    try {
      const client = new DiscordRestClient({ botToken: BOT_TOKEN })

      console.log('[DEBUG] ensureUserInGuild called with:', {
        guildId: GUILD_ID,
        userId,
      })

      // First, verify the bot can access the guild
      try {
        const channels = await client.getChannels(GUILD_ID)
        console.log(
          '[DEBUG] Bot can access guild, found',
          channels.length,
          'channels',
        )
      } catch (guildError) {
        console.error('[DEBUG] Bot cannot access guild:', guildError)
        throw guildError
      }

      const member = await client.ensureUserInGuild(GUILD_ID, userId, {
        access_token: accessToken,
      })

      if (member) {
        console.log('[DEBUG] User was added to guild')
      } else {
        console.log('[DEBUG] User was already in guild')
      }

      return { inGuild: true }
    } catch (error) {
      console.error('[Discord] Error in ensureUserInGuild:', error)
      return {
        inGuild: false,
        error: 'Internal server error',
      }
    }
  })

/**
 * Check if a Discord voice channel (game room) exists
 */
export const checkRoomExists = createServerFn({ method: 'POST' })
  .inputValidator((data: { channelId: string }) => data)
  .handler(async ({ data: { channelId } }) => {
    // Lazy import to prevent bundling for browser

    if (!BOT_TOKEN) {
      return {
        exists: false,
        error: 'Discord bot not configured',
      }
    }

    try {
      const client = new DiscordRestClient({ botToken: BOT_TOKEN })

      // Try to fetch the channel
      const channel = await client.getChannel(channelId)

      // Verify it's a voice channel (type 2)
      if (channel.type !== 2) {
        return {
          exists: false,
          error: 'Channel is not a voice channel',
        }
      }

      // Verify it's in the correct guild
      if (channel.guild_id !== GUILD_ID) {
        return {
          exists: false,
          error: 'Channel not found in this server',
        }
      }

      return {
        exists: true,
        channelName: channel.name || 'Game Room',
      }
    } catch (error) {
      console.error('[checkRoomExists] Error checking room:', error)
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Failed to check room',
      }
    }
  })

/**
 * Check if a user is currently in a specific voice channel
 */
export const checkUserInVoiceChannel = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; channelId: string }) => data)
  .handler(async ({ data: { userId, channelId } }) => {
    // Lazy import to prevent bundling for browser

    if (!BOT_TOKEN) {
      return {
        inChannel: false,
        error: 'Discord bot not configured',
      }
    }

    try {
      const client = new DiscordRestClient({ botToken: BOT_TOKEN })

      // Get all voice states for the guild
      const voiceStates = await client.getGuildVoiceStates(GUILD_ID)

      // Find the user's voice state
      const userVoiceState = voiceStates.find(
        (state) => state.user_id === userId,
      )

      if (!userVoiceState || !userVoiceState.channel_id) {
        return {
          inChannel: false,
          error: 'User is not in any voice channel',
        }
      }

      // Check if they're in the specific channel
      const isInChannel = userVoiceState.channel_id === channelId

      return {
        inChannel: isInChannel,
        currentChannelId: userVoiceState.channel_id,
      }
    } catch (error) {
      console.error(
        '[checkUserInVoiceChannel] Error checking voice state:',
        error,
      )
      return {
        inChannel: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check voice state',
      }
    }
  })

/**
 * Create a new game room with voice channel and role
 */
export const createRoom = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      creatorId: string
      name: string
      userLimit: number
      maxSeats: number
      tokenTtlSeconds: number
      includeCreatorOverwrite: boolean
      shareUrlBase: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createHmac } = await import('node:crypto')

    if (!BOT_TOKEN || !GUILD_ID) {
      throw new Error('Discord bot not configured')
    }

    const client = new DiscordRestClient({ botToken: BOT_TOKEN })

    try {
      // 1. Create role for the room
      const role = await client.createRole(GUILD_ID, {
        name: data.name,
        permissions: '0', // No special permissions
        mentionable: false,
      })

      // 2. Create voice channel with role permissions
      const channel = await client.createVoiceChannel(GUILD_ID, {
        name: data.name,
        user_limit: data.userLimit,
        permission_overwrites: [
          {
            id: GUILD_ID, // @everyone role
            type: 0,
            allow: '0',
            deny: '1024', // VIEW_CHANNEL
          },
          {
            id: role.id,
            type: 0,
            allow: '3146752', // VIEW_CHANNEL + CONNECT + SPEAK
            deny: '0',
          },
        ],
      })

      // 3. Generate invite token
      const issuedAt = Math.floor(Date.now() / 1000)
      const expiresAt = issuedAt + data.tokenTtlSeconds

      const payload = JSON.stringify({
        guild_id: GUILD_ID,
        channel_id: channel.id,
        role_id: role.id,
        creator_id: data.creatorId,
        max_seats: data.maxSeats,
        issued_at: issuedAt,
        expires_at: expiresAt,
      })

      const secret = process.env.HUB_SECRET || 'default-secret'
      const signature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      const token = `${Buffer.from(payload).toString('base64')}.${signature}`
      const shareUrl = `${data.shareUrlBase}/game/${channel.id}?t=${token}`
      const deepLink = `https://discord.com/channels/${GUILD_ID}/${channel.id}`

      return {
        room: {
          channelId: channel.id,
          roleId: role.id,
          guildId: GUILD_ID,
          deepLink,
        },
        invite: {
          token,
          issuedAt,
          expiresAt,
          shareUrl,
          maxSeats: data.maxSeats,
        },
      }
    } catch (error) {
      console.error('[createRoom] Error creating room:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to create room',
      )
    }
  })

/**
 * Refresh an existing room's invite token
 */
export const refreshRoomInvite = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      channelId: string
      roleId: string
      creatorId: string
      shareUrlBase: string
      maxSeats: number
      tokenTtlSeconds: number
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createHmac } = await import('node:crypto')

    if (!GUILD_ID) {
      throw new Error('Discord bot not configured')
    }

    try {
      // Generate new invite token
      const issuedAt = Math.floor(Date.now() / 1000)
      const expiresAt = issuedAt + data.tokenTtlSeconds

      const payload = JSON.stringify({
        guild_id: GUILD_ID,
        channel_id: data.channelId,
        role_id: data.roleId,
        creator_id: data.creatorId,
        max_seats: data.maxSeats,
        issued_at: issuedAt,
        expires_at: expiresAt,
      })

      const secret = process.env.HUB_SECRET || 'default-secret'
      const signature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      const token = `${Buffer.from(payload).toString('base64')}.${signature}`
      const shareUrl = `${data.shareUrlBase}/game/${data.channelId}?t=${token}`
      const deepLink = `https://discord.com/channels/${GUILD_ID}/${data.channelId}`

      return {
        room: {
          channelId: data.channelId,
          roleId: data.roleId,
          guildId: GUILD_ID,
          deepLink,
        },
        invite: {
          token,
          issuedAt,
          expiresAt,
          shareUrl,
          maxSeats: data.maxSeats,
        },
      }
    } catch (error) {
      console.error('[refreshRoomInvite] Error refreshing invite:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to refresh invite',
      )
    }
  })
