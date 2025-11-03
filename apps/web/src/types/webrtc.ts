import { z } from 'zod'

export const WebRTCSignalPayloadSchema = z.object({
  type: z.enum(['ready', 'offer', 'answer', 'ice-candidate', 'leave']),
  sdp: z
    .object({
      type: z.enum(['offer', 'answer']),
      sdp: z.string(),
    })
    .optional(),
  candidate: z
    .object({
      candidate: z.string(),
      sdpMid: z.string().nullable().optional(),
      sdpMLineIndex: z.number().nullable().optional(),
      usernameFragment: z.string().optional(),
    })
    .optional(),
})

export type WebRTCSignalPayload = z.infer<typeof WebRTCSignalPayloadSchema>

export const WebRTCSignalEnvelopeSchema = z.object({
  gameId: z.string(),
  fromUserId: z.string(),
  targetUserId: z.string().nullable().optional(),
  signal: WebRTCSignalPayloadSchema,
})

export type WebRTCSignalEnvelope = z.infer<typeof WebRTCSignalEnvelopeSchema>

export function parseWebRTCSignalEnvelope(
  value: unknown,
): WebRTCSignalEnvelope | null {
  const result = WebRTCSignalEnvelopeSchema.safeParse(value)
  return result.success ? result.data : null
}
