/**
 * WebRTC signaling message types
 *
 * All signals are required to have type, from, to, and roomId fields.
 * No fallback values - missing fields indicate a bug.
 */

import { z } from 'zod'

// Base signal schema
const baseSignalSchema = z.object({
  type: z.string(),
  from: z.string().min(1, 'from is required'),
  to: z.string().min(1, 'to is required'),
  roomId: z.string().min(1, 'roomId is required'),
})

// Offer signal
export const offerSignalSchema = baseSignalSchema.extend({
  type: z.literal('offer'),
  payload: z.object({
    sdp: z.string().min(1, 'sdp is required'),
  }),
})

export type OfferSignal = z.infer<typeof offerSignalSchema>

// Answer signal
export const answerSignalSchema = baseSignalSchema.extend({
  type: z.literal('answer'),
  payload: z.object({
    sdp: z.string().min(1, 'sdp is required'),
  }),
})

export type AnswerSignal = z.infer<typeof answerSignalSchema>

// Candidate signal
export const candidateSignalSchema = baseSignalSchema.extend({
  type: z.literal('candidate'),
  payload: z.object({
    candidate: z.string().min(1, 'candidate is required'),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().nullable().optional(),
    usernameFragment: z.string().nullable().optional(),
  }),
})

export type CandidateSignal = z.infer<typeof candidateSignalSchema>

// Leave signal
export const leaveSignalSchema = baseSignalSchema.extend({
  type: z.literal('leave'),
})

export type LeaveSignal = z.infer<typeof leaveSignalSchema>

// Union type
export const webRTCSignalSchema = z.discriminatedUnion('type', [
  offerSignalSchema,
  answerSignalSchema,
  candidateSignalSchema,
  leaveSignalSchema,
])

export type WebRTCSignal =
  | OfferSignal
  | AnswerSignal
  | CandidateSignal
  | LeaveSignal

/**
 * Validate a WebRTC signal
 */
export function validateWebRTCSignal(
  data: unknown,
): { success: true; data: WebRTCSignal } | { success: false; error: Error } {
  try {
    const result = webRTCSignalSchema.safeParse(data)
    if (result.success) {
      return { success: true, data: result.data }
    }
    return {
      success: false,
      error: new Error(`Invalid WebRTC signal: ${result.error.message}`),
    }
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err
          : new Error('Unknown error validating WebRTC signal'),
    }
  }
}
