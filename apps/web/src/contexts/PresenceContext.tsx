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
 *
 * NOTE: Migrated from Supabase to Convex in Phase 3.
 * Set USE_CONVEX_PRESENCE to false to revert to Supabase presence.
 */

import type { Participant } from '@/types/participant'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useConvexPresence } from '@/hooks/useConvexPresence'
import { useSupabasePresence } from '@/hooks/useSupabasePresence'

/**
 * Feature flag to toggle between Convex and Supabase presence.
 * Set to false to revert to Supabase if issues arise.
 */
const USE_CONVEX_PRESENCE = true

export type DisconnectReason = 'kicked' | 'disconnected' | 'left'

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

  // Actions
  /** Connect to presence (rejoin) */
  connect: () => void
  /** Disconnect from presence */
  disconnect: (reason: DisconnectReason) => void
  /** Kick a player (temporary - they can rejoin) */
  kickPlayer: (playerId: string) => Promise<void>
  /** Ban a player (persistent - they cannot rejoin until unbanned) */
  banPlayer: (playerId: string) => Promise<void>
  /** Transfer session to this tab (kicks other tabs) */
  transferSession: () => Promise<void>
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

  // Use ref to track disconnect reason for the kicked callback
  // This avoids stale closure issues
  const disconnectReasonRef = useRef<DisconnectReason | null>(null)

  // Callbacks for presence events
  const handleKicked = useCallback(() => {
    console.log('[PresenceProvider] User was kicked')
    disconnectReasonRef.current = 'kicked'
    setDisconnectReason('kicked')
    setIsConnected(false)
  }, [])

  const handleError = useCallback((error: Error) => {
    console.error('[PresenceProvider] Presence error:', error)
    disconnectReasonRef.current = 'disconnected'
    setDisconnectReason('disconnected')
    setIsConnected(false)
  }, [])

  // Single source of truth for presence
  // Use Convex or Supabase based on feature flag
  const convexPresence = useConvexPresence({
    roomId,
    userId,
    username,
    avatar,
    enabled: USE_CONVEX_PRESENCE && isConnected,
    onKicked: handleKicked,
    onDuplicateSession,
    onSessionTransferred,
    onError: handleError,
  })

  const supabasePresence = useSupabasePresence({
    roomId,
    userId,
    username,
    avatar,
    enabled: !USE_CONVEX_PRESENCE && isConnected,
    onKicked: handleKicked,
    onDuplicateSession,
    onSessionTransferred,
    onError: handleError,
  })

  // Use the active presence hook based on feature flag
  const presence = USE_CONVEX_PRESENCE ? convexPresence : supabasePresence

  // Connect callback - reconnects to presence
  const connect = useCallback(() => {
    console.log('[PresenceProvider] Connecting to presence')
    setDisconnectReason(null)
    disconnectReasonRef.current = null
    setIsConnected(true)
  }, [])

  // Disconnect callback - disconnects from presence with a reason
  const disconnect = useCallback((reason: DisconnectReason) => {
    console.log('[PresenceProvider] Disconnecting from presence:', reason)
    disconnectReasonRef.current = reason
    setDisconnectReason(reason)
    setIsConnected(false)
  }, [])

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
      isConnected,
      disconnectReason,
      connect,
      disconnect,
      kickPlayer: presence.kickPlayer,
      banPlayer: presence.banPlayer,
      transferSession: presence.transferSession,
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
      presence.kickPlayer,
      presence.banPlayer,
      presence.transferSession,
      isConnected,
      disconnectReason,
      connect,
      disconnect,
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
