import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  ConnectionStateEvent,
  GatewayEventData,
} from '@repo/discord-integration/clients'
import type {
  GatewayConnection,
  GatewayEventType,
} from '@repo/discord-integration/types'
import { DiscordGatewayClient } from '@repo/discord-integration/clients'

/**
 * Discord Gateway Connection Hook
 * Bridge layer between DiscordGatewayClient and React UI
 *
 * Responsibilities:
 * - Manages Gateway lifecycle (connect on auth, disconnect on logout)
 * - Subscribes to connection state changes
 * - Provides event subscription API for components
 * - Exposes connection state and manual retry
 *
 * SoC: React state management, consumes DiscordGatewayClient
 */

export interface UseDiscordConnectionReturn {
  connectionState: GatewayConnection
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  hasError: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  retry: () => Promise<void>
  on: <T = unknown>(
    eventType: GatewayEventType,
    listener: (data: T) => void,
  ) => () => void
  onAnyEvent: (listener: (data: GatewayEventData) => void) => () => void
}

export function useDiscordConnection(
  accessToken: string | null,
): UseDiscordConnectionReturn {
  const [connectionState, setConnectionState] = useState<GatewayConnection>({
    version: '1.0',
    state: 'disconnected',
    reconnectAttempts: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef<DiscordGatewayClient | null>(null)

  // Initialize Gateway client when token is available
  useEffect(() => {
    if (!accessToken) {
      // No token, disconnect if connected
      if (clientRef.current) {
        clientRef.current.disconnect()
        clientRef.current = null
      }
      return
    }

    // Create new client with token
    if (!clientRef.current) {
      clientRef.current = new DiscordGatewayClient(accessToken)

      // Subscribe to state changes
      const unsubscribe = clientRef.current.onStateChange(
        (event: ConnectionStateEvent) => {
          setConnectionState(clientRef.current!.getState())
          setError(event.error ?? null)
        },
      )

      // Auto-connect on mount
      clientRef.current.connect().catch((err: unknown) => {
        console.error('[useDiscordConnection] Failed to connect:', err)
        setError(err instanceof Error ? err.message : 'Connection failed')
      })

      // Cleanup on unmount
      return () => {
        unsubscribe()
        if (clientRef.current) {
          clientRef.current.disconnect()
          clientRef.current = null
        }
      }
    }
  }, [accessToken])

  // Manual connect
  const connect = useCallback(async () => {
    if (!clientRef.current) {
      throw new Error('Gateway client not initialized')
    }
    await clientRef.current.connect()
  }, [])

  // Manual disconnect
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
    }
  }, [])

  // Manual retry (disconnect and reconnect)
  const retry = useCallback(async () => {
    if (!clientRef.current) {
      throw new Error('Gateway client not initialized')
    }
    clientRef.current.disconnect()
    await clientRef.current.connect()
  }, [])

  // Subscribe to specific event type
  const on = useCallback(
    <T = unknown>(
      eventType: GatewayEventType,
      listener: (data: T) => void,
    ): (() => void) => {
      if (!clientRef.current) {
        console.warn(
          '[useDiscordConnection] Cannot subscribe: client not initialized',
        )
        return () => {}
      }
      return clientRef.current.on<T>(eventType, listener)
    },
    [],
  )

  // Subscribe to all events
  const onAnyEvent = useCallback(
    (listener: (data: GatewayEventData) => void): (() => void) => {
      if (!clientRef.current) {
        console.warn(
          '[useDiscordConnection] Cannot subscribe: client not initialized',
        )
        return () => {}
      }
      return clientRef.current.onAnyEvent(listener)
    },
    [],
  )

  return {
    connectionState,
    isConnected: connectionState.state === 'connected',
    isConnecting: connectionState.state === 'connecting',
    isReconnecting: connectionState.state === 'reconnecting',
    hasError: connectionState.state === 'error',
    error,
    connect,
    disconnect,
    retry,
    on,
    onAnyEvent,
  }
}
