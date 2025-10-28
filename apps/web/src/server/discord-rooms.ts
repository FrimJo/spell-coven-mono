import { randomUUID } from 'node:crypto'

import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'

import { DiscordRestClient } from '@repo/discord-integration/clients'
import type { ChannelResponse } from '@repo/discord-integration/types'
import type { PermissionOverwrite } from '@repo/discord-integration/utils'
import { buildRoomPermissionOverwrites } from '@repo/discord-integration/utils'

import {
  CreateRoomRequestSchema,
  CreateRoomResponseSchema,
  DeleteRoomResponseSchema,
  RefreshRoomInviteRequestSchema,
  RefreshRoomInviteResponseSchema,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type RefreshRoomInviteRequest,
  type RefreshRoomInviteResponse,
  type RoomSummary,
} from './schemas'
import { createRoomInviteToken } from './room-tokens'

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
  const guildId = process.env.PRIMARY_GUILD_ID

  if (!botToken?.length) {
    throw new Error('DISCORD_BOT_TOKEN environment variable is not defined')
  }
  if (!guildId?.length) {
    throw new Error('PRIMARY_GUILD_ID environment variable is not defined')
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

const isPrivateRoomsEnabled = createServerOnlyFn(() => {
  const raw = process.env.ENABLE_PRIVATE_ROOMS
  return typeof raw === 'string' && raw.toLowerCase() === 'true'
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

function createDisabledInvite(options: {
  expiresInSeconds: number
  maxSeats?: number
}): {
  token: string
  issuedAt: number
  expiresAt: number
  maxSeats?: number
} {
  const issuedAt = Math.floor(Date.now() / 1000)
  const ttl = Math.max(60, Math.floor(options.expiresInSeconds))
  const expiresAt = issuedAt + ttl
  const token = randomUUID()

  return {
    token,
    issuedAt,
    expiresAt,
    maxSeats: options.maxSeats,
  }
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

      await client.ensureUserInGuild(userId, guildId, {
        access_token: accessToken,
      })
      return { inGuild: true }
    } catch (error) {
      console.error('[Discord] Error checking room:', error)
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
    const privateRoomsEnabled = isPrivateRoomsEnabled()

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

    const permissionOverwrites = privateRoomsEnabled
      ? buildRoomPermissionOverwrites({
          guildId,
          roleId: role.id,
          botUserId: getBotUserId(),
          creatorId: request.includeCreatorOverwrite
            ? request.creatorId
            : undefined,
        })
      : undefined

    const roomName = ensureRoomName(request.name)

    const channel = await client.createVoiceChannel(
      guildId,
      {
        name: roomName,
        parent_id: request.parentId,
        user_limit: request.userLimit,
        permission_overwrites: permissionOverwrites,
      },
      'Spell Coven: create private voice room channel',
    )

    const maxSeats = request.maxSeats ?? request.userLimit

    const invite = privateRoomsEnabled
      ? await createRoomInviteToken({
          guildId,
          channelId: channel.id,
          roleId: role.id,
          creatorId: request.creatorId,
          expiresInSeconds: request.tokenTtlSeconds,
          maxSeats,
          roomName: channel.name ?? roomName,
        })
      : createDisabledInvite({
          expiresInSeconds: request.tokenTtlSeconds,
          maxSeats,
        })

    const response = {
      room: mapChannelToSummary(channel, guildId, role.id, permissionOverwrites),
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
    if (!isPrivateRoomsEnabled()) {
      throw new Error('Private room invites are disabled')
    }
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
        shareUrl: buildShareUrl(data.shareUrlBase, data.channelId, invite.token),
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
