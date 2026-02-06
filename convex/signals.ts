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
import { sentryMutation, sentryQuery, withDbSpan } from './sentry'

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
export const sendSignal = mutation(
  sentryMutation(
    'signals.sendSignal',
    {
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
        await withDbSpan('roomSignals.insert', () =>
          ctx.db.insert('roomSignals', {
            roomId,
            fromUserId,
            toUserId,
            payload,
            createdAt: Date.now(),
          }),
        )
      },
    },
    {
      safeArgs: ['roomId'],
      tags: { domain: 'signals' },
    },
  ),
)

/**
 * List signals for a user since a given timestamp
 *
 * Returns signals where:
 * - toUserId matches the requesting user, OR
 * - toUserId is null (broadcast)
 *
 * Filters out signals from the requesting user.
 *
 * NOTE: userId is passed as parameter for Phase 3. Phase 5 will use getAuthUserId.
 */
export const listSignals = query(
  sentryQuery(
    'signals.listSignals',
    {
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

        const signals = await withDbSpan(
          'roomSignals.by_roomId_createdAt',
          () =>
            ctx.db
              .query('roomSignals')
              .withIndex('by_roomId_createdAt', (q) =>
                q.eq('roomId', roomId).gt('createdAt', since),
              )
              .collect(),
        )

        // Filter to signals intended for this user or broadcast
        return signals.filter(
          (s) =>
            s.fromUserId !== userId &&
            (s.toUserId === null || s.toUserId === userId),
        )
      },
    },
    {
      safeArgs: ['roomId'],
      tags: { domain: 'signals' },
    },
  ),
)

/**
 * Clean up old signals for a specific room
 *
 * Removes signals older than SIGNAL_TTL_MS.
 * Should be called periodically (e.g., via scheduled function).
 */
export const cleanupSignals = mutation(
  sentryMutation(
    'signals.cleanupSignals',
    {
      args: { roomId: v.string() },
      handler: async (ctx, { roomId }) => {
        const threshold = Date.now() - SIGNAL_TTL_MS

        const oldSignals = await withDbSpan(
          'roomSignals.by_roomId_createdAt',
          () =>
            ctx.db
              .query('roomSignals')
              .withIndex('by_roomId_createdAt', (q) =>
                q.eq('roomId', roomId).lt('createdAt', threshold),
              )
              .collect(),
        )

        for (const signal of oldSignals) {
          await withDbSpan('roomSignals.delete', () =>
            ctx.db.delete(signal._id),
          )
        }

        return { deleted: oldSignals.length }
      },
    },
    {
      safeArgs: ['roomId'],
      tags: { domain: 'signals' },
    },
  ),
)

/**
 * Clean up old signals across all rooms
 *
 * Internal mutation called by the cron job to remove expired signals.
 * Removes signals older than SIGNAL_TTL_MS from all rooms.
 */
export const cleanupAllSignals = internalMutation(
  sentryMutation(
    'signals.cleanupAllSignals',
    {
      args: {},
      handler: async (ctx) => {
        const threshold = Date.now() - SIGNAL_TTL_MS

        // Query all signals and filter by createdAt
        // Note: Without a global createdAt index, we scan all signals
        const allSignals = await withDbSpan('roomSignals.scan', () =>
          ctx.db.query('roomSignals').collect(),
        )

        const oldSignals = allSignals.filter((s) => s.createdAt < threshold)

        let deleted = 0
        for (const signal of oldSignals) {
          await withDbSpan('roomSignals.delete', () =>
            ctx.db.delete(signal._id),
          )
          deleted++
        }

        if (deleted > 0) {
          console.log(`[SignalCleanup] Deleted ${deleted} expired signals`)
        }

        return { deleted }
      },
    },
    {
      tags: { domain: 'signals', scope: 'cron' },
    },
  ),
)
