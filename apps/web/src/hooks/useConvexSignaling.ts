/**
 * useConvexSignaling - React hook for Convex-based WebRTC signaling
 *
 * Drop-in replacement for SignalingManager using Convex reactive queries
 * and mutations. Uses roomSignals table for signaling message passing.
 */

import type { WebRTCSignal } from '@/types/webrtc-signal'
import { useCallback, useEffect, useRef, useState } from 'react'
import { validateWebRTCSignal } from '@/types/webrtc-signal'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'

interface UseConvexSignalingProps {
  roomId: string
  localPeerId: string
  enabled?: boolean
  onSignal?: (signal: WebRTCSignal) => void
  onError?: (error: Error) => void
}

interface UseConvexSignalingReturn {
  /** Send a WebRTC signal */
  send: (signal: WebRTCSignal) => Promise<void>
  /** Whether signaling is initialized and ready */
  isInitialized: boolean
  /** Current error if any */
  error: Error | null
}

/**
 * Hook for WebRTC signaling via Convex
 *
 * Uses reactive queries to receive signals and mutations to send them.
 * Signals are filtered to only receive those intended for this peer.
 */
export function useConvexSignaling({
  roomId,
  localPeerId,
  enabled = true,
  onSignal,
  onError,
}: UseConvexSignalingProps): UseConvexSignalingReturn {
  // Use roomId as-is - roomSignals table stores bare roomId (e.g., "ABC123")
  const convexRoomId = roomId

  // State
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track which signals we've already processed to avoid duplicates
  const processedSignalsRef = useRef<Set<string>>(new Set())

  // Track the last signal timestamp we've seen for the "since" parameter
  const lastSignalTimestampRef = useRef<number>(0)

  // Store callbacks in refs to avoid re-subscribing on every callback change
  const onSignalRef = useRef(onSignal)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onSignalRef.current = onSignal
    onErrorRef.current = onError
  }, [onSignal, onError])

  // Convex mutation for sending signals
  const sendSignalMutation = useMutation(api.signals.sendSignal)
  const sendSignalRef = useRef(sendSignalMutation)
  useEffect(() => {
    sendSignalRef.current = sendSignalMutation
  })

  // Query for receiving signals - reactive subscription
  // Using 'since: 0' initially to get recent signals, then updates reactively
  const signalsQuery = useQuery(
    api.signals.listSignals,
    enabled && localPeerId
      ? {
          roomId: convexRoomId,
          userId: localPeerId,
          since: 0, // Get all recent signals; we filter processed ones client-side
        }
      : 'skip',
  )

  // Process incoming signals
  useEffect(() => {
    if (!enabled || !signalsQuery || signalsQuery.length === 0) {
      return
    }

    for (const signal of signalsQuery) {
      // Skip already processed signals (using Convex document ID as unique identifier)
      const signalId = signal._id
      if (processedSignalsRef.current.has(signalId)) {
        continue
      }

      // Mark as processed
      processedSignalsRef.current.add(signalId)

      // Update last seen timestamp for potential future optimization
      if (signal.createdAt > lastSignalTimestampRef.current) {
        lastSignalTimestampRef.current = signal.createdAt
      }

      // Convert Convex signal format to WebRTCSignal format
      const webrtcSignal = {
        ...signal.payload,
        from: signal.fromUserId,
        to: signal.toUserId ?? localPeerId, // Broadcast signals have null toUserId
        roomId: signal.roomId,
      }

      // Validate the signal
      const validation = validateWebRTCSignal(webrtcSignal)
      if (!validation.success) {
        console.error(
          '[ConvexSignaling] Signal validation failed:',
          validation.error,
        )
        onErrorRef.current?.(validation.error)
        continue
      }

      console.log(
        '[ConvexSignaling] Processing signal from:',
        signal.fromUserId,
        'type:',
        validation.data.type,
      )
      onSignalRef.current?.(validation.data)
    }
  }, [signalsQuery, enabled, localPeerId, convexRoomId])

  // Mark as initialized once we have a successful query (even if empty)
  useEffect(() => {
    if (enabled && localPeerId && signalsQuery !== undefined) {
      if (!isInitialized) {
        console.log('[ConvexSignaling] Initialized for room:', convexRoomId)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing internal state with external Convex query state
        setIsInitialized(true)
        setError(null)
      }
    }
  }, [enabled, localPeerId, signalsQuery, convexRoomId, isInitialized])

  // Reset state when disabled or room changes
  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state when hook becomes disabled
      setIsInitialized(false)
      processedSignalsRef.current.clear()
      lastSignalTimestampRef.current = 0
    }
  }, [enabled, convexRoomId])

  // Send signal function
  const send = useCallback(
    async (signal: WebRTCSignal): Promise<void> => {
      if (!enabled) {
        throw new Error('ConvexSignaling.send: not enabled')
      }

      // Validate signal
      const validation = validateWebRTCSignal(signal)
      if (!validation.success) {
        throw validation.error
      }

      const validatedSignal = validation.data

      console.log('[ConvexSignaling] Sending signal:', {
        type: validatedSignal.type,
        from: validatedSignal.from,
        to: validatedSignal.to,
        roomId: convexRoomId,
      })

      try {
        await sendSignalRef.current({
          roomId: convexRoomId,
          fromUserId: validatedSignal.from,
          toUserId: validatedSignal.to,
          payload: {
            type: validatedSignal.type,
            payload:
              'payload' in validatedSignal
                ? validatedSignal.payload
                : undefined,
          },
        })
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('[ConvexSignaling] Failed to send signal:', error)
        setError(error)
        onErrorRef.current?.(error)
        throw error
      }
    },
    [enabled, convexRoomId],
  )

  return {
    send,
    isInitialized,
    error,
  }
}
