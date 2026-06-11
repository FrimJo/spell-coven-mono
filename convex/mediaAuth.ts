import { v } from 'convex/values'

import { internalQuery } from './_generated/server'
import {
  AuthMismatchError,
  AuthRequiredError,
  RoomNotFoundError,
} from './errors'
import { PRESENCE_THRESHOLD_MS } from './players'

const activeSessionReturn = v.object({
  roomId: v.string(),
  sessionId: v.string(),
  userId: v.string(),
  username: v.string(),
  avatar: v.optional(v.string()),
})

export const getActiveMediaSession = internalQuery({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
    userId: v.string(),
    now: v.number(),
  },
  returns: activeSessionReturn,
  handler: async (ctx, { roomId, sessionId, userId, now }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new RoomNotFoundError()
    }

    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_sessionId', (q) =>
        q.eq('roomId', roomId).eq('sessionId', sessionId),
      )
      .first()

    if (!player || player.status === 'left') {
      throw new AuthRequiredError('Active room session required')
    }

    if (player.userId !== userId) {
      throw new AuthMismatchError()
    }

    if (now - player.lastSeenAt > PRESENCE_THRESHOLD_MS) {
      throw new AuthRequiredError('Active room session required')
    }

    return {
      roomId: player.roomId,
      sessionId: player.sessionId,
      userId: player.userId,
      username: player.username,
      avatar: player.avatar,
    }
  },
})
