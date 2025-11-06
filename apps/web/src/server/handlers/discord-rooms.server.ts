/**
 * Discord Room Management Server Functions
 * Handles room creation, validation, and voice channel access
 */

import { env } from '@/env'
import { createServerFn } from '@tanstack/react-start'

import { DiscordRestClient } from '@repo/discord-integration/clients'

export const ensureUserInGuild = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; accessToken: string }) => data)
  .handler(async ({ data: { userId, accessToken } }) => {
    try {
      const client = new DiscordRestClient({ botToken: env.DISCORD_BOT_TOKEN })

      console.log('[DEBUG] ensureUserInGuild called with:', {
        guildId: env.VITE_DISCORD_GUILD_ID,
        userId,
      })

      // First, verify the bot can access the guild
      try {
        const channels = await client.getChannels(env.VITE_DISCORD_GUILD_ID)
        console.log(
          '[DEBUG] Bot can access guild, found',
          channels.length,
          'channels',
        )
      } catch (guildError) {
        console.error('[DEBUG] Bot cannot access guild:', guildError)
        throw guildError
      }

      const member = await client.ensureUserInGuild(
        env.VITE_DISCORD_GUILD_ID,
        userId,
        {
          access_token: accessToken,
        },
      )

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

export const ensureUserInVoiceChannel = createServerFn({ method: 'GET' })
  .inputValidator((data: { userId: string; targetChannelId: string }) => data)
  .handler(async ({ data: { userId, targetChannelId } }) => {
    try {
      const client = new DiscordRestClient({ botToken: env.DISCORD_BOT_TOKEN })

      const voiceState = await client.getVoiceState(
        env.VITE_DISCORD_GUILD_ID,
        userId,
      )

      // Not in any voice channel
      if (!voiceState.channel_id)
        return { inChannel: false, error: 'User is not in any voice channel' }

      // Check if it's the channel we care about
      return { inChannel: voiceState.channel_id === targetChannelId }
    } catch (error: unknown) {
      // Handle "Unknown Voice State" error (404) - user is not in any voice channel
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 10065
      ) {
        // Discord error code 10065 = Unknown Voice State (user not in voice channel)
        return {
          inChannel: false,
          error: 'User is not in any voice channel',
        }
      }

      console.error('[Discord] Error in ensureUserInVoiceChannel:', error)
      return {
        inChannel: false,
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

    try {
      const client = new DiscordRestClient({ botToken: env.DISCORD_BOT_TOKEN })

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
      if (channel.guild_id !== env.VITE_DISCORD_GUILD_ID) {
        return {
          exists: false,
          error: 'Channel not found in this server',
        }
      }

      // Extract roleId from permission overwrites
      // Look for a role overwrite (type 0) that has allow permissions
      let roleId: string | undefined
      if (channel.permission_overwrites) {
        const roleOverwrite = channel.permission_overwrites.find(
          (overwrite) =>
            overwrite.type === 0 && // Role type
            overwrite.id !== env.VITE_DISCORD_GUILD_ID && // Not @everyone
            overwrite.allow !== '0', // Has allow permissions
        )
        roleId = roleOverwrite?.id
      }

      return {
        exists: true,
        channelName: channel.name || 'Game Room',
        roleId,
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
 * Assign a role to a user in a guild
 */
export const assignRoleToUser = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; roleId: string }) => data)
  .handler(async ({ data: { userId, roleId } }) => {
    try {
      const client = new DiscordRestClient({ botToken: env.DISCORD_BOT_TOKEN })

      console.log('[assignRoleToUser] Assigning role to user:', {
        userId,
        roleId,
        guildId: env.VITE_DISCORD_GUILD_ID,
      })

      await client.addMemberRole(
        env.VITE_DISCORD_GUILD_ID,
        userId,
        roleId,
        'Assigning role for game room access',
      )

      console.log('[assignRoleToUser] Successfully assigned role to user')
      return { success: true }
    } catch (error) {
      console.error('[assignRoleToUser] Error:', error)

      let errorMessage = 'Failed to assign role'
      if (error instanceof Error) {
        if (error.message.includes('50013')) {
          errorMessage = 'Bot lacks MANAGE_ROLES permission'
        } else if (error.message.includes('10011')) {
          errorMessage = 'Role not found'
        } else {
          errorMessage = error.message
        }
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  })

/**
 * Move a user to a voice channel. Need to be connected to another voice channel
 * Uses Discord bot to move the user to the specified voice channel
 */
export const connectUserToVoiceChannel = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; channelId: string }) => data)
  .handler(async ({ data: { userId, channelId } }) => {
    try {
      const client = new DiscordRestClient({ botToken: env.DISCORD_BOT_TOKEN })

      console.log('[connectUserToVoiceChannel] Moving user to voice channel:', {
        userId,
        channelId,
        guildId: env.VITE_DISCORD_GUILD_ID,
      })

      await client.moveUserToVoiceChannel(
        env.VITE_DISCORD_GUILD_ID,
        userId,
        channelId,
        'Auto-connecting user to game room voice channel',
      )

      console.log(
        '[connectUserToVoiceChannel] Successfully moved user to voice channel',
      )
      console.log(
        '[connectUserToVoiceChannel] Discord will send VOICE_STATE_UPDATE event to Gateway',
      )

      // Broadcast current voice states for this channel to sync initial members
      // This ensures all users see existing members when someone new joins
      const { sseManager } = await import('../managers/sse-manager.js')
      sseManager.broadcastChannelVoiceStates(
        env.VITE_DISCORD_GUILD_ID,
        channelId,
      )

      return { success: true }
    } catch (error) {
      console.error('[connectUserToVoiceChannel] Error:', error)

      // Provide helpful error messages
      let errorMessage = 'Failed to connect to voice channel'
      if (error instanceof Error) {
        if (error.message.includes('50013')) {
          errorMessage = 'Bot lacks MOVE_MEMBERS permission'
        } else if (error.message.includes('40032')) {
          errorMessage = 'User is not connected to any voice channel'
        } else {
          errorMessage = error.message
        }
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  })

/**
 * Get current members in a voice channel
 * This fetches the initial state when a user joins the game room
 */
export const getInitialVoiceChannelMembers = createServerFn({ method: 'POST' })
  .inputValidator((data: { channelId: string }) => data)
  .handler(async ({ data: { channelId } }) => {
    try {
      const client = new DiscordRestClient({ botToken: env.DISCORD_BOT_TOKEN })

      console.log(
        '[getInitialVoiceChannelMembers] Fetching members for channel:',
        channelId,
      )

      // Get the channel to verify it exists
      const channel = await client.getChannel(channelId)

      if (channel.type !== 2) {
        // 2 = GUILD_VOICE
        return { members: [], error: 'Channel is not a voice channel' }
      }

      // Note: Discord's REST API doesn't provide a direct way to list voice channel members
      // The List Guild Members endpoint doesn't include voice states
      // Voice states are only available through:
      // 1. Gateway VOICE_STATE_UPDATE events (which we're already using)
      // 2. Individual member lookups (expensive for large guilds)
      //
      // For now, we'll return an empty array and let the real-time events populate the list
      // This is actually the recommended approach by Discord
      //
      // Alternative: We could cache voice states from Gateway events in Redis/memory,
      // but that adds complexity. The auto-connect + real-time events should be sufficient.

      const membersInChannel: Array<{
        id: string
        username: string
        avatar: string | null
      }> = []

      console.log(
        '[getInitialVoiceChannelMembers] Returning empty initial state (will be populated by Gateway events)',
      )

      return { members: membersInChannel, error: null }
    } catch (error) {
      console.error('[getInitialVoiceChannelMembers] Error:', error)
      return {
        members: [],
        error:
          error instanceof Error ? error.message : 'Failed to fetch members',
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

    const client = new DiscordRestClient({ botToken: env.DISCORD_BOT_TOKEN })

    try {
      // 1. Create role for the room
      const role = await client.createRole(env.VITE_DISCORD_GUILD_ID, {
        name: data.name,
        permissions: '0', // No special permissions
        mentionable: false,
      })

      // 2. Create voice channel with role permissions
      const channel = await client.createVoiceChannel(
        env.VITE_DISCORD_GUILD_ID,
        {
          name: data.name,
          user_limit: data.userLimit,
          permission_overwrites: [
            {
              id: env.VITE_DISCORD_GUILD_ID, // @everyone role
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
            {
              id: env.DISCORD_BOT_USER_ID, // Bot user
              type: 1, // Member type
              allow: '1024', // VIEW_CHANNEL (so bot can fetch channel details)
              deny: '0',
            },
          ],
        },
      )

      // 3. Assign role to creator so they can access the channel
      try {
        await client.addMemberRole(
          env.VITE_DISCORD_GUILD_ID,
          data.creatorId,
          role.id,
          'Assigning room creator role for game room access',
        )
        console.log('[createRoom] Successfully assigned role to creator')
      } catch (roleError) {
        console.error('[createRoom] Failed to assign role to creator:', roleError)
        // Don't fail room creation if role assignment fails - user can be moved via bot
      }

      // 4. Generate invite token
      const issuedAt = Math.floor(Date.now() / 1000)
      const expiresAt = issuedAt + data.tokenTtlSeconds

      const payload = JSON.stringify({
        guild_id: env.VITE_DISCORD_GUILD_ID,
        channel_id: channel.id,
        role_id: role.id,
        creator_id: data.creatorId,
        max_seats: data.maxSeats,
        issued_at: issuedAt,
        expires_at: expiresAt,
      })

      const secret = env.HUB_SECRET
      const signature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      const token = `${Buffer.from(payload).toString('base64')}.${signature}`
      const shareUrl = `${data.shareUrlBase}/game/${channel.id}`
      const deepLink = `https://discord.com/channels/${env.VITE_DISCORD_GUILD_ID}/${channel.id}`

      return {
        room: {
          channelId: channel.id,
          roleId: role.id,
          guildId: env.VITE_DISCORD_GUILD_ID,
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

    try {
      // Generate new invite token
      const issuedAt = Math.floor(Date.now() / 1000)
      const expiresAt = issuedAt + data.tokenTtlSeconds

      const payload = JSON.stringify({
        guild_id: env.VITE_DISCORD_GUILD_ID,
        channel_id: data.channelId,
        role_id: data.roleId,
        creator_id: data.creatorId,
        max_seats: data.maxSeats,
        issued_at: issuedAt,
        expires_at: expiresAt,
      })

      const secret = env.HUB_SECRET
      const signature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      const token = `${Buffer.from(payload).toString('base64')}.${signature}`
      const shareUrl = `${data.shareUrlBase}/game/${data.channelId}`
      const deepLink = `https://discord.com/channels/${env.VITE_DISCORD_GUILD_ID}/${data.channelId}`

      return {
        room: {
          channelId: data.channelId,
          roleId: data.roleId,
          guildId: env.VITE_DISCORD_GUILD_ID,
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
