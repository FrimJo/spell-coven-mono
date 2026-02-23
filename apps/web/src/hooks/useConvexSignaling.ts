/**
 * useConvexSignaling - React hook for Convex-based WebRTC signaling
 *
 * Drop-in replacement for SignalingManager using Convex reactive queries
 * and mutations. Uses roomSignals table for signaling message passing.
 */

import type { WebRTCSignal } from '@/types/webrtc-signal'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { validateWebRTCSignal } from '@/types/webrtc-signal'
import { api } from '@convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'

/**
 * Safety overlap subtracted from the watermark so we don't miss signals
 * that were inserted slightly out of order (clock skew / replication lag).
 */
const SINCE_OVERLAP_MS = 2_000

/** Max entries in the dedupe set before we prune the oldest half. */
const MAX_DEDUPE_ENTRIES = 500

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

  // Incremental watermark: only fetch signals created after this timestamp.
  // Kept as state so changing it re-subscribes the Convex reactive query.
  const [sinceMs, setSinceMs] = useState(0)

  // Track which signals we've already processed to avoid duplicates
  const processedSignalsRef = useRef<Set<string>>(new Set())

  // Effect events: always see latest callbacks without becoming dependencies
  const emitSignal = useEffectEvent((signal: WebRTCSignal) => {
    onSignal?.(signal)
  })

  const emitError = useEffectEvent((err: Error) => {
    onError?.(err)
  })

  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  // Convex mutation for sending signals
  const sendSignalMutation = useMutation(api.signals.sendSignal)
  const sendSignalRef = useRef(sendSignalMutation)
  useEffect(() => {
    sendSignalRef.current = sendSignalMutation
  })

  // Query for receiving signals - reactive subscription with incremental watermark.
  // The `since` value advances as we process signals, so each reactive push
  // only returns new rows instead of the entire 60-second window.
  const signalsQuery = useQuery(
    api.signals.listSignals,
    enabled && localPeerId
      ? {
          roomId: convexRoomId,
          since: sinceMs,
        }
      : 'skip',
  )

  // Process incoming signals and advance watermark
  useEffect(() => {
    if (!enabled || !signalsQuery || signalsQuery.length === 0) {
      return
    }

    let maxTimestamp = 0

    for (const signal of signalsQuery) {
      // Skip already processed signals (using Convex document ID as unique identifier)
      const signalId = signal._id
      if (processedSignalsRef.current.has(signalId)) {
        continue
      }

      // Mark as processed
      processedSignalsRef.current.add(signalId)

      if (signal.createdAt > maxTimestamp) {
        maxTimestamp = signal.createdAt
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
        emitError(validation.error)
        continue
      }

      console.log(
        '[ConvexSignaling] Processing signal from:',
        signal.fromUserId,
        'type:',
        validation.data.type,
      )
      emitSignal(validation.data)
    }

    // Advance the watermark (with overlap) so subsequent queries are smaller.
    if (maxTimestamp > 0) {
      const nextSince = Math.max(0, maxTimestamp - SINCE_OVERLAP_MS)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- advancing incremental watermark based on processed query results
      setSinceMs((prev) => Math.max(prev, nextSince))
    }

    // Prune dedupe set if it grows too large
    if (processedSignalsRef.current.size > MAX_DEDUPE_ENTRIES) {
      const entries = Array.from(processedSignalsRef.current)
      processedSignalsRef.current = new Set(
        entries.slice(entries.length - MAX_DEDUPE_ENTRIES / 2),
      )
    }
    // eslint-disable-next-line @tanstack/query/no-unstable-deps -- flase positive, signalsQuery is not from tanstack query
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
    // eslint-disable-next-line @tanstack/query/no-unstable-deps -- flase positive, signalsQuery is not from tanstack query
  }, [enabled, localPeerId, signalsQuery, convexRoomId, isInitialized])

  // Reset state when disabled or room changes
  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state when hook becomes disabled
      setIsInitialized(false)
      setSinceMs(0)
      processedSignalsRef.current.clear()
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
