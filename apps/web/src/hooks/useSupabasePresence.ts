/**
 * useSupabasePresence - React hook for Supabase Presence
 *
 * Thin wrapper around PresenceManager for React components.
 * Uses useSyncExternalStore for optimal concurrent rendering support.
 */

import type { Participant } from '@/types/participant'
import { useCallback, useSyncExternalStore } from 'react'
import { PresenceManager } from '@/lib/supabase/presence'

interface UseSupabasePresenceProps {
  roomId: string
  userId: string
  username: string
  avatar?: string | null
  enabled?: boolean
}

interface UseSupabasePresenceReturn {
  participants: Participant[]
  isLoading: boolean
  error: Error | null
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
 * Hook to track game room participants using Supabase Presence
 */
export function useSupabasePresence({
  roomId,
  userId,
  username,
  avatar,
  enabled = true,
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

  return {
    participants: snapshot.participants,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
  }
}
