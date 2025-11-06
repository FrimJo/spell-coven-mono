/**
 * WebRTC Signaling Types
 * Type definitions for signaling messages exchanged via SSE + createServerFn
 */

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
 * Type guard for SDP payload
 */
export function isSDPPayload(
  payload: SignalingPayload,
): payload is SDPPayload {
  return 'sdp' in payload && ('type' in payload && (payload.type === 'offer' || payload.type === 'answer'))
}

/**
 * Type guard for ICE candidate payload
 */
export function isIceCandidatePayload(
  payload: SignalingPayload,
): payload is IceCandidatePayload {
  return 'candidate' in payload && 'sdpMLineIndex' in payload
}

