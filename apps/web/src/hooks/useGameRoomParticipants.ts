/**
 * useGameRoomParticipants - Track who's actually in the game room web page
 *
 * This is INDEPENDENT of Discord voice channels. Users can:
 * - Be in voice channel but not in game room
 * - Be in game room but not in voice channel
 * - Join/leave game room multiple times while staying in voice channel
 *
 * Uses SSE to broadcast join/leave events to all participants.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { joinGameRoom, leaveGameRoom } from '@/server/handlers/gameroom.server'

export interface GameRoomParticipant {
  id: string // User ID
  username: string
  avatar?: string | null
  joinedAt: number // Timestamp
}

interface UseGameRoomParticipantsProps {
  roomId: string
  userId: string
  username: string
  avatar?: string | null
  enabled?: boolean
}

interface GameRoomJoinedEvent {
  roomId: string
  userId: string
  username: string
  avatar?: string | null
  timestamp: number
}

interface GameRoomLeftEvent {
  roomId: string
  userId: string
  timestamp: number
}

/**
 * Hook to track game room participants using SSE
 *
 * Automatically announces presence when component mounts and cleanup on unmount.
 * Listens for other participants joining/leaving.
 */
export function useGameRoomParticipants({
  roomId,
  userId,
  username,
  avatar,
  enabled = true,
}: UseGameRoomParticipantsProps) {
  const [participants, setParticipants] = useState<GameRoomParticipant[]>([])
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const hasAnnouncedRef = useRef(false)

  console.log('[useGameRoomParticipants] Hook called with:', {
    roomId,
    userId,
    username,
    enabled,
  })

  // Announce presence to server (joins the room)
  const announcePresence = useCallback(async () => {
    if (hasAnnouncedRef.current) {
      return
    }

    try {
      console.log('[GameRoomParticipants] Announcing presence in room:', roomId)

      const data = await joinGameRoom({
        data: {
          roomId,
          userId,
          username,
          avatar,
        },
      })

      console.log('[GameRoomParticipants] Join response received:', data)

      // Initialize participants list with current participants
      if (data.participants) {
        console.log(
          '[GameRoomParticipants] Setting initial participants:',
          data.participants,
        )
        setParticipants(data.participants)
      } else {
        console.warn('[GameRoomParticipants] No participants in response!')
      }

      hasAnnouncedRef.current = true
      console.log(
        '[GameRoomParticipants] Successfully joined room, current participants:',
        data.participants?.length,
      )
    } catch (err) {
      console.error('[GameRoomParticipants] Failed to announce presence:', err)
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [roomId, userId, username, avatar])

  // Remove presence from server (leaves the room)
  const removePresence = useCallback(async () => {
    if (!hasAnnouncedRef.current) {
      return
    }

    try {
      console.log('[GameRoomParticipants] Removing presence from room:', roomId)

      await leaveGameRoom({
        data: {
          roomId,
          userId,
        },
      })

      hasAnnouncedRef.current = false
      console.log('[GameRoomParticipants] Successfully left room')
    } catch (err) {
      console.error('[GameRoomParticipants] Failed to remove presence:', err)
    }
  }, [roomId, userId])

  // Listen for participant events via SSE
  useEffect(() => {
    if (!enabled || !roomId || !userId) {
      return
    }

    // Announce presence when joining (defer to avoid cascading renders)
    const timer = setTimeout(() => {
      announcePresence()
    }, 0)

    // Connect to SSE stream for this room
    console.log(
      '[GameRoomParticipants] Connecting to SSE stream for room:',
      roomId,
    )

    const sseUrl = `/api/gameroom/stream?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}`
    const eventSource = new EventSource(sseUrl, {
      withCredentials: true,
    })

    eventSourceRef.current = eventSource

    // Handle gameroom.joined events
    eventSource.addEventListener('gameroom.joined', (e) => {
      try {
        const event: GameRoomJoinedEvent = JSON.parse(e.data)

        // Ignore our own join event
        if (event.userId === userId) {
          return
        }

        console.log(
          '[GameRoomParticipants] Participant joined:',
          event.username,
        )

        setParticipants((prev) => {
          // Check if already in list
          if (prev.some((p) => p.id === event.userId)) {
            return prev
          }

          // Add new participant
          return [
            ...prev,
            {
              id: event.userId,
              username: event.username,
              avatar: event.avatar,
              joinedAt: event.timestamp,
            },
          ]
        })
      } catch (err) {
        console.error(
          '[GameRoomParticipants] Failed to parse gameroom.joined:',
          err,
        )
      }
    })

    // Handle gameroom.left events
    eventSource.addEventListener('gameroom.left', (e) => {
      try {
        const event: GameRoomLeftEvent = JSON.parse(e.data)

        console.log('[GameRoomParticipants] Participant left:', event.userId)

        setParticipants((prev) => prev.filter((p) => p.id !== event.userId))
      } catch (err) {
        console.error(
          '[GameRoomParticipants] Failed to parse gameroom.left:',
          err,
        )
      }
    })

    // Handle connection errors
    eventSource.onerror = (err) => {
      console.error('[GameRoomParticipants] SSE error:', err)
      setError('Connection to game room lost')
    }

    // Cleanup: remove presence and close SSE
    return () => {
      console.log('[GameRoomParticipants] Cleaning up, leaving room')
      clearTimeout(timer)
      eventSource.close()
      eventSourceRef.current = null
      removePresence()
    }
  }, [enabled, roomId, userId, announcePresence, removePresence])

  // Debug log participants changes
  useEffect(() => {
    console.log('[useGameRoomParticipants] Participants updated:', {
      count: participants.length,
      participants: participants.map((p) => ({
        id: p.id,
        username: p.username,
      })),
    })
  }, [participants])

  return {
    participants,
    error,
  }
}
