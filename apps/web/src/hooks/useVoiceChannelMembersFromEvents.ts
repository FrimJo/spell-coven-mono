import { useCallback, useState, useMemo } from 'react'

import type { VoiceJoinedEvent, VoiceLeftEvent } from './useVoiceChannelEvents'
import { useVoiceChannelEvents } from './useVoiceChannelEvents'

export interface VoiceChannelMember {
  id: string
  username: string
  avatar: string | null
  isActive: boolean
}

interface UseVoiceChannelMembersFromEventsProps {
  gameId: string
  userId: string
  jwtToken?: string
  enabled?: boolean
}

/**
 * Hook to track voice channel members using real-time gateway events
 * Listens for voice.joined and voice.left events instead of polling
 *
 * Returns the current list of members in the voice channel
 */
export function useVoiceChannelMembersFromEvents({
  gameId,
  userId,
  jwtToken,
  enabled = !!jwtToken,
}: UseVoiceChannelMembersFromEventsProps) {
  const [members, setMembers] = useState<VoiceChannelMember[]>([])
  const [error, setError] = useState<string | null>(null)

  // Handle voice.joined events
  const handleVoiceJoined = useCallback(
    (event: VoiceJoinedEvent) => {
      // Only track members in this specific channel
      if (event.channelId !== gameId) {
        return
      }

      console.log(
        '[VoiceChannelMembersFromEvents] Member joined:',
        event.username,
      )

      setMembers((prevMembers) => {
        // Check if member already exists
        const exists = prevMembers.some((m) => m.id === event.userId)
        if (exists) {
          return prevMembers
        }

        // Add new member (max 4)
        const newMembers = [
          ...prevMembers,
          {
            id: event.userId,
            username: event.username,
            avatar: event.avatar,
            isActive: event.userId === userId,
          },
        ].slice(0, 4)

        console.log(
          '[VoiceChannelMembersFromEvents] Members updated:',
          newMembers.length,
        )
        return newMembers
      })
    },
    [gameId, userId],
  )

  // Handle voice.left events
  const handleVoiceLeft = useCallback((event: VoiceLeftEvent) => {
    console.log('[VoiceChannelMembersFromEvents] Member left:', event.userId)

    setMembers((prevMembers) =>
      prevMembers.filter((m) => m.id !== event.userId),
    )
  }, [])

  // Handle errors
  const handleError = useCallback((err: Error) => {
    console.error('[VoiceChannelMembersFromEvents] WebSocket error:', err)
    setError(err.message)
  }, [])

  // Listen for voice channel events (only if token is available and enabled)
  useVoiceChannelEvents({
    jwtToken: enabled ? jwtToken : undefined,
    onVoiceJoined: enabled ? handleVoiceJoined : undefined,
    onVoiceLeft: enabled ? handleVoiceLeft : undefined,
    onError: enabled ? handleError : undefined,
  })

  return useMemo(() => ({ members, error }), [members, error])
}
