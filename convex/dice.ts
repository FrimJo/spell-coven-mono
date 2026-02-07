/**
 * Dice roll mutations & queries
 *
 * Provides authoritative dice roll results for game rooms.
 */

import { randomBytes } from 'crypto'
import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'

import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { AuthRequiredError, RoomNotFoundError } from './errors'

const MAX_SIDES = 1000
const MAX_COUNT = 20
const UINT32_MAX_PLUS_ONE = 2 ** 32

async function requireActiveRoomMember(
  ctx: MutationCtx,
  roomId: string,
  userId: string,
): Promise<void> {
  const presenceThreshold = Date.now() - 30_000
  const member = await ctx.db
    .query('roomPlayers')
    .withIndex('by_roomId_userId', (q) =>
      q.eq('roomId', roomId).eq('userId', userId),
    )
    .filter((q) =>
      q.and(
        q.neq(q.field('status'), 'left'),
        q.gt(q.field('lastSeenAt'), presenceThreshold),
      ),
    )
    .first()

  if (!member) {
    throw new AuthRequiredError('Active room membership required')
  }
}

async function updateRoomActivity(
  ctx: MutationCtx,
  roomId: string,
): Promise<void> {
  const room = await ctx.db
    .query('rooms')
    .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
    .first()

  if (!room) {
    throw new RoomNotFoundError()
  }

  await ctx.db.patch(room._id, { lastActivityAt: Date.now() })
}

function getRandomUint32(): number {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const buffer = new Uint32Array(1)
    cryptoApi.getRandomValues(buffer)
    return buffer[0]!
  }

  const buffer = randomBytes(4)
  return (
    (buffer[0]! << 24) |
    (buffer[1]! << 16) |
    (buffer[2]! << 8) |
    buffer[3]!
  ) >>> 0
}

function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be a positive integer')
  }

  if (maxExclusive > UINT32_MAX_PLUS_ONE) {
    throw new Error('maxExclusive exceeds RNG range')
  }

  const bucketSize = Math.floor(UINT32_MAX_PLUS_ONE / maxExclusive)
  const maxUnbiased = bucketSize * maxExclusive

  let candidate = getRandomUint32()
  while (candidate >= maxUnbiased) {
    candidate = getRandomUint32()
  }

  return candidate % maxExclusive
}

function rollDiceResults(sides: number, count: number): number[] {
  const results: number[] = []
  for (let i = 0; i < count; i += 1) {
    results.push(randomInt(sides) + 1)
  }
  return results
}

export const rollDice = mutation({
  args: {
    roomId: v.string(),
    sides: v.number(),
    count: v.number(),
  },
  handler: async (ctx, { roomId, sides, count }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new AuthRequiredError()
    }

    await requireActiveRoomMember(ctx, roomId, userId)

    const safeSides = Math.max(2, Math.min(MAX_SIDES, Math.floor(sides)))
    const safeCount = Math.max(1, Math.min(MAX_COUNT, Math.floor(count)))

    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    const results = rollDiceResults(safeSides, safeCount)
    const total = results.reduce((sum, value) => sum + value, 0)

    await ctx.db.insert('roomDiceRolls', {
      roomId,
      userId,
      username: player?.username ?? 'Unknown',
      sides: safeSides,
      count: safeCount,
      results,
      total,
      createdAt: Date.now(),
    })

    await updateRoomActivity(ctx, roomId)

    return { results, total }
  },
})

export const listRoomDiceRolls = query({
  args: {
    roomId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { roomId, limit }) => {
    const safeLimit = Math.max(1, Math.min(100, limit ?? 50))

    return await ctx.db
      .query('roomDiceRolls')
      .withIndex('by_roomId_createdAt', (q) => q.eq('roomId', roomId))
      .order('desc')
      .take(safeLimit)
  },
})
