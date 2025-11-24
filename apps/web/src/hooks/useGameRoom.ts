/**
 * useGameRoom Hook - Track room participant count via Supabase Realtime
 *
 * Uses Realtime channel presence to track participants.
 * No database required - rooms exist when channels have active participants.
 * Uses shared ChannelManager for channel reuse across managers.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { channelManager } from '@/lib/supabase/channel-manager'

export interface UseGameRoomOptions {
  roomId: string
  onParticipantCountChange?: (count: number) => void
  onError?: (error: Error) => void
}

export interface UseGameRoomReturn {
  participantCount: number
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to track room participant count with real-time updates
 */
export function useGameRoom({
  roomId,
  onParticipantCountChange,
  onError,
}: UseGameRoomOptions): UseGameRoomReturn {
  const [participantCount, setParticipantCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const onParticipantCountChangeRef = useRef(onParticipantCountChange)
  const onErrorRef = useRef(onError)

  // Keep refs updated
  useEffect(() => {
    onParticipantCountChangeRef.current = onParticipantCountChange
    onErrorRef.current = onError
  }, [onParticipantCountChange, onError])

  useEffect(() => {
    if (!roomId) {
      setError(new Error('Room ID is required'))
      setIsLoading(false)
      return
    }

    console.log('[useGameRoom] Getting shared channel for room:', roomId)

    // Use shared channel manager
    channelRef.current = channelManager.getChannel(roomId)

    // Track presence changes
    channelRef.current.on('presence', { event: 'sync' }, () => {
      if (!channelRef.current) return

      const presenceState = channelRef.current.presenceState()
      const count = Object.keys(presenceState).length

      console.log('[useGameRoom] Presence sync, count:', count)
      setParticipantCount(count)
      setIsLoading(false)
      onParticipantCountChangeRef.current?.(count)
    })

    // Subscribe to channel (only if not already subscribed by another manager)
    const subscriptionCount = channelManager.getSubscriptionCount(roomId)
    console.log(
      `[useGameRoom] Current subscriptions for room ${roomId}: ${subscriptionCount}`,
    )

    if (subscriptionCount === 0) {
      console.log('[useGameRoom] Subscribing to channel...')
      channelRef.current.subscribe((status, err) => {
        console.log('[useGameRoom] Channel subscription status:', status)

        if (status === 'SUBSCRIBED') {
          console.log('[useGameRoom] Channel subscribed successfully')
          channelManager.markSubscribed(roomId)
          setIsLoading(false)
          // Get initial count
          if (channelRef.current) {
            const presenceState = channelRef.current.presenceState()
            const count = Object.keys(presenceState).length
            setParticipantCount(count)
            onParticipantCountChangeRef.current?.(count)
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const error =
            err instanceof Error
              ? err
              : new Error(`Channel subscription failed: ${status}`)
          console.error('[useGameRoom] Subscription error:', error)
          setError(error)
          setIsLoading(false)
          onErrorRef.current?.(error)
        }
      })
    } else {
      console.log(
        '[useGameRoom] Channel already subscribed, marking subscription',
      )
      channelManager.markSubscribed(roomId)
      setIsLoading(false)
      // Get initial count from existing subscription
      if (channelRef.current) {
        const presenceState = channelRef.current.presenceState()
        const count = Object.keys(presenceState).length
        setParticipantCount(count)
        onParticipantCountChangeRef.current?.(count)
      }
    }

    // Cleanup
    return () => {
      if (channelRef.current) {
        console.log('[useGameRoom] Cleaning up channel for room:', roomId)
        channelManager.markUnsubscribed(roomId)

        // Only unsubscribe if this was the last subscription
        const subscriptionCount = channelManager.getSubscriptionCount(roomId)
        if (subscriptionCount === 0) {
          console.log('[useGameRoom] Last subscription - unsubscribing')
          channelRef.current.unsubscribe()
          channelManager.removeChannel(roomId)
        } else {
          console.log(
            `[useGameRoom] Not unsubscribing - ${subscriptionCount} subscription(s) remaining`,
          )
        }

        channelRef.current = null
      }
    }
  }, [roomId])

  return {
    participantCount,
    isLoading,
    error,
  }
}
