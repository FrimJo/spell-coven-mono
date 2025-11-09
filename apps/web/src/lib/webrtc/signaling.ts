/**
 * WebRTC Signaling Types & Schemas
 * Type definitions and Zod schemas for signaling messages exchanged via SSE + createServerFn
 */

import { z } from 'zod'
import type { SignalingMessageType } from './types'

/**
 * Signaling payload for offer/answer messages
 */
export interface SDPPayload {
  type: 'offer' | 'answer'
  sdp: string
}

/**
 * Signaling payload for ICE candidate messages
 */
export interface IceCandidatePayload {
  candidate: string
  sdpMLineIndex: number | null
  sdpMid: string | null
}

/**
 * Union type for all signaling payloads
 */
export type SignalingPayload = SDPPayload | IceCandidatePayload

/**
 * Signaling message structure (client → server)
 */
export interface SignalingMessageRequest {
  roomId: string
  from: string // Sender's player ID
  to: string // Target player ID
  message: {
    type: SignalingMessageType
    payload: SignalingPayload
  }
}

/**
 * Signaling message structure (server → client via SSE)
 */
export interface SignalingMessageSSE {
  from: string
  roomId: string
  message: {
    type: SignalingMessageType
    payload: SignalingPayload
  }
}

/**
 * Zod schema for SDP payload (offer/answer)
 */
export const SDPPayloadSchema = z.object({
  type: z.enum(['offer', 'answer']),
  sdp: z.string().min(1, 'SDP must not be empty'),
})

/**
 * Zod schema for ICE candidate payload
 */
export const IceCandidatePayloadSchema = z.object({
  candidate: z.string().min(1, 'Candidate must not be empty'),
  sdpMLineIndex: z.number().int().nullable(),
  sdpMid: z.string().nullable(),
})

/**
 * Zod schema for signaling payload (union of SDP and ICE candidate)
 */
export const SignalingPayloadSchema = z.union([SDPPayloadSchema, IceCandidatePayloadSchema])

/**
 * Zod schema for signaling message request
 */
export const SignalingMessageRequestSchema = z.object({
  roomId: z.string().min(1, 'Room ID must not be empty'),
  from: z.string().min(1, 'Sender ID must not be empty'),
  to: z.string().min(1, 'Target ID must not be empty'),
  message: z.object({
    type: z.enum(['offer', 'answer', 'ice-candidate']),
    payload: SignalingPayloadSchema,
  }),
})

/**
 * Type guard for SDP payload
 */
export function isSDPPayload(
  payload: SignalingPayload,
): payload is SDPPayload {
  return SDPPayloadSchema.safeParse(payload).success
}

/**
 * Type guard for ICE candidate payload
 */
export function isIceCandidatePayload(
  payload: SignalingPayload,
): payload is IceCandidatePayload {
  return IceCandidatePayloadSchema.safeParse(payload).success
}

