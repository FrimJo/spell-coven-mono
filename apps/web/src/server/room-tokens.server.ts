import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServerOnlyFn } from '@tanstack/react-start'

import type { RoomInviteClaims, RoomTokenErrorCode } from './schemas/schemas.js'
import { RoomInviteClaimsSchema } from './schemas/schemas.js'

type JwtPayload = Record<string, unknown>

type JwtHeader = {
  alg: string
  typ?: string
}

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

function base64UrlEncode(data: string | Uint8Array): string {
  const buffer =
    typeof data === 'string' ? Buffer.from(data) : Buffer.from(data)
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  const padded =
    padding === 0 ? normalized : normalized + '='.repeat((4 - padding) % 4)
  return Buffer.from(padded, 'base64')
}

function toBuffer(secret: Uint8Array | string): Buffer {
  return typeof secret === 'string' ? Buffer.from(secret) : Buffer.from(secret)
}

function createJwtToken(
  header: JwtHeader,
  payload: JwtPayload,
  secret: Uint8Array | string,
): string {
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const signature = createHmac('sha256', toBuffer(secret))
    .update(signingInput)
    .digest()

  return `${signingInput}.${base64UrlEncode(signature)}`
}

function verifyHs256Token(
  token: string,
  secret: Uint8Array | string,
): { header: JwtHeader; payload: JwtPayload } {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new RoomTokenError(
      'Invite token verification failed',
      'TOKEN_INVALID',
    )
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = JSON.parse(
    base64UrlDecode(encodedHeader).toString('utf-8'),
  ) as JwtHeader
  const payload = JSON.parse(
    base64UrlDecode(encodedPayload).toString('utf-8'),
  ) as JwtPayload

  if (header.alg !== 'HS256') {
    throw new RoomTokenError(
      'Invite token verification failed',
      'TOKEN_INVALID',
    )
  }

  const expectedSignature = createHmac('sha256', toBuffer(secret))
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest()
  const actualSignature = base64UrlDecode(encodedSignature)

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new RoomTokenError(
      'Invite token verification failed',
      'TOKEN_INVALID',
    )
  }

  return { header, payload }
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

  const token = createJwtToken({ alg: 'HS256', typ: 'JWT' }, claims, secret)

  return { token, issuedAt, expiresAt, claims }
}

export async function verifyRoomInviteToken(
  token: string,
  options: VerifyRoomInviteTokenOptions = {},
): Promise<RoomInviteClaims> {
  const secret = await getRoomTokenSecret()
  const expectedPurpose = options.expectedPurpose ?? RoomTokenPurpose

  try {
    const { payload } = verifyHs256Token(token, secret)

    const claims = RoomInviteClaimsSchema.parse({
      ...payload,
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    })

    if (claims.purpose !== expectedPurpose) {
      throw new RoomTokenError(
        'Invite token has unexpected purpose',
        'TOKEN_INVALID',
      )
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
      error instanceof Error
        ? error.message
        : 'Invite token verification failed',
      'TOKEN_INVALID',
    )
  }
}

export type { RoomInviteClaims, RoomTokenErrorCode } from './schemas/schemas.js'
