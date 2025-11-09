import { useEffect, useMemo, useRef } from 'react'

import type { APIVoiceState } from '@repo/discord-integration/clients'

import {
  isSSEAckMessage,
  isSSECustomEventMessage,
  isSSEDiscordEventMessage,
  isSSEErrorMessage,
  SSEMessageSchema,
} from '../types/sse-messages'

interface UseVoiceChannelEventsOptions {
  jwtToken?: string
  userId?: string
  onVoiceStateUpdate?: (voiceState: APIVoiceState) => void
  onError?: (error: Error) => void
  onConnectionStatusUpdate?: (connectedUserIds: string[]) => void
}

/**
 * Singleton SSE manager for voice channel events
 * Ensures only one SSE connection is created even with multiple hook instances
 */
class VoiceChannelSSEManager {
  private static instance: VoiceChannelSSEManager
  private eventSource: EventSource | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private cleanupReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }
  private maxReconnectAttempts = 5
  private jwtToken: string | null = null
  private userId: string | null = null
  private isConnecting = false
  private listeners: Set<{
    onVoiceStateUpdate?: (voiceState: APIVoiceState) => void
    onError?: (error: Error) => void
    onConnectionStatusUpdate?: (connectedUserIds: string[]) => void
  }> = new Set()

  private constructor() {}

  static getInstance(): VoiceChannelSSEManager {
    if (!VoiceChannelSSEManager.instance) {
      VoiceChannelSSEManager.instance = new VoiceChannelSSEManager()
    }
    return VoiceChannelSSEManager.instance
  }

  addListener(listener: {
    onVoiceStateUpdate?: (voiceState: APIVoiceState) => void
    onError?: (error: Error) => void
    onConnectionStatusUpdate?: (connectedUserIds: string[]) => void
  }): void {
    this.listeners.add(listener)
  }

  removeListener(listener: {
    onVoiceStateUpdate?: (voiceState: APIVoiceState) => void
    onError?: (error: Error) => void
    onConnectionStatusUpdate?: (connectedUserIds: string[]) => void
  }): void {
    this.listeners.delete(listener)
    // Don't close connection - keep it alive for other potential listeners
    // The connection will be reused if new listeners are added
  }

  setJwtToken(token: string | undefined): void {
    this.jwtToken = token || null
    // Reconnect if token changed and we're not connected
    if (token && this.eventSource?.readyState !== EventSource.OPEN) {
      this.connect()
    }
  }

  setUserId(userId: string | undefined): void {
    const newUserId = userId || null

    // If userId hasn't changed, don't do anything
    if (this.userId === newUserId) {
      return
    }

    console.log('[VoiceChannelEvents] Setting userId:', {
      oldUserId: this.userId,
      newUserId,
      isConnected: this.eventSource?.readyState === EventSource.OPEN,
    })

    this.userId = newUserId

    // If we're already connected with a different userId, reconnect with the new one
    if (newUserId && this.eventSource?.readyState === EventSource.OPEN) {
      console.log('[VoiceChannelEvents] Reconnecting with new userId')
      this.reconnect()
    } else if (newUserId && this.jwtToken) {
      // Connect if we have both userId and token
      console.log('[VoiceChannelEvents] Connecting with userId and token')
      this.connect()
    }
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }

  connect(): void {
    // Prevent multiple connection attempts (handles React StrictMode double-invoke)
    if (this.isConnecting) {
      return
    }

    if (this.eventSource?.readyState === EventSource.CONNECTING) {
      return
    }

    if (this.eventSource?.readyState === EventSource.OPEN) {
      return
    }

    if (!this.jwtToken) {
      console.log(
        '[VoiceChannelEvents] No JWT token available, skipping connection attempt',
      )
      return
    }

    if (!this.userId) {
      console.log(
        '[VoiceChannelEvents] No userId available, skipping connection attempt',
      )
      return
    }

    this.isConnecting = true

    try {
      // Connect to SSE endpoint on same origin (per spec: /api/stream)
      // Include userId as query parameter if available
      const sseUrl = this.userId
        ? `/api/stream?userId=${encodeURIComponent(this.userId)}`
        : `/api/stream`

      console.log('[VoiceChannelEvents] Connecting to SSE:', sseUrl)
      this.eventSource = new EventSource(sseUrl, {
        withCredentials: true, // Include session cookie per spec
      })

      this.eventSource.onopen = () => {
        console.log('[VoiceChannelEvents] SSE connected')
        this.isConnecting = false
        this.reconnectAttempts = 0
      }

      this.eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)

          // Validate message with Zod schema
          const result = SSEMessageSchema.safeParse(parsed)

          if (!result.success) {
            console.error(
              '[VoiceChannelEvents] Invalid message format:',
              result.error,
            )
            return
          }

          const message = result.data
          console.log('[VoiceChannelEvents] Received message:', message)

          // Handle connection acknowledgment
          if (isSSEAckMessage(message)) {
            console.log('[VoiceChannelEvents] Connection established')
            this.reconnectAttempts = 0
            return
          }

          // Handle error messages
          if (isSSEErrorMessage(message)) {
            console.error('[VoiceChannelEvents] Server error:', message.message)
            const error = new Error(message.message)
            this.listeners.forEach((listener) => {
              listener.onError?.(error)
            })
            return
          }

          // Handle raw Discord Gateway events
          if (isSSEDiscordEventMessage(message)) {
            console.log(
              `[VoiceChannelEvents] Received Discord event: ${message.event}`,
            )

            // Process VOICE_STATE_UPDATE events
            if (message.event === 'VOICE_STATE_UPDATE') {
              const voiceState = message.payload as APIVoiceState

              console.log('[VoiceChannelEvents] VOICE_STATE_UPDATE:', {
                userId: voiceState.user_id,
                channelId: voiceState.channel_id,
                username: voiceState.member?.user?.username,
              })

              // Broadcast raw voice state to all listeners
              this.listeners.forEach((listener) => {
                listener.onVoiceStateUpdate?.(voiceState)
              })
            }
          }

          // Handle custom events (including connection status)
          if (
            isSSECustomEventMessage(message) &&
            message.event === 'users.connection_status'
          ) {
            const payload = message.payload
            console.log(
              `[VoiceChannelEvents] Users connection status received:`,
              {
                count: payload.connectedUserIds.length,
                userIds: payload.connectedUserIds,
                timestamp: payload.timestamp,
              },
            )
            // Broadcast connection status to all listeners
            this.listeners.forEach((listener) => {
              listener.onConnectionStatusUpdate?.(payload.connectedUserIds)
            })
          }
        } catch (error) {
          console.error('[VoiceChannelEvents] Failed to parse message:', error)
          const parseError =
            error instanceof Error
              ? error
              : new Error('Failed to parse WebSocket message')
          this.listeners.forEach((listener) => {
            listener.onError?.(parseError)
          })
        }
      }

      this.eventSource.onerror = () => {
        console.error('[VoiceChannelEvents] SSE error')
        this.isConnecting = false
        this.cleanupReconnectTimeout()
        this.eventSource?.close()
        this.eventSource = null

        // Attempt reconnection with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(
            1000 * Math.pow(2, this.reconnectAttempts),
            16000,
          )
          this.reconnectAttempts++

          console.log(
            `[VoiceChannelEvents] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
          )

          this.reconnectTimeout = setTimeout(() => {
            this.connect()
          }, delay)
        } else {
          console.error(
            '[VoiceChannelEvents] Max reconnection attempts reached',
          )
          const maxRetriesError = new Error(
            'SSE connection failed after max retries',
          )
          this.listeners.forEach((listener) => {
            listener.onError?.(maxRetriesError)
          })
        }
      }
    } catch (error) {
      console.error(
        '[VoiceChannelEvents] Failed to create SSE connection:',
        error,
      )
      this.isConnecting = false
      const sseCreationError =
        error instanceof Error
          ? error
          : new Error('Failed to create SSE connection')
      this.listeners.forEach((listener) => {
        listener.onError?.(sseCreationError)
      })
    } finally {
      this.isConnecting = false
    }
  }

  disconnect(): void {
    this.cleanupReconnectTimeout()
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    console.log('[VoiceChannelEvents] Disconnected from SSE')
  }

  reconnect(): void {
    this.reconnectAttempts = 0
    this.connect()
  }
}

/**
 * Hook to establish WebSocket connection and listen for voice channel events
 *
 * Handles:
 * - Shared WebSocket connection via singleton manager
 * - Automatic reconnection on disconnect
 * - Event filtering for current user
 * - Cleanup on unmount
 */
export function useVoiceChannelEvents({
  jwtToken,
  userId,
  onVoiceStateUpdate,
  onError,
  onConnectionStatusUpdate,
}: UseVoiceChannelEventsOptions) {
  const manager = useMemo(() => VoiceChannelSSEManager.getInstance(), [])

  // Store callbacks in a ref to avoid recreating listener on every render
  const callbacksRef = useRef({
    onVoiceStateUpdate,
    onError,
    onConnectionStatusUpdate,
  })
  useEffect(() => {
    callbacksRef.current = {
      onVoiceStateUpdate,
      onError,
      onConnectionStatusUpdate,
    }
  }, [onVoiceStateUpdate, onError, onConnectionStatusUpdate])

  // Set JWT token when it changes
  useEffect(() => {
    if (jwtToken) {
      manager.setJwtToken(jwtToken)
    }
  }, [jwtToken, manager])

  // Set user ID when it changes
  useEffect(() => {
    if (userId) {
      manager.setUserId(userId)
    }
  }, [userId, manager])

  // Register listener once and keep it registered (don't remove on unmount)
  useEffect(() => {
    const listener = {
      onVoiceStateUpdate: (voiceState: APIVoiceState) =>
        callbacksRef.current.onVoiceStateUpdate?.(voiceState),
      onError: (error: Error) => callbacksRef.current.onError?.(error),
      onConnectionStatusUpdate: (connectedUserIds: string[]) =>
        callbacksRef.current.onConnectionStatusUpdate?.(connectedUserIds),
    }
    manager.addListener(listener)
    // Note: We intentionally don't remove the listener on unmount
    // The WebSocket connection should persist for the lifetime of the app
    // and be reused by other components that need it
  }, [manager])

  return useMemo(
    () => ({
      isConnected: manager.isConnected(),
      reconnect: () => manager.reconnect(),
    }),
    [manager],
  )
}
