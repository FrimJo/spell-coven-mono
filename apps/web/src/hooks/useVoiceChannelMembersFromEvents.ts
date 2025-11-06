import { useCallback, useEffect, useMemo, useState } from 'react'

import type { APIVoiceState } from '@repo/discord-integration/clients'

import { useVoiceChannelEvents } from './useVoiceChannelEvents.js'

export interface VoiceChannelMember {
  id: string
  username: string
  avatar: string | null
  isActive: boolean
  isOnline?: boolean // Whether user is connected to SSE (backend)
}

interface UseVoiceChannelMembersFromEventsProps {
  gameId: string
  userId?: string | undefined
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
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(new Set())

  // Log when hook is enabled/disabled
  useEffect(() => {
    console.log('[VoiceChannelMembersFromEvents] Hook enabled:', {
      enabled,
      hasToken: !!jwtToken,
      gameId,
      userId,
    })
  }, [enabled, jwtToken, gameId, userId])

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
    [gameId, userId],
  )

  // Handle errors
  const handleError = useCallback((err: Error) => {
    console.error('[VoiceChannelMembersFromEvents] WebSocket error:', err)
    setError(err.message)
  }, [])

  // Handle connection status updates
  const handleConnectionStatusUpdate = useCallback(
    (connectedUserIds: string[]) => {
      console.log(
        '[VoiceChannelMembersFromEvents] Connection status update:',
        {
          count: connectedUserIds.length,
          userIds: connectedUserIds,
          currentMembers: members.map((m) => m.id),
        },
      )
      setConnectedUserIds(new Set(connectedUserIds))
    },
    [members],
  )

  // Listen for voice channel events (only if token is available and enabled)
  useVoiceChannelEvents({
    jwtToken: enabled ? jwtToken : undefined,
    userId: enabled ? userId : undefined,
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
