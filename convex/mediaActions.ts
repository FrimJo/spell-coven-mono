'use node'

import type { VideoGrant } from 'livekit-server-sdk'
import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { AccessToken } from 'livekit-server-sdk'

import type { ActionCtx } from './_generated/server'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import { getLiveKitEnv } from './env'
import { AuthRequiredError } from './errors'
import { withConvexSentry } from './sentry'

// Long enough for typical game sessions; LiveKit reconnects with the same JWT.
const tokenTtl = '6h'

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
  handler: withConvexSentry(
    { feature: 'media', operation: 'issue_livekit_token' },
    async (
      ctx: ActionCtx,
      { roomId, sessionId }: { roomId: string; sessionId: string },
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

      const accessToken = new AccessToken(apiKey, apiSecret, {
        identity: session.sessionId,
        name: session.username,
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
  ),
})
