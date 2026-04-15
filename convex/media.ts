'use node'

import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { SignJWT } from 'jose'
import z from 'zod'

import { mutation } from './_generated/server'
import { AuthRequiredError } from './errors'

const PRESENCE_THRESHOLD_MS = 30_000
const ACCESS_TOKEN_TTL_SECONDS = 60 * 10

const liveKitEnvSchema = z.object({
  LIVEKIT_URL: z.string().url('LIVEKIT_URL must be a valid LiveKit ws(s) URL'),
  LIVEKIT_API_KEY: z.string().min(1, 'LIVEKIT_API_KEY is required'),
  LIVEKIT_API_SECRET: z.string().min(1, 'LIVEKIT_API_SECRET is required'),
})

export const issueAccessToken = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, { roomId, sessionId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new AuthRequiredError()
    }

    const presenceThreshold = Date.now() - PRESENCE_THRESHOLD_MS
    const member = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_sessionId', (q) =>
        q.eq('roomId', roomId).eq('sessionId', sessionId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), userId),
          q.neq(q.field('status'), 'left'),
          q.gt(q.field('lastSeenAt'), presenceThreshold),
        ),
      )
      .first()

    if (!member) {
      throw new AuthRequiredError('Active room membership required')
    }

    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } =
      liveKitEnvSchema.parse({
        LIVEKIT_URL: process.env.LIVEKIT_URL,
        LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
      })

    const metadata = JSON.stringify({
      roomId,
      sessionId: member.sessionId,
      userId: member.userId,
      username: member.username,
    })

    const issuedAt = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({
      name: member.username,
      metadata,
      video: {
        room: roomId,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canPublishSources: ['camera', 'microphone'],
      },
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(LIVEKIT_API_KEY)
      .setSubject(member.sessionId)
      .setIssuedAt(issuedAt)
      .setNotBefore(issuedAt - 5)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
      .sign(new TextEncoder().encode(LIVEKIT_API_SECRET))

    return {
      token,
      url: LIVEKIT_URL,
      roomName: roomId,
      participantIdentity: member.sessionId,
      metadata,
    }
  },
})
