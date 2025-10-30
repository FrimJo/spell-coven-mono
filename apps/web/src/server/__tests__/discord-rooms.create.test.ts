import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelResponse } from '@repo/discord-integration/types'

import { createRoom, refreshRoomInvite } from '../discord-rooms'

const createRoleMock = vi.fn()
const createVoiceChannelMock = vi.fn()
const getChannelMock = vi.fn()
const getChannelsMock = vi.fn()
const ensureUserInGuildMock = vi.fn()
const deleteChannelMock = vi.fn()

vi.mock('@repo/discord-integration/clients', () => {
  return {
    DiscordRestClient: vi.fn().mockImplementation(() => ({
      createRole: createRoleMock,
      createVoiceChannel: createVoiceChannelMock,
      getChannel: getChannelMock,
      getChannels: getChannelsMock,
      ensureUserInGuild: ensureUserInGuildMock,
      deleteChannel: deleteChannelMock,
    })),
  }
})

describe('discord-rooms create/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DISCORD_BOT_TOKEN = 'bot-token'
    process.env.PRIMARY_GUILD_ID = '123456789012345678'
    process.env.VITE_DISCORD_CLIENT_ID = '987654321098765432'
    process.env.ROOM_TOKEN_SECRET =
      'integration-test-secret-that-is-long-enough-to-pass'

    createRoleMock.mockResolvedValue({
      id: '555555555555555555',
      name: 'room-abc12345',
      permissions: '0',
      color: 0,
      hoist: false,
      managed: false,
      mentionable: false,
      position: 1,
    })

    const baseChannel: ChannelResponse = {
      id: '666666666666666666',
      guild_id: '123456789012345678',
      type: 2,
      name: "🎮 Test Creator's Room",
      permission_overwrites: [
        {
          id: '123456789012345678',
          type: 0,
          allow: '0',
          deny: '3072',
        },
        {
          id: '555555555555555555',
          type: 0,
          allow: '2105344',
          deny: '0',
        },
        {
          id: '987654321098765432',
          type: 1,
          allow: '2146958591',
          deny: '0',
        },
      ],
    }

    createVoiceChannelMock.mockResolvedValue({
      ...baseChannel,
      user_limit: 4,
    })

    getChannelMock.mockResolvedValue({
      ...baseChannel,
      user_limit: 4,
    })

    getChannelsMock.mockResolvedValue([
      { ...baseChannel, type: 2 },
      { ...baseChannel, id: '999', type: 0 },
    ])
  })

  it('creates a room with invite metadata and share URL', async () => {
    const result = await createRoom({
      data: {
        creatorId: '444444444444444444',
        name: "🎮 Test Creator's Room",
        userLimit: 4,
        maxSeats: 4,
        tokenTtlSeconds: 900,
        includeCreatorOverwrite: true,
        shareUrlBase: 'https://app.example.com',
      },
    })

    expect(createRoleMock).toHaveBeenCalledTimes(1)
    expect(createVoiceChannelMock).toHaveBeenCalledTimes(1)

    expect(result.room.channelId).toBe('666666666666666666')
    expect(result.room.roleId).toBe('555555555555555555')
    expect(result.invite.shareUrl).toMatch(
      /^https:\/\/app\.example\.com\/game\/666666666666666666\?t=/,
    )
    expect(result.invite.expiresAt).toBeGreaterThan(result.invite.issuedAt)
  })

  it('refreshes a room invite without creating new Discord resources', async () => {
    const first = await createRoom({
      data: {
        creatorId: '444444444444444444',
        name: 'Refreshable Room',
        userLimit: 4,
        tokenTtlSeconds: 30 * 60,
        includeCreatorOverwrite: true,
        shareUrlBase: 'https://app.example.com',
      },
    })

    const refreshed = await refreshRoomInvite({
      data: {
        channelId: first.room.channelId,
        roleId: first.room.roleId,
        creatorId: '444444444444444444',
        shareUrlBase: 'https://app.example.com',
        tokenTtlSeconds: 1200,
      },
    })

    expect(createRoleMock).toHaveBeenCalledTimes(1)
    expect(createVoiceChannelMock).toHaveBeenCalledTimes(1)
    expect(getChannelMock).toHaveBeenCalledTimes(1)

    expect(refreshed.room.channelId).toBe(first.room.channelId)
    expect(refreshed.invite.token).not.toBe(first.invite.token)
    expect(refreshed.invite.shareUrl).not.toBe(first.invite.shareUrl)
  })
})
