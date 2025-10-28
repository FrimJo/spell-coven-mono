import { randomUUID } from 'node:crypto'

import { createServerOnlyFn } from '@tanstack/react-start'
import { jwtVerify, SignJWT } from 'jose'
import {
  RoomInviteClaimsSchema,
  type RoomInviteClaims,
  type RoomTokenErrorCode,
} from './schemas'

const encoder = new TextEncoder()

const getRoomTokenSecret = createServerOnlyFn(() => {
  const secret = process.env.ROOM_TOKEN_SECRET

  if (!secret?.length) {
    throw new Error('ROOM_TOKEN_SECRET environment variable is not defined')
  }

  if (secret.length < 32) {
    console.warn(
      '[room-tokens] ROOM_TOKEN_SECRET should be at least 32 characters long for security.',
    )
  }

  return encoder.encode(secret)
})

export const RoomTokenVersion = 1 as const
export const RoomTokenPurpose = 'voice-room' as const

export interface CreateRoomInviteTokenInput {
  guildId: string
  channelId: string
  roleId: string
  creatorId: string
  expiresInSeconds: number
  maxSeats?: number
  roomName?: string
  jti?: string
}

export interface CreateRoomInviteTokenResult {
  token: string
  issuedAt: number
  expiresAt: number
  claims: RoomInviteClaims
}

export class RoomTokenError extends Error {
  constructor(
    message: string,
    public readonly code: RoomTokenErrorCode,
  ) {
    super(message)
    this.name = 'RoomTokenError'
  }
}

export interface VerifyRoomInviteTokenOptions {
  expectedPurpose?: typeof RoomTokenPurpose
  now?: number
  currentSeatCount?: number
}

export async function createRoomInviteToken(
  input: CreateRoomInviteTokenInput,
): Promise<CreateRoomInviteTokenResult> {
  const secret = await getRoomTokenSecret()
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + Math.max(60, Math.floor(input.expiresInSeconds))

  const claims: RoomInviteClaims = {
    v: RoomTokenVersion,
    purpose: RoomTokenPurpose,
    guild_id: input.guildId,
    channel_id: input.channelId,
    role_id: input.roleId,
    creator_id: input.creatorId,
    max_seats:
      typeof input.maxSeats === 'number' && input.maxSeats > 0
        ? Math.floor(input.maxSeats)
        : undefined,
    room_name: input.roomName,
    jti: input.jti ?? randomUUID(),
    iat: issuedAt,
    exp: expiresAt,
  }

  const token = await new SignJWT({
    v: claims.v,
    purpose: claims.purpose,
    guild_id: claims.guild_id,
    channel_id: claims.channel_id,
    role_id: claims.role_id,
    creator_id: claims.creator_id,
    max_seats: claims.max_seats,
    room_name: claims.room_name,
    jti: claims.jti,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secret)

  return { token, issuedAt, expiresAt, claims }
}

export async function verifyRoomInviteToken(
  token: string,
  options: VerifyRoomInviteTokenOptions = {},
): Promise<RoomInviteClaims> {
  const secret = await getRoomTokenSecret()
  const expectedPurpose = options.expectedPurpose ?? RoomTokenPurpose

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    })

    const claims = RoomInviteClaimsSchema.parse({
      ...payload,
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    })

    if (claims.purpose !== expectedPurpose) {
      throw new RoomTokenError('Invite token has unexpected purpose', 'TOKEN_INVALID')
    }

    const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000)
    if (claims.exp <= nowSeconds) {
      throw new RoomTokenError('Invite token has expired', 'TOKEN_EXPIRED')
    }

    if (
      typeof claims.max_seats === 'number' &&
      typeof options.currentSeatCount === 'number' &&
      options.currentSeatCount >= claims.max_seats
    ) {
      throw new RoomTokenError('Room has reached capacity', 'ROOM_FULL')
    }

    return claims
  } catch (error) {
    if (error instanceof RoomTokenError) {
      throw error
    }

    if (error && typeof error === 'object' && 'code' in error) {
      if ((error as { code?: string }).code === 'ERR_JWT_EXPIRED') {
        throw new RoomTokenError('Invite token has expired', 'TOKEN_EXPIRED')
      }
    }

    throw new RoomTokenError(
      error instanceof Error ? error.message : 'Invite token verification failed',
      'TOKEN_INVALID',
    )
  }
}

export type { RoomInviteClaims, RoomTokenErrorCode } from './schemas'
