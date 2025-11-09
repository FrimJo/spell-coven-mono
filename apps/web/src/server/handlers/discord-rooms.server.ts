/**
 * Discord Room Management Server Functions
 * Handles room creation, validation, and voice channel access
 */

import type { VoiceChannelMember } from '@/hooks/useVoiceChannelMembersFromEvents'
import { env } from '@/env'
import { sseManager } from '@/server/managers/sse-manager'
import { createServerFn } from '@tanstack/react-start'

import { DiscordRestClient } from '@repo/discord-integration/clients'

export const ensureUserInGuild = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; accessToken: string }) => data)
  .handler(async ({ data: { userId, accessToken } }) => {
    try {
      const client = new DiscordRestClient({ botToken: env.DISCORD_BOT_TOKEN })

      console.log('[ensureUserInGuild] Checking if user is in guild:', {
        guildId: env.VITE_DISCORD_GUILD_ID,
        userId,
      })

      // First, verify the bot can access the guild
      try {
        const channels = await client.getChannels(env.VITE_DISCORD_GUILD_ID)
        console.log(
          '[ensureUserInGuild] Bot can access guild, found',
          channels.length,
          'channels',
        )
      } catch (guildError) {
        console.error(
          '[ensureUserInGuild] Bot cannot access guild:',
          guildError,
        )
        throw guildError
      }

      const member = await client.ensureUserInGuild(
        env.VITE_DISCORD_GUILD_ID,
        userId,
        {
          access_token: accessToken,
        },
      )

      const alreadyPresent = !member
      if (alreadyPresent) {
        console.log('[ensureUserInGuild] User was already in guild')
      } else {
        console.log('[ensureUserInGuild] User was added to guild')
      }

      return { success: true, alreadyPresent }
    } catch (error) {
      console.error('[ensureUserInGuild] Error:', error)
      return {
        success: false,
        error: 'Internal server error',
        alreadyPresent: false,
      }
    }
  })

/**
 * Check if a user is in a specific voice channel (read-only, no side effects)
 * Single source of truth for voice channel status checks
 */
export const checkUserInVoiceChannel = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; targetChannelId: string }) => data)
  .handler(async ({ data: { userId, targetChannelId } }) => {
    try {
      const client = new DiscordRestClient({ botToken: env.DISCORD_BOT_TOKEN })

      console.log('[checkUserInVoiceChannel] Checking voice channel status:', {
        userId,
        targetChannelId,
      })

      const voiceState = await client.getVoiceState(
        env.VITE_DISCORD_GUILD_ID,
        userId,
      )

      // Not in any voice channel
      if (!voiceState.channel_id) {
        console.log('[checkUserInVoiceChannel] User is not in any voice channel')
        return {
          inChannel: false,
          channelId: null,
        }
      }

      // Check if it's the channel we care about
      const inTargetChannel = voiceState.channel_id === targetChannelId
      console.log('[checkUserInVoiceChannel] Voice channel status:', {
        inTargetChannel,
        currentChannelId: voiceState.channel_id,
      })

      return {
        inChannel: inTargetChannel,
        channelId: voiceState.channel_id,
      }
    } catch (error: unknown) {
      // Handle "Unknown Voice State" error (404) - user is not in any voice channel
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 10065
      ) {
        console.log(
          '[checkUserInVoiceChannel] User has no voice state (not in any channel)',
        )
        return {
          inChannel: false,
          channelId: null,
        }
      }

      console.error('[checkUserInVoiceChannel] Error:', error)
      return {
        inChannel: false,
        channelId: null,
      }
    }
  })

/**
 * Ensure user is in a specific voice channel (legacy wrapper for backward compatibility)
 * Uses checkUserInVoiceChannel internally
 */
export const ensureUserInVoiceChannel = createServerFn({ method: 'GET' })
  .inputValidator((data: { userId: string; targetChannelId: string }) => data)
  .handler(async ({ data: { userId, targetChannelId } }) => {
    const checkFn = checkUserInVoiceChannel
    const result = await checkFn({
      data: { userId, targetChannelId },
    })

    // Transform result to legacy format for backward compatibility
    if (result.inChannel) {
      console.log(
        '[ensureUserInVoiceChannel] User is already in target voice channel',
      )
      return { success: true, alreadyPresent: true }
    } else if (result.channelId) {
      console.log('[ensureUserInVoiceChannel] User is in different voice channel')
      return { success: false, alreadyPresent: false, error: 'User is in different voice channel' }
    } else {
      console.log('[ensureUserInVoiceChannel] User is not in any voice channel')
      return {
        success: false,
        alreadyPresent: false,
        error: 'User is not in any voice channel',
      }
    }
  })

type CheckRoomExistsResult =
  | {
      exists: true
      channelName: string
      roleId: string | undefined
    }
  | {
      exists: false
      error?: string
    }

/**
 * Check if a Discord voice channel (game room) exists
 */
export const checkRoomExists = createServerFn({ method: 'POST' })
  .inputValidator((data: { channelId: string }) => data)
  .handler(async ({ data: { channelId } }): Promise<CheckRoomExistsResult> => {
    // Lazy import to prevent bundling for browser

    try {
      const client = new DiscordRestClient({
        botToken: env.DISCORD_BOT_TOKEN,
      })

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
        channelName: channel.name,
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
 * Ensure a user has a role in a guild (assign if not already assigned)
 * Returns success if user already has role or if role was successfully assigned
 */
export const ensureUserHasRole = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; roleId: string }) => data)
  .handler(async ({ data: { userId, roleId } }) => {
    try {
      const client = new DiscordRestClient({ botToken: env.DISCORD_BOT_TOKEN })

      console.log('[ensureUserHasRole] Checking if user has role:', {
        userId,
        roleId,
        guildId: env.VITE_DISCORD_GUILD_ID,
      })

      // Fetch guild member to check current roles
      const member = await client.getAPIGuildMember(
        env.VITE_DISCORD_GUILD_ID,
        userId,
      )

      // Check if user already has the role
      if (member.roles?.includes(roleId)) {
        console.log('[ensureUserHasRole] User already has role')
        return { success: true, alreadyPresent: true }
      }

      // Assign role if not already assigned
      console.log('[ensureUserHasRole] Assigning role to user')
      await client.addMemberRole(
        env.VITE_DISCORD_GUILD_ID,
        userId,
        roleId,
        'Assigning role for game room access',
      )

      console.log('[ensureUserHasRole] Successfully assigned role to user')
      return { success: true, alreadyPresent: false }
    } catch (error) {
      console.error('[ensureUserHasRole] Error:', error)

      let errorMessage = 'Failed to ensure user has role'
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
        alreadyPresent: false,
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
 * Fetches fresh data from Discord REST API - no caching
 * This ensures we always have the current state when a user joins
 */
export const getInitialVoiceChannelMembers = createServerFn({ method: 'POST' })
  .inputValidator((data: { channelId: string }) => data)
  .handler(
    async ({
      data: { channelId },
    }): Promise<{
      members: Array<VoiceChannelMember>
      error?: string | null
    }> => {
      try {
        const client = new DiscordRestClient({
          botToken: env.DISCORD_BOT_TOKEN,
        })

        console.log(
          '[getInitialVoiceChannelMembers] Fetching members for channel:',
          channelId,
        )

        // Get the channel to verify it exists and get guild ID
        const channel = await client.getChannel(channelId)

        if (channel.type !== 2) {
          // 2 = GUILD_VOICE
          return { members: [], error: 'Channel is not a voice channel' }
        }

        const guildId = channel.guild_id
        if (!guildId) {
          return { members: [], error: 'Channel has no guild' }
        }

        // Fetch all voice states for the guild to find who's in the target channel
        // Note: Discord API doesn't return voice_state in listGuildMembers,
        // so we need to fetch voice states separately
        const voiceStates = await client.getChannelVoiceStates(
          guildId,
          channelId,
        )

        // Get currently connected user IDs from SSE manager
        const connectedUserIds = sseManager.getConnectedUserIdsForGuild(guildId)

        // Now fetch member details for each user in the voice channel
        const allMembers: Array<VoiceChannelMember> = []

        for (const voiceState of voiceStates) {
          if (!voiceState.user_id) continue

          try {
            const member = await client.getAPIGuildMember(
              guildId,
              voiceState.user_id,
            )
            if (member.user) {
              allMembers.push({
                id: member.user.id,
                username: member.user.username,
                avatar: member.user.avatar,
                isOnline: connectedUserIds.has(member.user.id),
              })
            }
          } catch (error) {
            // Skip members that can't be fetched
            console.warn(
              `[getInitialVoiceChannelMembers] Failed to fetch member ${voiceState.user_id}:`,
              error,
            )
          }
        }

        console.log(
          `[getInitialVoiceChannelMembers] Found ${allMembers.length} members in channel ${channelId}`,
        )

        return { members: allMembers, error: null }
      } catch (error) {
        console.error('[getInitialVoiceChannelMembers] Error:', error)
        return {
          members: [],
          error:
            error instanceof Error ? error.message : 'Failed to fetch members',
        }
      }
    },
  )

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
        console.error(
          '[createRoom] Failed to assign role to creator:',
          roleError,
        )
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
