/**
 * WebRTC Signaling Hook
 * Handles sending and receiving WebRTC signaling messages via SSE + createServerFn
 */

import { useCallback, useEffect, useRef } from 'react'
import { useServerFn } from '@tanstack/react-start'

import { sendSignalingMessage } from '@/server/handlers/webrtc-signaling.server'
import type {
  IceCandidatePayload,
  SDPPayload,
  SignalingMessageSSE,
} from '@/lib/webrtc/signaling'
import {
  isIceCandidatePayload,
  isSDPPayload,
} from '@/lib/webrtc/signaling'
import {
  isSSEWebRTCSignalingMessage,
  SSEMessageSchema,
} from '@/types/sse-messages'

interface UseWebRTCSignalingOptions {
  roomId: string
  localPlayerId: string
  onSignalingMessage?: (message: SignalingMessageSSE) => void
  enabled?: boolean
}

/**
 * Hook for WebRTC signaling via SSE + createServerFn
 * Subscribes to SSE events for incoming signaling messages
 * Provides functions to send offer/answer/ICE candidate messages
 */
export function useWebRTCSignaling({
  roomId,
  localPlayerId,
  onSignalingMessage,
  enabled = true,
}: UseWebRTCSignalingOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const onMessageRef = useRef(onSignalingMessage)
  const sendSignalingMessageFn = useServerFn(sendSignalingMessage)

  // Update callback ref when it changes
  useEffect(() => {
    onMessageRef.current = onSignalingMessage
  }, [onSignalingMessage])

  // Subscribe to SSE events for signaling messages
  useEffect(() => {
    if (!enabled) {
      console.log('[WebRTC Signaling] Hook disabled, skipping SSE connection')
      return
    }

    console.log('[WebRTC Signaling] Connecting to SSE for signaling:', {
      roomId,
      localPlayerId,
    })

    // Connect to SSE endpoint with userId (localPlayerId) as query parameter
    // The endpoint requires userId for proper connection registration
    const sseUrl = `/api/stream?userId=${encodeURIComponent(localPlayerId)}`
    const eventSource = new EventSource(sseUrl, {
      withCredentials: true,
    })

    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('[WebRTC Signaling] SSE connection opened for signaling')
    }

    eventSource.onmessage = (event) => {
      try {
        // Skip heartbeat/comment messages (they start with ':')
        // EventSource handles these automatically, but some might slip through
        if (!event.data || event.data.trim().startsWith(':')) {
          return
        }

        // Skip non-JSON messages
        let parsed
        try {
          parsed = JSON.parse(event.data)
        } catch (parseError) {
          // Not a JSON message, skip it (could be ping/heartbeat)
          return
        }

        const result = SSEMessageSchema.safeParse(parsed)

        if (!result.success) {
          console.warn(
            '[WebRTC Signaling] Invalid SSE message format:',
            result.error,
            'Message data:',
            event.data,
          )
          return
        }

        const message = result.data

        // Filter for WebRTC signaling messages
        if (!isSSEWebRTCSignalingMessage(message)) {
          return
        }

        // Filter by roomId and ignore messages from self
        if (
          message.data.roomId !== roomId ||
          message.data.from === localPlayerId
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

        console.log(
          `[WebRTC Signaling] Received ${signalingMessage.message.type} from ${signalingMessage.from}`,
        )

        // Call callback with signaling message
        onMessageRef.current?.(signalingMessage)
      } catch (error) {
        console.error('[WebRTC Signaling] Failed to parse SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      // SSE connections are aborted during page reload/navigation - this is expected
      // Only log if the connection was actually established before the error
      if (eventSource.readyState === EventSource.CONNECTING) {
        console.warn('[WebRTC Signaling] SSE connection error during connection:', error)
      } else if (eventSource.readyState === EventSource.OPEN) {
        console.error('[WebRTC Signaling] SSE connection error after connection:', error)
      } else {
        // EventSource.CLOSED - connection was closed, likely due to page reload
        console.log('[WebRTC Signaling] SSE connection closed (likely page reload)')
      }
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [roomId, localPlayerId, enabled])

  /**
   * Send offer message to target player
   */
  const sendOffer = useCallback(
    async (to: string, offer: RTCSessionDescriptionInit): Promise<void> => {
      console.log(`[WebRTC Signaling] sendOffer called:`, {
        to,
        roomId,
        from: localPlayerId,
        offerType: offer.type,
        hasSDP: !!offer.sdp,
      })
      
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
        if (errorMessage.includes('not found or not connected')) {
          console.warn(`[WebRTC Signaling] Player ${to} not connected to SSE yet, offer will be sent when they connect`)
        } else {
          console.error(`[WebRTC Signaling] Failed to send offer to ${to}:`, errorMessage)
        }
        throw new Error(errorMessage)
      }
      
      console.log(`[WebRTC Signaling] Offer sent successfully to ${to}`)
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
      const normalizedTo = String(to)
      const normalizedLocalPlayerId = String(localPlayerId || '')
      
      // Reduced logging for ICE candidates (they're very frequent)
      const logKey = `ice-signaling-${to}`
      const logCount = (window as any)[logKey] = ((window as any)[logKey] || 0) + 1
      if (logCount <= 3) {
        console.log(`[WebRTC Signaling] sendIceCandidate #${logCount} to ${to}`)
      }
      
      if (normalizedTo === normalizedLocalPlayerId) {
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

