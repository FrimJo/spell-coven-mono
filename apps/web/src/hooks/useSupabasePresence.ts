/**
 * useSupabasePresence - React hook for Supabase Presence
 *
 * Thin wrapper around PresenceManager for React components.
 * Uses useSyncExternalStore for optimal concurrent rendering support.
 */

import type { Participant } from '@/types/participant'
import { useSyncExternalStore } from 'react'
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
  error: Error | null
}

/**
 * Store snapshot containing both participants and error state
 */
interface PresenceSnapshot {
  participants: Participant[]
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

/**
 * Global map of room stores
 * Key: roomId
 */
const roomStores = new Map<string, PresenceStore>()

/**
 * Create a key for the room store
 */
function getRoomStoreKey(roomId: string): string {
  return roomId
}

/**
 * Get or create a store for a specific room
 */
function getOrCreateRoomStore(roomId: string): PresenceStore {
  const key = getRoomStoreKey(roomId)
  let store = roomStores.get(key)

  if (!store) {
    console.log('[PresenceStore] Creating new store for room:', roomId)
    store = {
      snapshot: {
        participants: [],
        error: null,
      },
      listeners: new Set(),
      manager: null,
      roomConfig: null,
    }
    roomStores.set(key, store)
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

  // Create manager
  const manager = new PresenceManager({
    onParticipantsUpdate: (updatedParticipants) => {
      console.log('[PresenceStore] Participants updated:', updatedParticipants)
      // Update snapshot immutably
      store.snapshot = {
        participants: updatedParticipants,
        error: null,
      }
      // Notify all listeners
      notifyListeners(store)
    },
    onError: (err) => {
      console.error('[PresenceStore] Error:', err)
      // Update snapshot immutably
      store.snapshot = {
        ...store.snapshot,
        error: err,
      }
      // Notify all listeners
      notifyListeners(store)
    },
  })

  store.manager = manager
  store.roomConfig = { roomId, userId, username, avatar }

  // Join room asynchronously
  manager
    .join(roomId, userId, username, avatar)
    .then(() => {
      console.log('[PresenceStore] Successfully joined room:', roomId)
      // Initial sync
      const currentParticipants = manager.getParticipants()
      store.snapshot = {
        participants: currentParticipants,
        error: null,
      }
      // Notify all listeners
      notifyListeners(store)
    })
    .catch((err) => {
      console.error('[PresenceStore] Error joining room:', err)
      store.snapshot = {
        participants: [],
        error: err instanceof Error ? err : new Error(String(err)),
      }
      // Notify all listeners
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
  store.snapshot = {
    participants: [],
    error: null,
  }

  managerToDestroy.destroy().catch((err) => {
    console.error('[PresenceStore] Error destroying manager:', err)
  })

  // Remove store from global map if no listeners
  if (store.listeners.size === 0) {
    const key = getRoomStoreKey(roomId)
    roomStores.delete(key)
    console.log('[PresenceStore] Removed store for room:', roomId)
  }
}

/**
 * Subscribe to presence updates for a room
 */
function subscribe(
  roomId: string,
  userId: string,
  username: string,
  avatar: string | null | undefined,
  enabled: boolean,
): (callback: () => void) => () => void {
  return (callback: () => void) => {
    // If not enabled or missing required params, don't initialize
    if (!enabled || !roomId || !userId || !username) {
      // Return a no-op unsubscribe function
      return () => {}
    }

    const store = getOrCreateRoomStore(roomId)

    // Add listener
    store.listeners.add(callback)

    // Initialize manager if needed
    if (!store.manager) {
      initializeManager(store, roomId, userId, username, avatar)
    }

    // Cleanup function
    return () => {
      store.listeners.delete(callback)

      // If this was the last listener, destroy the manager
      if (store.listeners.size === 0 && store.manager) {
        console.log(
          '[PresenceStore] Last listener removed, destroying manager for room:',
          roomId,
        )
        destroyManager(store, roomId)
      }
    }
  }
}

/**
 * Get current snapshot for a room
 */
function getSnapshot(roomId: string): PresenceSnapshot {
  const key = getRoomStoreKey(roomId)
  const store = roomStores.get(key)

  if (!store) {
    return {
      participants: [],
      error: null,
    }
  }

  return store.snapshot
}

/**
 * Get server-side snapshot (always returns empty state)
 */
function getServerSnapshot(): PresenceSnapshot {
  return {
    participants: [],
    error: null,
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
}: UseSupabasePresenceProps): UseSupabasePresenceReturn {
  // Use useSyncExternalStore with room-specific store functions
  const snapshot = useSyncExternalStore(
    subscribe(roomId, userId, username, avatar, enabled),
    () => getSnapshot(roomId),
    getServerSnapshot,
  )

  return {
    participants: snapshot.participants,
    error: snapshot.error,
  }
}
