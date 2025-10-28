import { beforeEach, describe, expect, it } from 'vitest'

import {
  createRoomInviteToken,
  RoomTokenError,
  verifyRoomInviteToken,
} from '../room-tokens'

const baseInput = {
  guildId: '123456789012345678',
  channelId: '234567890123456789',
  roleId: '345678901234567890',
  creatorId: '456789012345678901',
}

describe('room-tokens', () => {
  beforeEach(() => {
    process.env.ROOM_TOKEN_SECRET =
      'test-secret-1234567890-super-secure-and-long'
  })

  it('creates tokens that verify successfully before expiry', async () => {
    const { token, expiresAt } = await createRoomInviteToken({
      ...baseInput,
      expiresInSeconds: 120,
      maxSeats: 5,
    })

    const claims = await verifyRoomInviteToken(token, {
      now: (expiresAt - 30) * 1000,
      currentSeatCount: 2,
    })

    expect(claims.guild_id).toBe(baseInput.guildId)
    expect(claims.channel_id).toBe(baseInput.channelId)
    expect(claims.max_seats).toBe(5)
  })

  it('throws RoomTokenError when token is expired', async () => {
    const { token, expiresAt } = await createRoomInviteToken({
      ...baseInput,
      expiresInSeconds: 30,
    })

    await expect(
      verifyRoomInviteToken(token, { now: (expiresAt + 10) * 1000 }),
    ).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    })
  })

  it('enforces max seat limits during verification', async () => {
    const { token } = await createRoomInviteToken({
      ...baseInput,
      expiresInSeconds: 120,
      maxSeats: 2,
    })

    await expect(
      verifyRoomInviteToken(token, { currentSeatCount: 2 }),
    ).rejects.toMatchObject({
      code: 'ROOM_FULL',
    })

    const claims = await verifyRoomInviteToken(token, { currentSeatCount: 1 })
    expect(claims.max_seats).toBe(2)
  })

  it('rejects tampered tokens with TOKEN_INVALID', async () => {
    const { token } = await createRoomInviteToken({
      ...baseInput,
      expiresInSeconds: 120,
    })

    const tampered = `${token.slice(0, -1)}${
      token.endsWith('a') ? 'b' : 'a'
    }`

    await expect(verifyRoomInviteToken(tampered)).rejects.toBeInstanceOf(
      RoomTokenError,
    )

    await expect(verifyRoomInviteToken(tampered)).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    })
  })
})
