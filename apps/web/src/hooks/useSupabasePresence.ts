/**
 * useSupabasePresence - React hook for Supabase Presence
 *
 * Thin wrapper around PresenceManager for React components.
 * Uses useSyncExternalStore for optimal concurrent rendering support.
 */

import type { Participant } from '@/types/participant'
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
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
  /** Called when a duplicate session is detected (same user in another tab) */
  onDuplicateSession?: (existingSessionId: string) => void
  /** Called when this session should be closed (transfer happened in another tab) */
  onSessionTransferred?: () => void
}

interface UseSupabasePresenceReturn {
  /** All participants including duplicate sessions */
  participants: Participant[]
  /** Participants deduplicated by userId (for display - shows oldest session per user) */
  uniqueParticipants: Participant[]
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
  /** Current session ID for this tab */
  sessionId: string
  /** Whether there's a duplicate session for this user */
  hasDuplicateSession: boolean
  /** Transfer session to this tab (kicks other tabs) */
  transferSession: () => Promise<void>
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
    sessionId: string
  } | null
}

/**
 * Generate or retrieve a stable session ID for this browser tab.
 * Uses sessionStorage to persist across page reloads within the same tab,
 * but generates a new ID for each new tab.
 */
function getOrCreateSessionId(): string {
  const storageKey = 'spell-coven-session-id'
  let sessionId = sessionStorage.getItem(storageKey)

  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem(storageKey, sessionId)
    console.log('[PresenceStore] Generated new session ID:', sessionId)
  }

  return sessionId
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
  avatar: string | null | undefined,
  sessionId: string,
): void {
  if (store.manager) {
    console.log('[PresenceStore] Manager already exists for room:', roomId)
    return
  }

  console.log(
    '[PresenceStore] Initializing PresenceManager for room:',
    roomId,
    'sessionId:',
    sessionId,
  )

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
  store.roomConfig = { roomId, userId, username, avatar, sessionId }

  // Join room with timeout to prevent infinite hanging
  const joinPromise = manager.join(roomId, userId, username, avatar, sessionId)
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            'Presence join timeout - channel subscription may have failed',
          ),
        ),
      15000, // 15 second timeout
    ),
  )

  Promise.race([joinPromise, timeoutPromise])
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
  sessionId: string,
  enabled: boolean,
  callback: () => void,
): () => void {
  if (!enabled || !roomId || !userId || !username) {
    return () => {}
  }

  const store = getOrCreateRoomStore(roomId)
  store.listeners.add(callback)

  if (!store.manager) {
    initializeManager(store, roomId, userId, username, avatar, sessionId)
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
 * Session transfer event payload type
 */
interface SessionTransferPayload {
  /** User ID that is transferring */
  userId: string
  /** Session ID of the new session (the one taking over) */
  newSessionId: string
  /** Session ID(s) to close */
  closeSessionIds: string[]
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
 * Broadcast a session transfer event to close other tabs with the same user
 */
async function broadcastSessionTransfer(
  roomId: string,
  userId: string,
  newSessionId: string,
  closeSessionIds: string[],
): Promise<void> {
  const channel = channelManager.getChannel(roomId)

  const payload: SessionTransferPayload = {
    userId,
    newSessionId,
    closeSessionIds,
  }

  console.log('[PresenceStore] Broadcasting session transfer:', payload)
  const response = await channel.send({
    type: 'broadcast',
    event: 'session:transfer',
    payload,
  })

  if (response === 'error') {
    throw new Error('Failed to broadcast session transfer event')
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
  onDuplicateSession,
  onSessionTransferred,
}: UseSupabasePresenceProps): UseSupabasePresenceReturn {
  // Get stable session ID for this tab
  const sessionId = useMemo(() => getOrCreateSessionId(), [])

  // Memoize subscribe function to prevent re-subscriptions on every render
  const subscribe = useCallback(
    (callback: () => void) =>
      subscribeToRoom(
        roomId,
        userId,
        username,
        avatar,
        sessionId,
        enabled,
        callback,
      ),
    [roomId, userId, username, avatar, sessionId, enabled],
  )

  // Memoize getSnapshot function
  const getSnapshotForRoom = useCallback(() => getSnapshot(roomId), [roomId])

  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshotForRoom,
    getServerSnapshot,
  )

  // Detect duplicate sessions (same userId, different sessionId)
  const duplicateSessions = useMemo(() => {
    return snapshot.participants.filter(
      (p) => p.id === userId && p.sessionId !== sessionId,
    )
  }, [snapshot.participants, userId, sessionId])

  const hasDuplicateSession = duplicateSessions.length > 0

  // Deduplicate participants by userId (keep oldest session per user)
  // This is useful for UI display where we don't want to show the same user twice
  const uniqueParticipants = useMemo(() => {
    const seen = new Map<string, Participant>()
    // participants are already sorted by joinedAt, so first occurrence is oldest
    for (const p of snapshot.participants) {
      if (!seen.has(p.id)) {
        seen.set(p.id, p)
      }
    }
    return Array.from(seen.values())
  }, [snapshot.participants])

  // Notify about duplicate session when detected
  useEffect(() => {
    if (hasDuplicateSession && onDuplicateSession && duplicateSessions[0]) {
      console.log(
        '[PresenceStore] Duplicate session detected:',
        duplicateSessions[0].sessionId,
      )
      onDuplicateSession(duplicateSessions[0].sessionId)
    }
  }, [hasDuplicateSession, duplicateSessions, onDuplicateSession])

  // Listen for kick/ban events and session transfer events
  useEffect(() => {
    if (!enabled || !roomId || !userId) return

    const channel = channelManager.getChannel(roomId)

    const handleKickEvent = (payload: { payload: KickEventPayload }) => {
      console.log('[PresenceStore] Received removal event:', payload.payload)

      if (payload.payload.kickedUserId === userId && onKicked) {
        const action = payload.payload.isBan ? 'banned' : 'kicked'
        console.log(
          `[PresenceStore] Current user was ${action}, calling onKicked`,
        )
        onKicked()
      }
    }

    const handleSessionTransfer = (payload: {
      payload: SessionTransferPayload
    }) => {
      console.log(
        '[PresenceStore] Received session transfer event:',
        payload.payload,
      )

      // Check if this session should be closed
      if (
        payload.payload.userId === userId &&
        payload.payload.closeSessionIds.includes(sessionId)
      ) {
        console.log(
          '[PresenceStore] This session should be closed due to transfer',
        )
        onSessionTransferred?.()
      }
    }

    channel.on('broadcast', { event: 'player:kicked' }, handleKickEvent)
    channel.on(
      'broadcast',
      { event: 'session:transfer' },
      handleSessionTransfer,
    )

    return () => {
      // Note: Supabase doesn't have a direct off() method for specific handlers,
      // but the channel cleanup happens when the presence subscription ends
    }
  }, [roomId, userId, sessionId, enabled, onKicked, onSessionTransferred])

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

  // Transfer session to this tab (close other tabs with same user)
  const transferSession = useCallback(async (): Promise<void> => {
    if (!roomId || !userId) {
      throw new Error('Cannot transfer session: not connected to room')
    }

    const sessionsToClose = duplicateSessions.map((p) => p.sessionId)
    if (sessionsToClose.length === 0) {
      console.log('[PresenceStore] No duplicate sessions to close')
      return
    }

    console.log(
      '[PresenceStore] Transferring session, closing:',
      sessionsToClose,
    )
    await broadcastSessionTransfer(roomId, userId, sessionId, sessionsToClose)
  }, [roomId, userId, sessionId, duplicateSessions])

  // Compute owner ID - the first participant (sorted by joinedAt) is the room creator
  const ownerId = snapshot.participants[0]?.id ?? null
  const isOwner = ownerId !== null && ownerId === userId

  return {
    participants: snapshot.participants,
    uniqueParticipants,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
    ownerId,
    isOwner,
    kickPlayer,
    banPlayer,
    sessionId,
    hasDuplicateSession,
    transferSession,
  }
}
