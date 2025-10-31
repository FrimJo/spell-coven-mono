import { randomUUID } from 'node:crypto'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'

import type { ChannelResponse } from '@repo/discord-integration/types'
import type { PermissionOverwrite } from '@repo/discord-integration/utils'
import { DiscordRestClient } from '@repo/discord-integration/clients'
import { buildRoomPermissionOverwrites } from '@repo/discord-integration/utils'

import type {
  CreateRoomRequest,
  CreateRoomResponse,
  RefreshRoomInviteRequest,
  RefreshRoomInviteResponse,
  RoomSummary,
} from './schemas'
import { createRoomInviteToken } from './room-tokens'
import { verifyRoomInviteToken } from './room-tokens'
import {
  CreateRoomRequestSchema,
  CreateRoomResponseSchema,
  DeleteRoomResponseSchema,
  RefreshRoomInviteRequestSchema,
  RefreshRoomInviteResponseSchema,
  JoinRoomRequestSchema,
  JoinRoomResponseSchema,
  type JoinRoomRequest,
  type JoinRoomResponse,
} from './schemas'

interface RoomCheckResult {
  exists: boolean
  channel?: {
    id: string
    name: string
    type: number
  }
  error?: string
}

interface ListRoomsResult {
  id: string
  name: string
  createdAt: string
}

const DISCORD_DEEP_LINK_BASE = 'https://discord.com/channels'

const getSecrets = createServerOnlyFn(() => {
  const botToken = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.VITE_DISCORD_GUILD_ID || process.env.PRIMARY_GUILD_ID

  if (!botToken?.length) {
    throw new Error('DISCORD_BOT_TOKEN environment variable is not defined')
  }
  if (!guildId?.length) {
    throw new Error('VITE_DISCORD_GUILD_ID or PRIMARY_GUILD_ID environment variable is not defined')
  }

  return { botToken, guildId }
})

const getBotUserId = createServerOnlyFn(() => {
  const botUserId = process.env.DISCORD_BOT_USER_ID

  if (!botUserId?.length) {
    throw new Error('DISCORD_BOT_USER_ID environment variable is not defined')
  }

  return botUserId
})

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

function normalizeShareBase(base: string): string {
  return base.endsWith('/') ? base.slice(0, -1) : base
}

function buildShareUrl(base: string, channelId: string, token: string): string {
  const normalizedBase = normalizeShareBase(base)
  return `${normalizedBase}/game/${channelId}?t=${encodeURIComponent(token)}`
}

function buildDeepLink(guildId: string, channelId: string): string {
  return `${DISCORD_DEEP_LINK_BASE}/${guildId}/${channelId}`
}

function ensureRoomName(name?: string): string {
  const fallback = 'Private Voice Room'
  if (!name) return fallback

  const trimmed = name.trim()
  if (!trimmed.length) {
    return fallback
  }

  return trimmed.slice(0, 100)
}

function createRoleName(): string {
  return `room-${randomUUID().slice(0, 8)}`
}

function mapPermissionOverwrites(
  overwrites: PermissionOverwrite[] | undefined,
): PermissionOverwrite[] {
  if (!overwrites?.length) {
    return []
  }

  return overwrites.map((overwrite) => ({
    id: overwrite.id,
    type: overwrite.type,
    allow: overwrite.allow,
    deny: overwrite.deny,
  }))
}

function mapChannelToSummary(
  channel: ChannelResponse,
  guildId: string,
  roleId: string,
  fallbackOverwrites: PermissionOverwrite[] | undefined,
): RoomSummary {
  const permissionOverwrites = mapPermissionOverwrites(
    channel.permission_overwrites as PermissionOverwrite[] | undefined,
  )

  const overwrites =
    permissionOverwrites.length > 0
      ? permissionOverwrites
      : mapPermissionOverwrites(fallbackOverwrites)

  return {
    guildId,
    channelId: channel.id,
    roleId,
    name: channel.name,
    userLimit:
      typeof channel.user_limit === 'number' ? channel.user_limit : undefined,
    permissionOverwrites: overwrites,
    deepLink: buildDeepLink(guildId, channel.id),
  }
}

export const ensureUserInGuild = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; accessToken: string }) => data)
  .handler(async ({ data: { userId, accessToken } }) => {
    try {
      const client = getDiscordClient()
      const { guildId } = getSecrets()

      console.log('[DEBUG] ensureUserInGuild called with:', { guildId, userId })

      // First, verify the bot can access the guild
      try {
        const channels = await client.getChannels(guildId)
        console.log('[DEBUG] Bot can access guild, found', channels.length, 'channels')
      } catch (guildError) {
        console.error('[DEBUG] Bot cannot access guild:', guildError)
        throw guildError
      }

      const member = await client.ensureUserInGuild(guildId, userId, {
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

export const checkRoomExists = createServerFn({ method: 'POST' })
  .inputValidator((data: { channelId: string }) => data)
  .handler(async ({ data: { channelId } }): Promise<RoomCheckResult> => {
    try {
      const client = getDiscordClient()
      const { guildId } = getSecrets()

      const channels = await client.getChannels(guildId)
      const channel = channels.find((ch) => ch.id === channelId)

      if (!channel) {
        return { exists: false }
      }

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

export const createRoom = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateRoomRequest) =>
    CreateRoomRequestSchema.parse(data),
  )
  .handler(async ({ data }): Promise<CreateRoomResponse> => {
    const request = data
    const client = getDiscordClient()
    const { guildId } = getSecrets()
    const botUserId = getBotUserId()

    // Fetch the bot's guild member and roles
    const guildMember = await client.getGuildMember(guildId, botUserId)
    const botRoles = guildMember.roles
    const allRoles = await client.getGuildRoles(guildId);
    let basePermissions = 0n;
    for (const roleId of botRoles) {
      const role = allRoles.find((r: { id: string }) => r.id === roleId);
      if (role) {
        basePermissions |= BigInt(role.permissions);
      }
    }
    console.log('[DEBUG] botUser effective guild-level permissions (bitfield as BigInt):', basePermissions.toString());

    const { PermissionFlagsBits } = await import('discord-api-types/v10');
    const humanPerms = Object.entries(PermissionFlagsBits).filter((entry) => (basePermissions & BigInt(entry[1])) !== 0n).map((entry) => entry[0]);
    console.log('[DEBUG] botUser effective guild-level permissions (list):', humanPerms);

    const role = await client.createRole(
      guildId,
      {
        name: createRoleName(),
        permissions: '0',
        mentionable: false,
        hoist: false,
      },
      'Spell Coven: create private voice room role',
    )

    console.log('[DEBUG] Bot User ID for permission overwrites:', botUserId)
    // TEMPORARY DIAGNOSTIC: remove creatorId from permission overwrites for Discord bug isolation
    const permissionOverwrites = buildRoomPermissionOverwrites({
      guildId,
      roleId: role.id,
      botUserId,
      creatorId: request.includeCreatorOverwrite ? request.creatorId : undefined,
    })
    console.log('[DEBUG] Permission overwrites sent to Discord (no creatorId):', JSON.stringify(permissionOverwrites, null, 2))
    const roomName = ensureRoomName(request.name)
    // Confirm parent_id is NOT being sent
    console.log('[DEBUG] parent_id for channel will NOT be sent (should be undefined)')
    let channel
    try {
      channel = await client.createVoiceChannel(
        guildId,
        {
          name: roomName,
          // parent_id: request.parentId, // Make sure this stays commented/not present
          user_limit: request.userLimit,
          permission_overwrites: permissionOverwrites,
        },
        'Spell Coven: create private voice room channel',
      )
    } catch (e) {
      console.error('[DEBUG] DISCORD CHANNEL CREATE ERROR:', e)
      try {
        console.error('[DEBUG] DISCORD CHANNEL CREATE ERROR (stringified):', JSON.stringify(e, null, 2))
      } catch {
        // Ignore JSON.stringify errors
      }
      throw e
    }

    const maxSeats = request.maxSeats ?? request.userLimit

    const invite = await createRoomInviteToken({
      guildId,
      channelId: channel.id,
      roleId: role.id,
      creatorId: request.creatorId,
      expiresInSeconds: request.tokenTtlSeconds,
      maxSeats,
      roomName: channel.name ?? roomName,
    })

    const response = {
      room: mapChannelToSummary(
        channel,
        guildId,
        role.id,
        permissionOverwrites,
      ),
      invite: {
        token: invite.token,
        issuedAt: invite.issuedAt,
        expiresAt: invite.expiresAt,
        shareUrl: buildShareUrl(request.shareUrlBase, channel.id, invite.token),
        maxSeats: maxSeats ?? undefined,
      },
    }

    return CreateRoomResponseSchema.parse(response)
  })

export const refreshRoomInvite = createServerFn({ method: 'POST' })
  .inputValidator((data: RefreshRoomInviteRequest) =>
    RefreshRoomInviteRequestSchema.parse(data),
  )
  .handler(async ({ data }): Promise<RefreshRoomInviteResponse> => {
    const client = getDiscordClient()
    const { guildId } = getSecrets()

    const channel = await client.getChannel(data.channelId)
    const resolvedGuildId = channel.guild_id ?? guildId

    const invite = await createRoomInviteToken({
      guildId: resolvedGuildId,
      channelId: data.channelId,
      roleId: data.roleId,
      creatorId: data.creatorId,
      expiresInSeconds: data.tokenTtlSeconds,
      maxSeats: data.maxSeats,
      roomName: channel.name,
    })

    const permissionOverwrites = mapPermissionOverwrites(
      channel.permission_overwrites as PermissionOverwrite[] | undefined,
    )

    const response = {
      room: mapChannelToSummary(
        channel,
        resolvedGuildId,
        data.roleId,
        permissionOverwrites,
      ),
      invite: {
        token: invite.token,
        issuedAt: invite.issuedAt,
        expiresAt: invite.expiresAt,
        shareUrl: buildShareUrl(
          data.shareUrlBase,
          data.channelId,
          invite.token,
        ),
        maxSeats: data.maxSeats,
      },
    }

    return RefreshRoomInviteResponseSchema.parse(response)
  })

export const deleteRoom = createServerFn({ method: 'POST' })
  .inputValidator((data: { channelId: string }) => data)
  .handler(async ({ data: { channelId } }) => {
    const client = getDiscordClient()

    await client.deleteChannel(channelId, 'Deleted by Spell Coven app')

    console.log(`[Discord] Deleted voice channel: ${channelId}`)

    return DeleteRoomResponseSchema.parse({ ok: true })
  })

export const listRooms = createServerFn({ method: 'POST' })
  .inputValidator((data: { onlyGameRooms?: boolean }) => data)
  .handler(async ({ data: options }): Promise<ListRoomsResult[]> => {
    const { onlyGameRooms = false } = options || {}
    const client = getDiscordClient()
    const { guildId } = getSecrets()

    const channels = await client.getChannels(guildId)

    let voiceChannels = channels.filter((channel) => channel.type === 2)

    if (onlyGameRooms) {
      voiceChannels = voiceChannels.filter((channel) =>
        channel.name?.startsWith('🎮 '),
      )
    }

    return voiceChannels.map((channel) => ({
      id: channel.id,
      name: channel.name || 'Voice Channel',
      createdAt: new Date().toISOString(),
    }))
  })

export const joinRoom = createServerFn({ method: 'POST' })
  .inputValidator((data: JoinRoomRequest) => JoinRoomRequestSchema.parse(data))
  .handler(async ({ data }): Promise<JoinRoomResponse> => {
    const client = getDiscordClient()

    // 1) Verify invite token first (without seat check to avoid cyclic reference)
    const claims = await verifyRoomInviteToken(data.token)

    // (Optional) You can enforce capacity here if desired:
    // const current = await client.countVoiceChannelMembers(claims.guild_id, claims.channel_id)
    // await verifyRoomInviteToken(data.token, { currentSeatCount: current })

    // 2) Ensure the user is in the guild (requires OAuth access token)
    await client.ensureUserInGuild(claims.guild_id, data.userId, {
      access_token: data.accessToken,
    })

    // 3) Assign the room role to the user
    await client.addMemberRole(
      claims.guild_id,
      data.userId,
      claims.role_id,
      'Spell Coven: grant room role via invite token',
    )

    // 4) Fetch the channel and return a summary for the UI
    const channel = await client.getChannel(claims.channel_id)
    const permissionOverwrites = mapPermissionOverwrites(
      channel.permission_overwrites as PermissionOverwrite[] | undefined,
    )

    const response = {
      room: mapChannelToSummary(
        channel,
        claims.guild_id,
        claims.role_id,
        permissionOverwrites,
      ),
    }

    return JoinRoomResponseSchema.parse(response)
  })

export const connectUserToVoiceChannel = createServerFn({ method: 'POST' })
  .inputValidator((data: { guildId: string; channelId: string; userId: string }) => data)
  .handler(async ({ data: { guildId, channelId, userId } }) => {
    try {
      const client = getDiscordClient()

      console.log(
        `[Discord] Connecting user ${userId} to voice channel ${channelId}`,
      )

      // Use the Discord API to move the user to the voice channel
      // This requires the bot to have MOVE_MEMBERS permission
      const response = await client.addGuildMember(
        guildId,
        userId,
        {
          access_token: '', // Not needed for bot requests
          channel_id: channelId,
        },
        'Spell Coven: auto-connect to voice channel',
      )

      console.log(
        `[Discord] Successfully connected user ${userId} to voice channel ${channelId}`,
      )

      return { success: true, member: response }
    } catch (error) {
      console.error(
        `[Discord] Failed to connect user to voice channel:`,
        error instanceof Error ? error.message : error,
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      }
    }
  })

export const getVoiceChannelMembers = createServerFn({ method: 'POST' })
  .inputValidator((data: { guildId: string; channelId: string }) => data)
  .handler(async ({ data: { guildId, channelId } }) => {
    try {
      const client = getDiscordClient()

      console.log(
        `[Discord] Fetching voice states for guild ${guildId}, channel ${channelId}`,
      )

      // Fetch all voice states for the channel
      const voiceStates = await client.getChannelVoiceStates(guildId, channelId)

      console.log(
        `[Discord] Found ${voiceStates.length} voice states in channel ${channelId}:`,
        voiceStates.map((vs) => ({ userId: vs.user_id, channelId: vs.channel_id })),
      )

      // For each voice state, fetch the guild member to get user data
      const members = await Promise.all(
        voiceStates.map(async (voiceState) => {
          try {
            const member = await client.getGuildMember(guildId, voiceState.user_id)
            return {
              userId: voiceState.user_id,
              username: member.user?.username || 'Unknown User',
              avatar: member.user?.avatar || null,
              channelId: voiceState.channel_id,
            }
          } catch (error) {
            console.error(
              `[Discord] Failed to fetch member ${voiceState.user_id}:`,
              error,
            )
            return {
              userId: voiceState.user_id,
              username: 'Unknown User',
              avatar: null,
              channelId: voiceState.channel_id,
            }
          }
        }),
      )

      console.log(
        `[Discord] Fetched ${members.length} members from voice channel ${channelId}`,
        members,
      )

      return { members }
    } catch (error) {
      console.error(
        '[Discord] Error fetching voice channel members:',
        error instanceof Error ? error.message : error,
      )
      return {
        members: [],
        error: error instanceof Error ? error.message : 'Failed to fetch members',
      }
    }
  })

