/**
 * useSupabasePresence - React hook for Supabase Presence
 *
 * Thin wrapper around PresenceManager for React components.
 */

import { useEffect, useRef, useState } from 'react'
import type { Participant } from '@/types/participant'
import { PresenceManager } from '@/lib/supabase/presence'

interface UseSupabasePresenceProps {
  roomId: string
  userId: string
  username: string
  avatar?: string | null
  enabled?: boolean
}

interface UseSupabasePresenceReturn {
  participants: Participant[]
  error: Error | null
}

/**
 * Hook to track game room participants using Supabase Presence
 */
export function useSupabasePresence({
  roomId,
  userId,
  username,
  avatar,
  enabled = true,
}: UseSupabasePresenceProps): UseSupabasePresenceReturn {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [error, setError] = useState<Error | null>(null)
  const managerRef = useRef<PresenceManager | null>(null)

  useEffect(() => {
    if (!enabled || !roomId || !userId || !username) {
      return
    }

    // Create manager
    const manager = new PresenceManager({
      onParticipantsUpdate: (updatedParticipants) => {
        setParticipants(updatedParticipants)
      },
      onError: (err) => {
        setError(err)
      },
    })

    managerRef.current = manager

    // Join room
    manager
      .join(roomId, userId, username, avatar)
      .then(() => {
        // Initial sync
        setParticipants(manager.getParticipants())
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)))
      })

    // Cleanup
    return () => {
      manager.destroy().catch((err) => {
        console.error('[useSupabasePresence] Error destroying manager:', err)
      })
      managerRef.current = null
    }
  }, [enabled, roomId, userId, username, avatar])

  return {
    participants,
    error,
  }
}

