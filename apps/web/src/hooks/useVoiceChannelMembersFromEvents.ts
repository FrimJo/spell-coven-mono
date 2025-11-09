import { useCallback, useMemo, useState } from 'react'
import { getInitialVoiceChannelMembers } from '@/server/handlers/discord-rooms.server.js'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'

import type { APIVoiceState } from '@repo/discord-integration/clients'

import { useVoiceChannelEvents } from './useVoiceChannelEvents.js'
import { useWebSocketAuthToken } from './useWebSocketAuthToken.js'

export interface VoiceChannelMember {
  id: string
  username: string
  avatar: string | null
  isOnline: boolean // Whether user is connected to SSE (backend)
}

interface UseVoiceChannelMembersFromEventsProps {
  gameId: string
  userId: string
  enabled?: boolean
}

const voiceChannelMembersQueryOptions = (gameId: string) =>
  queryOptions({
    queryKey: ['game', gameId, 'voice-channel-members'] as const,
    queryFn: async ({ queryKey }) => {
      const [_, gameId] = queryKey
      const result = await getInitialVoiceChannelMembers({
        data: { channelId: gameId },
      })
      if (result.error) {
        throw new Error(result.error)
      }
      return result.members
    },
  })

/**
 * Hook to track voice channel members using real-time gateway events
 * Listens for voice.joined and voice.left events instead of polling
 *
 * Returns the current list of members in the voice channel
 */
export function useVoiceChannelMembersFromEvents({
  gameId,
  userId,
}: UseVoiceChannelMembersFromEventsProps) {
  const { data: jwtToken } = useWebSocketAuthToken({ userId })

  const { data: initialMembers } = useSuspenseQuery(
    voiceChannelMembersQueryOptions(gameId),
  )

  const [members, setMembers] = useState<VoiceChannelMember[]>(initialMembers)
  const [error, setError] = useState<string | null>(null)
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(
    new Set(),
  )

  // Handle VOICE_STATE_UPDATE events
  const handleVoiceStateUpdate = useCallback(
    (voiceState: APIVoiceState) => {
      console.log(
        '[VoiceChannelMembersFromEvents] Received VOICE_STATE_UPDATE:',
        {
          userId: voiceState.user_id,
          channelId: voiceState.channel_id,
          gameId,
          match: voiceState.channel_id === gameId,
        },
      )

      // User joined a voice channel
      if (voiceState.channel_id) {
        // Only track members in this specific channel
        if (voiceState.channel_id !== gameId) {
          console.log(
            '[VoiceChannelMembersFromEvents] Ignoring event - channel mismatch',
            { eventChannelId: voiceState.channel_id, gameId },
          )
          return
        }

        const username = voiceState.member?.user?.username || 'Unknown User'
        const avatar = voiceState.member?.user?.avatar || null

        console.log('[VoiceChannelMembersFromEvents] Member joined:', username)

        setMembers((prevMembers) => {
          // Check if member already exists
          const exists = prevMembers.some((m) => m.id === voiceState.user_id)
          if (exists) {
            return prevMembers
          }

          // Add new member (max 4)
          const newMembers = [
            ...prevMembers,
            {
              id: voiceState.user_id,
              username,
              avatar,
              isActive: voiceState.user_id === userId,
              isOnline: connectedUserIds.has(voiceState.user_id),
            },
          ].slice(0, 4)

          console.log(
            '[VoiceChannelMembersFromEvents] Members updated:',
            newMembers.length,
          )
          return newMembers
        })
      }
      // User left a voice channel
      else {
        console.log(
          '[VoiceChannelMembersFromEvents] Member left:',
          voiceState.user_id,
        )

        setMembers((prevMembers) => {
          const filtered = prevMembers.filter(
            (m) => m.id !== voiceState.user_id,
          )
          console.log(
            '[VoiceChannelMembersFromEvents] Members updated after leave:',
            filtered.length,
          )
          return filtered
        })
      }
    },
    [gameId, userId, connectedUserIds],
  )

  // Handle errors
  const handleError = useCallback((err: Error) => {
    console.error('[VoiceChannelMembersFromEvents] WebSocket error:', err)
    setError(err.message)
  }, [])

  // Handle connection status updates
  const handleConnectionStatusUpdate = useCallback(
    (connectedUserIds: string[]) => {
      console.log('[VoiceChannelMembersFromEvents] Connection status update:', {
        count: connectedUserIds.length,
        userIds: connectedUserIds,
        currentMembers: members.map((m) => m.id),
      })
      setConnectedUserIds(new Set(connectedUserIds))
    },
    [members],
  )

  const enabled = !!jwtToken
  // Listen for voice channel events (only if token is available and enabled)
  useVoiceChannelEvents({
    jwtToken: enabled ? jwtToken : undefined,
    userId: enabled ? userId : undefined,
    channelId: enabled ? gameId : undefined,
    onVoiceStateUpdate: enabled ? handleVoiceStateUpdate : undefined,
    onError: enabled ? handleError : undefined,
    onConnectionStatusUpdate: enabled
      ? handleConnectionStatusUpdate
      : undefined,
  })

  // Update members with online status
  const membersWithOnlineStatus = useMemo(() => {
    return members.map((member) => ({
      ...member,
      isOnline: connectedUserIds.has(member.id),
    }))
  }, [members, connectedUserIds])

  return useMemo(
    () => ({ members: membersWithOnlineStatus, error }),
    [membersWithOnlineStatus, error],
  )
}
