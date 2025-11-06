import { useCallback, useState } from 'react'

import type { VoiceJoinedEvent, VoiceLeftEvent } from './useDiscordEventStream'
import { useDiscordEventStream } from './useDiscordEventStream'

export interface VoiceChannelMember {
  id: string
  username: string
  avatar: string | null
  isActive: boolean
}

interface UseVoiceChannelMembersFromSSEProps {
  gameId: string
  userId: string
  enabled?: boolean
}

/**
 * Hook to track voice channel members using SSE events
 *
 * Listens for voice.joined and voice.left events via Server-Sent Events.
 * No JWT token needed - uses session cookie authentication.
 *
 * @example
 * ```tsx
 * const { members, error } = useVoiceChannelMembersFromSSE({
 *   gameId: '123456789',
 *   userId: 'user-discord-id',
 *   enabled: true
 * })
 * ```
 */
export function useVoiceChannelMembersFromSSE({
  gameId,
  userId,
  enabled = true,
}: UseVoiceChannelMembersFromSSEProps) {
  const [members, setMembers] = useState<VoiceChannelMember[]>([])
  const [error, setError] = useState<string | null>(null)

  // Handle voice.joined events
  const handleVoiceJoined = useCallback(
    (event: VoiceJoinedEvent) => {
      // Only track members in this specific channel
      if (event.channelId !== gameId) {
        return
      }

      console.log('[VoiceChannelMembers] Member joined:', event.username)

      setMembers((prevMembers) => {
        // Check if member already exists
        const exists = prevMembers.some((m) => m.id === event.userId)
        if (exists) {
          return prevMembers
        }

        // Add new member (max 4 for video grid)
        const newMembers = [
          ...prevMembers,
          {
            id: event.userId,
            username: event.username,
            avatar: event.avatar,
            isActive: event.userId === userId,
          },
        ].slice(0, 4)

        console.log('[VoiceChannelMembers] Members updated:', newMembers.length)
        return newMembers
      })
    },
    [gameId, userId],
  )

  // Handle voice.left events
  const handleVoiceLeft = useCallback((event: VoiceLeftEvent) => {
    console.log('[VoiceChannelMembers] Member left:', event.userId)

    setMembers((prevMembers) => {
      const filtered = prevMembers.filter((m) => m.id !== event.userId)
      console.log('[VoiceChannelMembers] Members updated:', filtered.length)
      return filtered
    })
  }, [])

  // Handle errors
  const handleError = useCallback((err: Error) => {
    console.error('[VoiceChannelMembers] Error:', err)
    setError(err.message)
  }, [])

  // Subscribe to SSE events
  useDiscordEventStream({
    userId, // Pass userId for SSE endpoint connection
    onVoiceJoined: handleVoiceJoined,
    onVoiceLeft: handleVoiceLeft,
    onError: handleError,
    enabled,
  })

  return { members, error }
}
