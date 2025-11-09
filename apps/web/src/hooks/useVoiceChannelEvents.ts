import { useEffect, useMemo, useRef } from 'react'

import type { APIVoiceState } from '@repo/discord-integration/clients'

import {
  isSSEAckMessage,
  isSSECustomEventMessage,
  isSSEDiscordEventMessage,
  isSSEErrorMessage,
  isSSEWebRTCSignalingMessage,
  SSEMessageSchema,
  type SSEWebRTCSignalingMessage,
} from '../types/sse-messages'

interface UseVoiceChannelEventsOptions {
  jwtToken?: string
  userId?: string
  channelId?: string
  onVoiceStateUpdate?: (voiceState: APIVoiceState) => void
  onError?: (error: Error) => void
  onConnectionStatusUpdate?: (connectedUserIds: string[]) => void
  onWebRTCSignaling?: (message: SSEWebRTCSignalingMessage) => void
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
  private channelId: string | null = null
  private isConnecting = false
  private isIntentionalDisconnect = false
  private listeners: Set<{
    onVoiceStateUpdate?: (voiceState: APIVoiceState) => void
    onError?: (error: Error) => void
    onConnectionStatusUpdate?: (connectedUserIds: string[]) => void
    onWebRTCSignaling?: (message: SSEWebRTCSignalingMessage) => void
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
    onWebRTCSignaling?: (message: SSEWebRTCSignalingMessage) => void
  }): void {
    this.listeners.add(listener)
  }

  removeListener(listener: {
    onVoiceStateUpdate?: (voiceState: APIVoiceState) => void
    onError?: (error: Error) => void
    onConnectionStatusUpdate?: (connectedUserIds: string[]) => void
    onWebRTCSignaling?: (message: SSEWebRTCSignalingMessage) => void
  }): void {
    this.listeners.delete(listener)
  }

  setJwtToken(token: string | undefined): void {
    this.jwtToken = token || null
  }

  setUserId(userId: string | undefined): void {
    const newUserId = userId || null

    if (this.userId === newUserId) {
      return
    }

    if (this.userId !== null && newUserId !== this.userId && this.eventSource) {
      this.disconnect()
    }

    this.userId = newUserId
  }

  setChannelId(channelId: string | undefined): void {
    const newChannelId = channelId || null

    if (this.channelId === newChannelId) {
      return
    }

    if (this.channelId !== null && newChannelId !== this.channelId && this.eventSource) {
      this.disconnect()
    }

    this.channelId = newChannelId
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }

  connect(): void {
    if (this.eventSource) {
      this.disconnect()
    }

    if (this.isConnecting) {
      return
    }

    if (this.eventSource?.readyState === EventSource.CONNECTING) {
      return
    }

    if (this.eventSource?.readyState === EventSource.OPEN) {
      return
    }

    if (!this.jwtToken || !this.userId || !this.channelId) {
      return
    }

    this.isConnecting = true
    this.isIntentionalDisconnect = false

    try {
      const sseUrl = `/api/stream?userId=${encodeURIComponent(this.userId)}&channelId=${encodeURIComponent(this.channelId)}`
      this.eventSource = new EventSource(sseUrl, {
        withCredentials: true,
      })

      this.eventSource.onopen = () => {
        this.isConnecting = false
        this.reconnectAttempts = 0
      }

      this.eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)

          // Validate message with Zod schema
          const result = SSEMessageSchema.safeParse(parsed)

          if (!result.success) {
            return
          }

          const message = result.data

          if (isSSEAckMessage(message)) {
            this.reconnectAttempts = 0
            return
          }

          if (isSSEErrorMessage(message)) {
            const error = new Error(message.message)
            this.listeners.forEach((listener) => {
              listener.onError?.(error)
            })
            return
          }

          if (isSSEDiscordEventMessage(message)) {
            if (message.event === 'VOICE_STATE_UPDATE') {
              const voiceState = message.payload as APIVoiceState
              this.listeners.forEach((listener) => {
                listener.onVoiceStateUpdate?.(voiceState)
              })
            }
          }

          if (
            isSSECustomEventMessage(message) &&
            message.event === 'users.connection_status'
          ) {
            const payload = message.payload
            this.listeners.forEach((listener) => {
              listener.onConnectionStatusUpdate?.(payload.connectedUserIds)
            })
          }

          // Handle WebRTC signaling messages
          if (isSSEWebRTCSignalingMessage(message)) {
            this.listeners.forEach((listener) => {
              listener.onWebRTCSignaling?.(message)
            })
          }
        } catch (error) {
          const parseError =
            error instanceof Error
              ? error
              : new Error('Failed to parse SSE message')
          this.listeners.forEach((listener) => {
            listener.onError?.(parseError)
          })
        }
      }

      this.eventSource.onerror = () => {
        this.isConnecting = false
        this.cleanupReconnectTimeout()
        this.eventSource?.close()
        this.eventSource = null

        if (this.isIntentionalDisconnect) {
          this.isIntentionalDisconnect = false
          return
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(
            1000 * Math.pow(2, this.reconnectAttempts),
            16000,
          )
          this.reconnectAttempts++

          this.reconnectTimeout = setTimeout(() => {
            this.connect()
          }, delay)
        } else {
          const maxRetriesError = new Error(
            'SSE connection failed after max retries',
          )
          this.listeners.forEach((listener) => {
            listener.onError?.(maxRetriesError)
          })
        }
      }
    } catch (error) {
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
    this.isIntentionalDisconnect = true
    this.cleanupReconnectTimeout()
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.isConnecting = false
    this.reconnectAttempts = 0
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
  channelId,
  onVoiceStateUpdate,
  onError,
  onConnectionStatusUpdate,
  onWebRTCSignaling,
}: UseVoiceChannelEventsOptions) {
  const manager = useMemo(() => {
    const instance = VoiceChannelSSEManager.getInstance()
    if (instance.isConnected()) {
      instance.disconnect()
    }
    return instance
  }, [])

  const callbacksRef = useRef({
    onVoiceStateUpdate,
    onError,
    onConnectionStatusUpdate,
    onWebRTCSignaling,
  })
  useEffect(() => {
    callbacksRef.current = {
      onVoiceStateUpdate,
      onError,
      onConnectionStatusUpdate,
      onWebRTCSignaling,
    }
  }, [onVoiceStateUpdate, onError, onConnectionStatusUpdate, onWebRTCSignaling])

  useEffect(() => {
    manager.disconnect()
    manager.setJwtToken(jwtToken)
    manager.setUserId(userId)
    manager.setChannelId(channelId)
    
    if (jwtToken && userId && channelId) {
      manager.connect()
    }

    return () => {
      manager.disconnect()
    }
  }, [jwtToken, userId, channelId, manager])

  useEffect(() => {
    const listener = {
      onVoiceStateUpdate: (voiceState: APIVoiceState) =>
        callbacksRef.current.onVoiceStateUpdate?.(voiceState),
      onError: (error: Error) => callbacksRef.current.onError?.(error),
      onConnectionStatusUpdate: (connectedUserIds: string[]) =>
        callbacksRef.current.onConnectionStatusUpdate?.(connectedUserIds),
      onWebRTCSignaling: (message: SSEWebRTCSignalingMessage) =>
        callbacksRef.current.onWebRTCSignaling?.(message),
    }
    manager.addListener(listener)
  }, [manager])

  return useMemo(
    () => ({
      isConnected: manager.isConnected(),
      reconnect: () => manager.reconnect(),
    }),
    [manager],
  )
}
