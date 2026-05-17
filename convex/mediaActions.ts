'use node'

import type { VideoGrant } from 'livekit-server-sdk'
import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { AccessToken } from 'livekit-server-sdk'

import { internal } from './_generated/api'
import { action } from './_generated/server'
import { getLiveKitEnv } from './env'
import { AuthRequiredError } from './errors'

const tokenTtl = '10m'

interface ActiveMediaSession {
  roomId: string
  sessionId: string
  userId: string
  username: string
  avatar?: string
}

interface LiveKitTokenResponse {
  serverUrl: string
  token: string
}

export const issueLiveKitToken = action({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
  },
  returns: v.object({
    serverUrl: v.string(),
    token: v.string(),
  }),
  handler: async (
    ctx,
    { roomId, sessionId },
  ): Promise<LiveKitTokenResponse> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new AuthRequiredError()
    }

    const session: ActiveMediaSession = await ctx.runQuery(
      internal.mediaAuth.getActiveMediaSession,
      {
        roomId,
        sessionId,
        userId,
        now: Date.now(),
      },
    )

    const { serverUrl, apiKey, apiSecret } = getLiveKitEnv()
    const metadata = JSON.stringify({
      userId: session.userId,
      username: session.username,
      avatar: session.avatar ?? null,
    })

    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: session.sessionId,
      name: session.username,
      metadata,
      attributes: {
        userId: session.userId,
        username: session.username,
        avatar: session.avatar ?? '',
      },
      ttl: tokenTtl,
    })

    const grant: VideoGrant = {
      room: session.roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    }
    accessToken.addGrant(grant)

    return {
      serverUrl,
      token: await accessToken.toJwt(),
    }
  },
})
