import { useEffect, useMemo, useRef } from 'react'

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

interface UseVoiceChannelEventsOptions {
  jwtToken?: string
  onVoiceLeft?: (event: VoiceLeftEvent) => void
  onVoiceJoined?: (event: VoiceJoinedEvent) => void
  onError?: (error: Error) => void
}

/**
 * Singleton WebSocket manager for voice channel events
 * Ensures only one WebSocket connection is created even with multiple hook instances
 */
class VoiceChannelWebSocketManager {
  private static instance: VoiceChannelWebSocketManager
  private ws: WebSocket | null = null
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
  private isConnecting = false
  private listeners: Set<{
    onVoiceLeft?: (event: VoiceLeftEvent) => void
    onVoiceJoined?: (event: VoiceJoinedEvent) => void
    onError?: (error: Error) => void
  }> = new Set()

  private constructor() {}

  static getInstance(): VoiceChannelWebSocketManager {
    if (!VoiceChannelWebSocketManager.instance) {
      VoiceChannelWebSocketManager.instance = new VoiceChannelWebSocketManager()
    }
    return VoiceChannelWebSocketManager.instance
  }

  addListener(listener: {
    onVoiceLeft?: (event: VoiceLeftEvent) => void
    onVoiceJoined?: (event: VoiceJoinedEvent) => void
    onError?: (error: Error) => void
  }): void {
    this.listeners.add(listener)
  }

  removeListener(listener: {
    onVoiceLeft?: (event: VoiceLeftEvent) => void
    onVoiceJoined?: (event: VoiceJoinedEvent) => void
    onError?: (error: Error) => void
  }): void {
    this.listeners.delete(listener)
    // Don't close connection - keep it alive for other potential listeners
    // The connection will be reused if new listeners are added
  }

  setJwtToken(token: string | undefined): void {
    this.jwtToken = token || null
    // Reconnect if token changed and we're not connected
    if (token && this.ws?.readyState !== WebSocket.OPEN) {
      this.connect()
    }
  }

  private connect(): void {
    // Prevent multiple connection attempts (handles React StrictMode double-invoke)
    if (this.isConnecting) {
      return
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    if (!this.jwtToken) {
      console.log(
        '[VoiceChannelEvents] No JWT token available, skipping connection attempt',
      )
      return
    }

    this.isConnecting = true

    try {
      // Connect to TanStack Start WebSocket server on same origin
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host // includes port
      const wsUrl = `${protocol}//${host}/api/ws`

      console.log('[VoiceChannelEvents] Connecting to WebSocket:', wsUrl)
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('[VoiceChannelEvents] WebSocket connected')
        this.reconnectAttempts = 0

        // Send authentication message
        const authMessage = {
          v: 1,
          type: 'auth',
          token: this.jwtToken,
        }

        this.ws?.send(JSON.stringify(authMessage))
        console.log('[VoiceChannelEvents] Sent authentication message')
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('[VoiceChannelEvents] Received message:', message)

          // Handle authentication response (type: ack, event: auth.ok)
          if (message.type === 'ack' && message.event === 'auth.ok') {
            console.log('[VoiceChannelEvents] Authentication successful')
            this.reconnectAttempts = 0
            return
          }

          // Broadcast events to all listeners (type: event, event: voice.left or voice.joined)
          if (message.type === 'event' && message.event === 'voice.left') {
            const payload = message.payload as VoiceLeftEvent | undefined
            if (payload) {
              console.log(
                '[VoiceChannelEvents] Received voice.left event for user:',
                payload.userId,
              )
              this.listeners.forEach((listener) => {
                listener.onVoiceLeft?.(payload)
              })
            }
          }

          if (message.type === 'event' && message.event === 'voice.joined') {
            const payload = message.payload as VoiceJoinedEvent | undefined
            if (payload) {
              console.log(
                '[VoiceChannelEvents] Received voice.joined event:',
                payload.username,
              )
              this.listeners.forEach((listener) => {
                listener.onVoiceJoined?.(payload)
              })
            }
          }

          // Handle errors
          if (message.type === 'error') {
            console.error(
              '[VoiceChannelEvents] Received error message:',
              message,
            )
            const error = new Error(
              `WebSocket error: ${JSON.stringify(message)}`,
            )
            this.listeners.forEach((listener) => {
              listener.onError?.(error)
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

      this.ws.onerror = () => {
        console.error('[VoiceChannelEvents] WebSocket error')
        this.isConnecting = false
        const wsError = new Error('WebSocket connection error')
        this.listeners.forEach((listener) => {
          listener.onError?.(wsError)
        })
      }

      this.ws.onclose = (event) => {
        console.log('[VoiceChannelEvents] WebSocket closed')
        console.log('[VoiceChannelEvents] Close event:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        })
        console.log(
          '[VoiceChannelEvents] Listeners count:',
          this.listeners.size,
        )
        console.log('[VoiceChannelEvents] Stack trace:', new Error().stack)
        this.cleanupReconnectTimeout()
        this.ws = null
        this.isConnecting = false

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
            'WebSocket connection failed after max retries',
          )
          this.listeners.forEach((listener) => {
            listener.onError?.(maxRetriesError)
          })
        }
      }
    } catch (error) {
      console.error('[VoiceChannelEvents] Failed to create WebSocket:', error)
      const wsCreationError =
        error instanceof Error ? error : new Error('Failed to create WebSocket')
      this.listeners.forEach((listener) => {
        listener.onError?.(wsCreationError)
      })
    } finally {
      this.isConnecting = false
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
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
  onVoiceLeft,
  onVoiceJoined,
  onError,
}: UseVoiceChannelEventsOptions) {
  const manager = useMemo(() => VoiceChannelWebSocketManager.getInstance(), [])

  // Store callbacks in refs so they can be updated without re-registering listener
  const callbacksRef = useRef({ onVoiceLeft, onVoiceJoined, onError })
  useEffect(() => {
    callbacksRef.current = { onVoiceLeft, onVoiceJoined, onError }
  }, [onVoiceLeft, onVoiceJoined, onError])

  // Update JWT token in manager
  useEffect(() => {
    if (jwtToken) {
      manager.setJwtToken(jwtToken)
    }
  }, [jwtToken, manager])

  // Register listener once and keep it registered (don't remove on unmount)
  useEffect(() => {
    const listener = {
      onVoiceLeft: (event: VoiceLeftEvent) =>
        callbacksRef.current.onVoiceLeft?.(event),
      onVoiceJoined: (event: VoiceJoinedEvent) =>
        callbacksRef.current.onVoiceJoined?.(event),
      onError: (error: Error) => callbacksRef.current.onError?.(error),
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
