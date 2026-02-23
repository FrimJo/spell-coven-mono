/**
 * WebRTC Signaling Mutations & Queries
 *
 * Handles SDP offers/answers and ICE candidates for peer connections.
 *
 * NOTE: These functions accept userId as parameter for Phase 3.
 * Phase 5 will use getAuthUserId for proper authorization.
 */

import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'

import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalMutation, mutation, query } from './_generated/server'
import { AuthRequiredError } from './errors'

/**
 * Signal TTL in milliseconds (60 seconds)
 */
const SIGNAL_TTL_MS = 60_000
const PRESENCE_THRESHOLD_MS = 30_000

async function requireActiveRoomMember(
  ctx: MutationCtx | QueryCtx,
  roomId: string,
  userId: string,
): Promise<void> {
  const presenceThreshold = Date.now() - PRESENCE_THRESHOLD_MS
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

/**
 * Send a signaling message
 *
 * @param toUserId - Target user ID, or null for broadcast to all peers
 * @param payload - Signal payload (SDP, ICE candidate, etc.)
 *
 * NOTE: fromUserId is passed as parameter for Phase 3. Phase 5 will use getAuthUserId.
 */
export const sendSignal = mutation({
  args: {
    roomId: v.string(),
    toUserId: v.union(v.string(), v.null()),
    payload: v.any(),
  },
  handler: async (ctx, { roomId, toUserId, payload }) => {
    const fromUserId = await getAuthUserId(ctx)
    if (!fromUserId) {
      throw new AuthRequiredError()
    }

    await requireActiveRoomMember(ctx, roomId, fromUserId)
    await ctx.db.insert('roomSignals', {
      roomId,
      fromUserId,
      toUserId,
      payload,
      createdAt: Date.now(),
    })
  },
})

/**
 * List signals for a user since a given timestamp
 *
 * Runs two targeted index queries (direct + broadcast) to avoid reading
 * signals destined for other peers. Results are merged and sorted by
 * createdAt so the caller sees a consistent timeline.
 */
export const listSignals = query({
  args: {
    roomId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, { roomId, since = 0 }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new AuthRequiredError()
    }

    await requireActiveRoomMember(ctx, roomId, userId)

    // Targeted signals: toUserId === userId
    const directSignals = await ctx.db
      .query('roomSignals')
      .withIndex('by_roomId_toUserId_createdAt', (q) =>
        q.eq('roomId', roomId).eq('toUserId', userId).gt('createdAt', since),
      )
      .collect()

    // Broadcast signals: toUserId === null
    const broadcastSignals = await ctx.db
      .query('roomSignals')
      .withIndex('by_roomId_toUserId_createdAt', (q) =>
        q.eq('roomId', roomId).eq('toUserId', null).gt('createdAt', since),
      )
      .collect()

    const merged = [...directSignals, ...broadcastSignals]
      .filter((s) => s.fromUserId !== userId)
      .sort((a, b) => a.createdAt - b.createdAt)

    return merged
  },
})

/**
 * Clean up old signals for a specific room
 *
 * Removes signals older than SIGNAL_TTL_MS.
 * Should be called periodically (e.g., via scheduled function).
 */
export const cleanupSignals = internalMutation({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const threshold = Date.now() - SIGNAL_TTL_MS

    const oldSignals = await ctx.db
      .query('roomSignals')
      .withIndex('by_roomId_createdAt', (q) =>
        q.eq('roomId', roomId).lt('createdAt', threshold),
      )
      .collect()

    for (const signal of oldSignals) {
      await ctx.db.delete(signal._id)
    }

    return { deleted: oldSignals.length }
  },
})

/**
 * Clean up old signals across all rooms
 *
 * Internal mutation called by the cron job to remove expired signals.
 * Uses the global by_createdAt index to read only expired rows instead
 * of scanning the entire table.
 */
export const cleanupAllSignals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const threshold = Date.now() - SIGNAL_TTL_MS

    const oldSignals = await ctx.db
      .query('roomSignals')
      .withIndex('by_createdAt', (q) => q.lt('createdAt', threshold))
      .collect()

    for (const signal of oldSignals) {
      await ctx.db.delete(signal._id)
    }

    if (oldSignals.length > 0) {
      console.log(
        `[SignalCleanup] Deleted ${oldSignals.length} expired signals`,
      )
    }

    return { deleted: oldSignals.length }
  },
})
