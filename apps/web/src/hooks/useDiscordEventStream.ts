import { useEffect, useRef } from 'react'

export interface VoiceLeftEvent {
  guildId: string
  channelId: null
  userId: string
}

export interface VoiceJoinedEvent {
  guildId: string
  channelId: string
  userId: string
  username: string
  avatar: string | null
}

export interface RoomCreatedEvent {
  guildId: string
  channelId: string
  name: string
  parentId?: string
  userLimit: number
}

export interface RoomDeletedEvent {
  guildId: string
  channelId: string
}

interface UseDiscordEventStreamOptions {
  userId?: string // Discord user ID - required for SSE endpoint connection
  channelId?: string // Channel ID (room ID) - required for SSE endpoint connection
  onVoiceLeft?: (event: VoiceLeftEvent) => void
  onVoiceJoined?: (event: VoiceJoinedEvent) => void
  onRoomCreated?: (event: RoomCreatedEvent) => void
  onRoomDeleted?: (event: RoomDeletedEvent) => void
  onError?: (error: Error) => void
  enabled?: boolean
}

/**
 * Hook for receiving Discord events via Server-Sent Events (SSE)
 *
 * Connects to `/api/stream` and receives real-time Discord events.
 * Uses session cookie for authentication (no JWT needed).
 *
 * @example
 * ```tsx
 * useDiscordEventStream({
 *   onVoiceJoined: (event) => {
 *     console.log('User joined:', event.username)
 *   },
 *   onVoiceLeft: (event) => {
 *     console.log('User left:', event.userId)
 *   },
 *   enabled: true
 * })
 * ```
 */
export function useDiscordEventStream(options: UseDiscordEventStreamOptions) {
  const {
    userId,
    channelId,
    onVoiceLeft,
    onVoiceJoined,
    onRoomCreated,
    onRoomDeleted,
    onError,
    enabled = true,
  } = options

  // Use refs to avoid recreating EventSource on callback changes
  const callbacksRef = useRef({
    onVoiceLeft,
    onVoiceJoined,
    onRoomCreated,
    onRoomDeleted,
    onError,
  })

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onVoiceLeft,
      onVoiceJoined,
      onRoomCreated,
      onRoomDeleted,
      onError,
    }
  }, [onVoiceLeft, onVoiceJoined, onRoomCreated, onRoomDeleted, onError])

  useEffect(() => {
    if (!enabled) {
      return
    }

    // userId and channelId are required for SSE endpoint connection
    if (!userId) {
      console.warn('[Discord Events] userId required but not provided, skipping SSE connection')
      return
    }

    if (!channelId) {
      console.warn('[Discord Events] channelId required but not provided, skipping SSE connection')
      return
    }

    console.log('[Discord Events] Connecting to SSE stream...')

    // Create EventSource connection with userId and channelId query parameters
    const sseUrl = `/api/stream?userId=${encodeURIComponent(userId)}&channelId=${encodeURIComponent(channelId)}`
    const eventSource = new EventSource(sseUrl, {
      withCredentials: true, // Include session cookie
    })

    // Handle voice.joined events
    eventSource.addEventListener('voice.joined', (e) => {
      try {
        const payload: VoiceJoinedEvent = JSON.parse(e.data)
        callbacksRef.current.onVoiceJoined?.(payload)
      } catch (error) {
        console.error('[Discord Events] Failed to parse voice.joined:', error)
        callbacksRef.current.onError?.(error as Error)
      }
    })

    // Handle voice.left events
    eventSource.addEventListener('voice.left', (e) => {
      try {
        const payload: VoiceLeftEvent = JSON.parse(e.data)
        callbacksRef.current.onVoiceLeft?.(payload)
      } catch (error) {
        console.error('[Discord Events] Failed to parse voice.left:', error)
        callbacksRef.current.onError?.(error as Error)
      }
    })

    // Handle room.created events
    eventSource.addEventListener('room.created', (e) => {
      try {
        const payload: RoomCreatedEvent = JSON.parse(e.data)
        callbacksRef.current.onRoomCreated?.(payload)
      } catch (error) {
        console.error('[Discord Events] Failed to parse room.created:', error)
        callbacksRef.current.onError?.(error as Error)
      }
    })

    // Handle room.deleted events
    eventSource.addEventListener('room.deleted', (e) => {
      try {
        const payload: RoomDeletedEvent = JSON.parse(e.data)
        callbacksRef.current.onRoomDeleted?.(payload)
      } catch (error) {
        console.error('[Discord Events] Failed to parse room.deleted:', error)
        callbacksRef.current.onError?.(error as Error)
      }
    })

    // Handle connection open
    eventSource.addEventListener('open', () => {
      console.log('[Discord Events] SSE connection established')
    })

    // Handle errors
    eventSource.addEventListener('error', (e) => {
      console.error('[Discord Events] SSE error:', e)

      // EventSource automatically reconnects, so we don't need to handle it
      // Just notify the error callback
      callbacksRef.current.onError?.(new Error('SSE connection error'))
    })

    // Cleanup on unmount
    return () => {
      console.log('[Discord Events] Closing SSE connection')
      eventSource.close()
    }
  }, [enabled, userId, channelId])
}
