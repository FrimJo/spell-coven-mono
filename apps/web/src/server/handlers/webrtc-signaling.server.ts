import { env } from '@/env'
import { createServerFn } from '@tanstack/react-start'

import { sseManager } from '../managers/sse-manager.js'

import {
  WebRTCSignalEnvelopeSchema,
  type WebRTCSignalEnvelope,
} from '@/types/webrtc'

export const broadcastWebRTCSignal = createServerFn({ method: 'POST' })
  .inputValidator((data: WebRTCSignalEnvelope) =>
    WebRTCSignalEnvelopeSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const payload: WebRTCSignalEnvelope = {
      ...data,
      targetUserId: data.targetUserId ?? null,
    }

    sseManager.broadcastCustomEventToGuild(
      env.VITE_DISCORD_GUILD_ID,
      'webrtc.signal',
      payload,
    )

    return { ok: true }
  })
