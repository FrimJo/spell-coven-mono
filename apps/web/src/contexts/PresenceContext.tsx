/**
 * PresenceContext - Provides room presence state to all child components
 *
 * This context wraps the presence hook and provides a single source of truth
 * for presence data. Child components consume via usePresence() hook.
 *
 * Benefits:
 * - Single hook instance (no reference counting complexity)
 * - Centralized connect/disconnect control
 * - No prop drilling for enabled state
 * - Computed values (uniqueParticipants, etc.) calculated once
 */

import type { Participant } from '@/types/participant'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useConvexPresence } from '@/hooks/useConvexPresence'

export type DisconnectReason = 'kicked' | 'banned' | 'disconnected' | 'left'

interface PresenceContextValue {
  /** All participants including duplicate sessions */
  participants: Participant[]
  /** Participants deduplicated by userId (for display) */
  uniqueParticipants: Participant[]
  /** Whether presence is currently loading */
  isLoading: boolean
  /** Current error, if any */
  error: Error | null
  /** The ID of the room owner (first participant to join) */
  ownerId: string | null
  /** Whether the current user is the room owner */
  isOwner: boolean
  /** Current session ID for this tab */
  sessionId: string
  /** Whether there's a duplicate session for this user */
  hasDuplicateSession: boolean
  /** Whether currently connected to presence */
  isConnected: boolean
  /** Reason for last disconnect (if disconnected) */
  disconnectReason: DisconnectReason | null
  /** Room seat count (1-4, defaults to 4) */
  roomSeatCount: number

  // Actions
  /** Connect to presence (rejoin) */
  connect: () => void
  /** Disconnect from presence */
  disconnect: (reason: DisconnectReason) => void
  /** Explicitly leave the room (call before navigating away) */
  leaveRoom: () => Promise<void>
  /** Kick a player (temporary - they can rejoin) */
  kickPlayer: (playerId: string) => Promise<void>
  /** Ban a player (persistent - they cannot rejoin until unbanned) */
  banPlayer: (playerId: string) => Promise<void>
  /** Transfer session to this tab (kicks other tabs) */
  transferSession: () => Promise<void>
  /** Set room seat count (owner only) */
  setRoomSeatCount: (seatCount: number) => Promise<{ seatCount: number }>
}

const PresenceContext = createContext<PresenceContextValue | null>(null)

interface PresenceProviderProps {
  roomId: string
  children: React.ReactNode
  /** Called when a duplicate session is detected */
  onDuplicateSession?: (existingSessionId: string) => void
  /** Called when this session should be closed (transfer happened in another tab) */
  onSessionTransferred?: () => void
}

export function PresenceProvider({
  roomId,
  children,
  onDuplicateSession,
  onSessionTransferred,
}: PresenceProviderProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const username = user?.username ?? 'Unknown'
  const avatar = user?.avatar

  const [isConnected, setIsConnected] = useState(true)
  const [disconnectReason, setDisconnectReason] =
    useState<DisconnectReason | null>(null)

  // Callbacks for presence events
  const handleKicked = useCallback(() => {
    console.log('[PresenceProvider] User was kicked')
    setDisconnectReason('kicked')
    setIsConnected(false)
  }, [])

  const handleBanned = useCallback(() => {
    console.log('[PresenceProvider] User was banned')
    setDisconnectReason('banned')
    setIsConnected(false)
  }, [])

  const handleError = useCallback((error: Error) => {
    console.error('[PresenceProvider] Presence error:', error)
    setDisconnectReason('disconnected')
    setIsConnected(false)
  }, [])

  // Wrap onSessionTransferred to immediately disconnect (prevent rejoining)
  const handleSessionTransferred = useCallback(() => {
    console.log('[PresenceProvider] Session transferred to another tab')
    // Immediately disconnect to prevent the hook from rejoining
    setIsConnected(false)
    // Then call the parent callback
    onSessionTransferred?.()
  }, [onSessionTransferred])

  // Single source of truth for presence using Convex
  const presence = useConvexPresence({
    roomId,
    userId,
    username,
    avatar,
    enabled: isConnected,
    onKicked: handleKicked,
    onBanned: handleBanned,
    onDuplicateSession,
    onSessionTransferred: handleSessionTransferred,
    onError: handleError,
  })

  // Connect callback - reconnects to presence
  const connect = useCallback(() => {
    console.log('[PresenceProvider] Connecting to presence')
    setDisconnectReason(null)
    setIsConnected(true)
  }, [])

  // Disconnect callback - disconnects from presence with a reason
  const disconnect = useCallback((reason: DisconnectReason) => {
    console.log('[PresenceProvider] Disconnecting from presence:', reason)
    setDisconnectReason(reason)
    setIsConnected(false)
  }, [])

  // Memoize actions separately to prevent recreation
  const actions = useMemo(
    () => ({
      leaveRoom: presence.leaveRoom,
      kickPlayer: presence.kickPlayer,
      banPlayer: presence.banPlayer,
      transferSession: presence.transferSession,
      setRoomSeatCount: presence.setRoomSeatCount,
    }),
    [
      presence.leaveRoom,
      presence.kickPlayer,
      presence.banPlayer,
      presence.transferSession,
      presence.setRoomSeatCount,
    ],
  )

  const value = useMemo<PresenceContextValue>(
    () => ({
      participants: presence.participants,
      uniqueParticipants: presence.uniqueParticipants,
      isLoading: presence.isLoading,
      error: presence.error,
      ownerId: presence.ownerId,
      isOwner: presence.isOwner,
      sessionId: presence.sessionId,
      hasDuplicateSession: presence.hasDuplicateSession,
      roomSeatCount: presence.roomSeatCount,
      isConnected,
      disconnectReason,
      connect,
      disconnect,
      leaveRoom: actions.leaveRoom,
      kickPlayer: actions.kickPlayer,
      banPlayer: actions.banPlayer,
      transferSession: actions.transferSession,
      setRoomSeatCount: actions.setRoomSeatCount,
    }),
    [
      presence.participants,
      presence.uniqueParticipants,
      presence.isLoading,
      presence.error,
      presence.ownerId,
      presence.isOwner,
      presence.sessionId,
      presence.hasDuplicateSession,
      presence.roomSeatCount,
      isConnected,
      disconnectReason,
      connect,
      disconnect,
      actions.leaveRoom,
      actions.kickPlayer,
      actions.banPlayer,
      actions.transferSession,
      actions.setRoomSeatCount,
    ],
  )

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  )
}

/**
 * Hook to access presence data and actions from any child component
 */
export function usePresence(): PresenceContextValue {
  const context = useContext(PresenceContext)

  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider')
  }

  return context
}
