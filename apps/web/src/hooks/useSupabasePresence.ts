/**
 * useSupabasePresence - React hook for Supabase Presence
 *
 * Thin wrapper around PresenceManager for React components.
 * Uses useSyncExternalStore for optimal concurrent rendering support.
 */

import type { Participant } from '@/types/participant'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { channelManager } from '@/lib/supabase/channel-manager'
import { supabase } from '@/lib/supabase/client'
import { PresenceManager } from '@/lib/supabase/presence'

interface UseSupabasePresenceProps {
  roomId: string
  userId: string
  username: string
  avatar?: string | null
  enabled?: boolean
  onKicked?: () => void
}

interface UseSupabasePresenceReturn {
  participants: Participant[]
  isLoading: boolean
  error: Error | null
  /** The ID of the room owner (first participant to join) */
  ownerId: string | null
  /** Whether the current user is the room owner */
  isOwner: boolean
  /** Kick a player (temporary - they can rejoin) */
  kickPlayer: (playerId: string) => Promise<void>
  /** Ban a player (persistent - they cannot rejoin until unbanned) */
  banPlayer: (playerId: string) => Promise<void>
}

/**
 * Store snapshot containing participants, loading, and error state
 */
interface PresenceSnapshot {
  participants: Participant[]
  isLoading: boolean
  error: Error | null
}

/**
 * Store for managing presence state for a specific room
 */
interface PresenceStore {
  snapshot: PresenceSnapshot
  listeners: Set<() => void>
  manager: PresenceManager | null
  roomConfig: {
    roomId: string
    userId: string
    username: string
    avatar?: string | null
  } | null
}

const DEFAULT_PRESENCE_SNAPSHOT: PresenceSnapshot = {
  participants: [],
  isLoading: true,
  error: null,
}

/**
 * Global map of room stores
 * Key: roomId
 */
const roomStores = new Map<string, PresenceStore>()

/**
 * Get or create a store for a specific room
 */
function getOrCreateRoomStore(roomId: string): PresenceStore {
  let store = roomStores.get(roomId)

  if (!store) {
    console.log('[PresenceStore] Creating new store for room:', roomId)
    store = {
      snapshot: DEFAULT_PRESENCE_SNAPSHOT,
      listeners: new Set(),
      manager: null,
      roomConfig: null,
    }
    roomStores.set(roomId, store)
  }

  return store
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(store: PresenceStore): void {
  store.listeners.forEach((listener) => listener())
}

/**
 * Initialize presence manager for a room
 */
function initializeManager(
  store: PresenceStore,
  roomId: string,
  userId: string,
  username: string,
  avatar?: string | null,
): void {
  if (store.manager) {
    console.log('[PresenceStore] Manager already exists for room:', roomId)
    return
  }

  console.log('[PresenceStore] Initializing PresenceManager for room:', roomId)

  const manager = new PresenceManager({
    onParticipantsUpdate: (updatedParticipants) => {
      console.log('[PresenceStore] Participants updated:', updatedParticipants)
      store.snapshot = {
        participants: updatedParticipants,
        isLoading: false,
        error: null,
      }
      notifyListeners(store)
    },
    onError: (err) => {
      console.error('[PresenceStore] Error:', err)
      store.snapshot = {
        ...store.snapshot,
        isLoading: false,
        error: err,
      }
      notifyListeners(store)
    },
  })

  store.manager = manager
  store.roomConfig = { roomId, userId, username, avatar }

  manager
    .join(roomId, userId, username, avatar)
    .then(() => {
      console.log('[PresenceStore] Successfully joined room:', roomId)
      const currentParticipants = manager.getParticipants()
      store.snapshot = {
        participants: currentParticipants,
        isLoading: false,
        error: null,
      }
      notifyListeners(store)
    })
    .catch((err) => {
      console.error('[PresenceStore] Error joining room:', err)
      store.snapshot = {
        participants: [],
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      }
      notifyListeners(store)
    })
}

/**
 * Destroy manager and clean up store
 */
function destroyManager(store: PresenceStore, roomId: string): void {
  if (!store.manager) return

  console.log('[PresenceStore] Destroying manager for room:', roomId)

  const managerToDestroy = store.manager
  store.manager = null
  store.roomConfig = null
  store.snapshot = DEFAULT_PRESENCE_SNAPSHOT

  managerToDestroy.destroy().catch((err) => {
    console.error('[PresenceStore] Error destroying manager:', err)
  })

  if (store.listeners.size === 0) {
    roomStores.delete(roomId)
    console.log('[PresenceStore] Removed store for room:', roomId)
  }
}

/**
 * Subscribe to presence updates for a room
 */
function subscribeToRoom(
  roomId: string,
  userId: string,
  username: string,
  avatar: string | null | undefined,
  enabled: boolean,
  callback: () => void,
): () => void {
  if (!enabled || !roomId || !userId || !username) {
    return () => {}
  }

  const store = getOrCreateRoomStore(roomId)
  store.listeners.add(callback)

  if (!store.manager) {
    initializeManager(store, roomId, userId, username, avatar)
  }

  return () => {
    store.listeners.delete(callback)

    if (store.listeners.size === 0 && store.manager) {
      console.log(
        '[PresenceStore] Last listener removed, destroying manager for room:',
        roomId,
      )
      destroyManager(store, roomId)
    }
  }
}

/**
 * Get current snapshot for a room
 */
function getSnapshot(roomId: string): PresenceSnapshot {
  const store = roomStores.get(roomId)

  if (!store) {
    return DEFAULT_PRESENCE_SNAPSHOT
  }

  return store.snapshot
}

/**
 * Get server-side snapshot (always returns empty state)
 */
function getServerSnapshot(): PresenceSnapshot {
  return DEFAULT_PRESENCE_SNAPSHOT
}

/**
 * Kick event payload type
 */
interface KickEventPayload {
  kickedUserId: string
  kickedBy: string
  isBan: boolean
}

/**
 * Broadcast a kick/ban event to remove a player from the room
 * This tells the player's client to leave immediately
 */
async function broadcastRemovalEvent(
  roomId: string,
  kickedUserId: string,
  kickedBy: string,
  isBan: boolean,
): Promise<void> {
  const channel = channelManager.getChannel(roomId)

  const payload: KickEventPayload = {
    kickedUserId,
    kickedBy,
    isBan,
  }

  console.log('[PresenceStore] Broadcasting removal event:', payload)
  const response = await channel.send({
    type: 'broadcast',
    event: 'player:kicked',
    payload,
  })

  if (response === 'error') {
    throw new Error('Failed to broadcast removal event')
  }
}

/**
 * Create a ban record in Supabase to prevent the user from rejoining
 * Note: Requires the room_bans table from migration 002_room_bans.sql
 * and updated RLS policies on realtime.messages
 */
async function createBanRecord(
  roomId: string,
  bannedUserId: string,
  bannedBy: string,
): Promise<void> {
  const { error } = await supabase.from('room_bans').upsert(
    {
      room_id: roomId,
      user_id: bannedUserId,
      banned_by: bannedBy,
      reason: 'Banned by lobby owner',
    },
    {
      onConflict: 'room_id,user_id',
    },
  )

  if (error) {
    // Log but don't fail - the ban table might not exist yet
    console.warn('[PresenceStore] Failed to create ban record:', error.message)
    console.warn(
      '[PresenceStore] Note: Run migration 002_room_bans.sql to enable persistent bans',
    )
  } else {
    console.log('[PresenceStore] Ban record created for user:', bannedUserId)
  }
}

/**
 * Hook to track game room participants using Supabase Presence
 */
export function useSupabasePresence({
  roomId,
  userId,
  username,
  avatar,
  enabled = true,
  onKicked,
}: UseSupabasePresenceProps): UseSupabasePresenceReturn {
  // Memoize subscribe function to prevent re-subscriptions on every render
  const subscribe = useCallback(
    (callback: () => void) =>
      subscribeToRoom(roomId, userId, username, avatar, enabled, callback),
    [roomId, userId, username, avatar, enabled],
  )

  // Memoize getSnapshot function
  const getSnapshotForRoom = useCallback(() => getSnapshot(roomId), [roomId])

  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshotForRoom,
    getServerSnapshot,
  )

  // Listen for kick/ban events
  useEffect(() => {
    if (!enabled || !roomId || !userId || !onKicked) return

    const channel = channelManager.getChannel(roomId)

    const handleKickEvent = (payload: { payload: KickEventPayload }) => {
      console.log('[PresenceStore] Received removal event:', payload.payload)

      if (payload.payload.kickedUserId === userId) {
        const action = payload.payload.isBan ? 'banned' : 'kicked'
        console.log(
          `[PresenceStore] Current user was ${action}, calling onKicked`,
        )
        onKicked()
      }
    }

    channel.on('broadcast', { event: 'player:kicked' }, handleKickEvent)

    return () => {
      // Note: Supabase doesn't have a direct off() method for specific handlers,
      // but the channel cleanup happens when the presence subscription ends
    }
  }, [roomId, userId, enabled, onKicked])

  // Kick a player (temporary - they can rejoin)
  const kickPlayer = useCallback(
    async (playerId: string): Promise<void> => {
      if (!roomId || !userId) {
        throw new Error('Cannot kick player: not connected to room')
      }

      await broadcastRemovalEvent(roomId, playerId, userId, false)
    },
    [roomId, userId],
  )

  // Ban a player (persistent - they cannot rejoin)
  const banPlayer = useCallback(
    async (playerId: string): Promise<void> => {
      if (!roomId || !userId) {
        throw new Error('Cannot ban player: not connected to room')
      }

      // First create the ban record (prevents rejoin)
      await createBanRecord(roomId, playerId, userId)

      // Then broadcast the ban event (tells client to leave immediately)
      await broadcastRemovalEvent(roomId, playerId, userId, true)
    },
    [roomId, userId],
  )

  // Compute owner ID - the first participant (sorted by joinedAt) is the room creator
  const ownerId = snapshot.participants[0]?.id ?? null
  const isOwner = ownerId !== null && ownerId === userId

  return {
    participants: snapshot.participants,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
    ownerId,
    isOwner,
    kickPlayer,
    banPlayer,
  }
}
