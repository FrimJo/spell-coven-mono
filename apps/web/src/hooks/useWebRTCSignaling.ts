/**
 * WebRTC Signaling Hook
 * Handles sending and receiving WebRTC signaling messages via shared SSE connection
 */

import type {
  IceCandidatePayload,
  SDPPayload,
  SignalingMessageSSE,
} from '@/lib/webrtc/signaling'
import { useCallback, useEffect, useRef } from 'react'
import { isIceCandidatePayload, isSDPPayload } from '@/lib/webrtc/signaling'
import { isSelfConnection } from '@/lib/webrtc/utils'
import { sendSignalingMessage } from '@/server/handlers/webrtc-signaling.server'
import { useServerFn } from '@tanstack/react-start'

import { useVoiceChannelEvents } from './useVoiceChannelEvents'
import { useWebSocketAuthToken } from './useWebSocketAuthToken'

interface UseWebRTCSignalingOptions {
  roomId: string
  localPlayerId: string
  onSignalingMessage?: (message: SignalingMessageSSE) => void
}

/**
 * Hook for WebRTC signaling via shared SSE connection
 * Uses the singleton SSE manager from useVoiceChannelEvents
 * Provides functions to send offer/answer/ICE candidate messages
 */
export function useWebRTCSignaling({
  roomId,
  localPlayerId,
  onSignalingMessage,
}: UseWebRTCSignalingOptions) {
  const onMessageRef = useRef(onSignalingMessage)
  const sendSignalingMessageFn = useServerFn(sendSignalingMessage)
  const { data: jwtToken } = useWebSocketAuthToken({ userId: localPlayerId })

  useEffect(() => {
    onMessageRef.current = onSignalingMessage
  }, [onSignalingMessage])

  // Use shared SSE connection for WebRTC signaling messages
  useVoiceChannelEvents({
    jwtToken,
    userId: localPlayerId,
    channelId: roomId,
    onWebRTCSignaling: (message) => {
      // Filter by roomId and ignore messages from self
      if (
        message.data.roomId !== roomId ||
        isSelfConnection(message.data.from, localPlayerId)
      ) {
        return
      }

      // Extract signaling message data
      const signalingMessage: SignalingMessageSSE = {
        from: message.data.from,
        roomId: message.data.roomId,
        message: {
          type: message.data.message.type,
          payload: message.data.message.payload as
            | SDPPayload
            | IceCandidatePayload,
        },
      }

      onMessageRef.current?.(signalingMessage)
    },
  })

  /**
   * Send offer message to target player
   */
  const sendOffer = useCallback(
    async (to: string, offer: RTCSessionDescriptionInit): Promise<void> => {
      if (!isSDPPayload({ type: 'offer', sdp: offer.sdp || '' })) {
        throw new Error('Invalid offer format')
      }

      const result = await sendSignalingMessageFn({
        data: {
          roomId,
          from: localPlayerId,
          to,
          message: {
            type: 'offer',
            payload: {
              type: 'offer',
              sdp: offer.sdp || '',
            },
          },
        },
      })

      if (!result.success) {
        const errorMessage = result.error || 'Failed to send offer'
        // If player is not connected yet, this is expected during connection establishment
        if (!errorMessage.includes('not found or not connected')) {
          console.error(
            `[WebRTC Signaling] Failed to send offer to ${to}:`,
            errorMessage,
          )
        }
        throw new Error(errorMessage)
      }
    },
    [roomId, localPlayerId, sendSignalingMessageFn],
  )

  /**
   * Send answer message to target player
   */
  const sendAnswer = useCallback(
    async (to: string, answer: RTCSessionDescriptionInit): Promise<void> => {
      if (!isSDPPayload({ type: 'answer', sdp: answer.sdp || '' })) {
        throw new Error('Invalid answer format')
      }

      const result = await sendSignalingMessageFn({
        data: {
          roomId,
          from: localPlayerId,
          to,
          message: {
            type: 'answer',
            payload: {
              type: 'answer',
              sdp: answer.sdp || '',
            },
          },
        },
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to send answer')
      }
    },
    [roomId, localPlayerId, sendSignalingMessageFn],
  )

  /**
   * Send ICE candidate to target player
   */
  const sendIceCandidate = useCallback(
    async (to: string, candidate: RTCIceCandidateInit): Promise<void> => {
      // Prevent sending ICE candidates to ourselves
      if (isSelfConnection(to, localPlayerId || '')) {
        console.error(
          `[WebRTC Signaling] ERROR: Attempted to send ICE candidate to local player ${to}! Ignoring.`,
        )
        throw new Error(`Cannot send ICE candidate to local player: ${to}`)
      }

      if (
        !isIceCandidatePayload({
          candidate: candidate.candidate || '',
          sdpMLineIndex: candidate.sdpMLineIndex ?? null,
          sdpMid: candidate.sdpMid ?? null,
        })
      ) {
        throw new Error('Invalid ICE candidate format')
      }

      const result = await sendSignalingMessageFn({
        data: {
          roomId,
          from: localPlayerId,
          to,
          message: {
            type: 'ice-candidate',
            payload: {
              candidate: candidate.candidate || '',
              sdpMLineIndex: candidate.sdpMLineIndex ?? null,
              sdpMid: candidate.sdpMid ?? null,
            },
          },
        },
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to send ICE candidate')
      }
    },
    [roomId, localPlayerId, sendSignalingMessageFn],
  )

  return {
    sendOffer,
    sendAnswer,
    sendIceCandidate,
  }
}
