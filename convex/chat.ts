/**
 * Chat Mutations & Queries
 *
 * Handles sending and listing room-scoped chat messages.
 */

import { getAuthUserId } from '@convex-dev/auth/server'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { AuthRequiredError, RoomNotFoundError } from './errors'

/**
 * Presence timeout threshold in milliseconds (30 seconds)
 */
const PRESENCE_THRESHOLD_MS = 30_000

/**
 * Maximum chat message length
 */
const MAX_MESSAGE_LENGTH = 500

async function requireActiveRoomMember(
  ctx: MutationCtx | QueryCtx,
  roomId: string,
  userId: string,
) {
  const presenceThreshold = Date.now() - PRESENCE_THRESHOLD_MS
  const member = await ctx.db
    .query('roomPlayers')
    .withIndex('by_roomId_userId', (q) => q.eq('roomId', roomId).eq('userId', userId))
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

  return member
}

/**
 * Send a chat message to a room
 */
export const sendMessage = mutation({
  args: {
    roomId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { roomId, message }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new AuthRequiredError()
    }

    const trimmedMessage = message.trim()
    if (!trimmedMessage || trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      throw new Error('Invalid message length')
    }

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new RoomNotFoundError()
    }

    const member = await requireActiveRoomMember(ctx, roomId, userId)

    await ctx.db.insert('roomChat', {
      roomId,
      userId,
      username: member.username,
      message: trimmedMessage,
      createdAt: Date.now(),
    })

    await ctx.db.patch(room._id, { lastActivityAt: Date.now() })
  },
})

/**
 * List chat messages in a room (paginated, newest first)
 */
export const listMessages = query({
  args: {
    roomId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { roomId, paginationOpts }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new AuthRequiredError()
    }

    await requireActiveRoomMember(ctx, roomId, userId)

    return ctx.db
      .query('roomChat')
      .withIndex('by_roomId_createdAt', (q) => q.eq('roomId', roomId))
      .order('desc')
      .paginate(paginationOpts)
  },
})
