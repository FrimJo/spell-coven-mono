/**
 * useConvexPresence - React hook for Convex-based presence
 *
 * Uses Convex reactive queries and mutations for real-time presence tracking.
 * Tracks participants via the roomPlayers table with lastSeenAt heartbeat.
 */

import type { Participant } from '@/types/participant'
import type { Doc } from '@convex/_generated/dataModel'
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api } from '@convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'

type RoomPlayer = Doc<'roomPlayers'>

interface UseConvexPresenceProps {
  roomId: string
  userId: string
  username: string
  avatar?: string | null
  enabled?: boolean
  /** Called when kicked (temporary - can rejoin) */
  onKicked?: () => void
  /** Called when banned (permanent - cannot rejoin) */
  onBanned?: () => void
  /** Called when a duplicate session is detected (same user in another tab) */
  onDuplicateSession?: (existingSessionId: string) => void
  /** Called when this session should be closed (transfer happened in another tab) */
  onSessionTransferred?: () => void
  /** Called when an error occurs in the presence system */
  onError?: (error: Error) => void
}

interface UseConvexPresenceReturn {
  /** All participants including duplicate sessions */
  participants: Participant[]
  /** Participants deduplicated by userId (for display - shows oldest session per user) */
  uniqueParticipants: Participant[]
  isLoading: boolean
  error: Error | null
  /** The ID of the room owner */
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
  /** Explicitly leave the room (call before navigating away) */
  leaveRoom: () => Promise<void>
  /** Room seat count (1-4, defaults to 4 if not set) */
  roomSeatCount: number
  /** Set the room seat count (owner only) */
  setRoomSeatCount: (seatCount: number) => Promise<{ seatCount: number }>
}

/**
 * Heartbeat interval in milliseconds (10 seconds)
 */
const HEARTBEAT_INTERVAL_MS = 10_000

/**
 * Generate or retrieve a stable session ID for this browser tab.
 * Uses sessionStorage to persist across page reloads within the same tab,
 * but generates a new ID for each new tab.
 */
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''

  const storageKey = 'spell-coven-session-id'
  let sessionId = sessionStorage.getItem(storageKey)

  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem(storageKey, sessionId)
    console.log('[ConvexPresence] Generated new session ID:', sessionId)
  }

  return sessionId
}

/**
 * Hook to track game room participants using Convex
 */
export function useConvexPresence({
  roomId,
  userId,
  username,
  avatar,
  enabled = true,
  onKicked,
  onBanned,
  onDuplicateSession,
  onSessionTransferred,
  onError,
}: UseConvexPresenceProps): UseConvexPresenceReturn {
  // Debug: log when hook is called
  console.log('[ConvexPresence] Hook called with:', {
    roomId,
    userId,
    username,
    enabled,
  })

  // Get stable session ID for this tab
  const sessionId = useMemo(() => getOrCreateSessionId(), [])

  // Error state
  const [error, setError] = useState<Error | null>(null)

  // Track if we've joined the room (using state so heartbeat effect re-runs)
  const [hasJoined, setHasJoined] = useState(false)

  // Use roomId as-is - rooms are stored with the bare ID (e.g., "ABC123")
  const convexRoomId = roomId

  // Convex mutations - store in refs to avoid lint warnings about unstable deps
  // (Convex mutation functions are actually stable, but ESLint doesn't know that)
  const joinRoomMutation = useMutation(api.players.joinRoom)
  const leaveRoomMutation = useMutation(api.players.leaveRoom)
  const heartbeatMutation = useMutation(api.players.heartbeat)
  const kickMutation = useMutation(api.bans.kickPlayer)
  const banMutation = useMutation(api.bans.banPlayer)
  const setSeatCountMutation = useMutation(api.rooms.setRoomSeatCount)

  // Use refs to store mutation functions for stable references
  const joinRoomRef = useRef(joinRoomMutation)
  const leaveRoomRef = useRef(leaveRoomMutation)
  const heartbeatRef = useRef(heartbeatMutation)
  const kickMutationRef = useRef(kickMutation)
  const banMutationRef = useRef(banMutation)
  const setSeatCountRef = useRef(setSeatCountMutation)

  // Keep refs up to date
  useEffect(() => {
    joinRoomRef.current = joinRoomMutation
    leaveRoomRef.current = leaveRoomMutation
    heartbeatRef.current = heartbeatMutation
    kickMutationRef.current = kickMutation
    banMutationRef.current = banMutation
    setSeatCountRef.current = setSeatCountMutation
  })

  // Convex queries - reactive subscriptions
  const roomQuery = useQuery(
    api.rooms.getRoom,
    enabled ? { roomId: convexRoomId } : 'skip',
  )

  const allSessionsQuery = useQuery(
    api.players.listAllPlayerSessions,
    enabled && hasJoined ? { roomId: convexRoomId } : 'skip',
  )

  const activePlayersQuery = useQuery(
    api.players.listActivePlayers,
    enabled && hasJoined ? { roomId: convexRoomId } : 'skip',
  )

  // Check if current user is banned (for kick vs ban detection)
  const isBannedQuery = useQuery(
    api.bans.isBanned,
    enabled && userId ? { roomId: convexRoomId } : 'skip',
  )

  // Extract stable values from queries
  const roomOwnerId = roomQuery?.ownerId
  const roomSeatCount = roomQuery?.seatCount ?? 4
  const allSessionsData = allSessionsQuery
  const activePlayersData = activePlayersQuery
  const isBanned = isBannedQuery === true

  // Debug: log query results
  console.log('[ConvexPresence] Query results:', {
    roomQuery: roomQuery === undefined ? 'loading' : roomQuery,
    allSessionsCount: allSessionsData?.length ?? 'loading',
    activePlayersCount: activePlayersData?.length ?? 'loading',
  })

  // Find current player's session to detect kick/status changes
  const mySession = useMemo((): RoomPlayer | null => {
    if (!allSessionsData) return null
    return (
      allSessionsData.find(
        (p: RoomPlayer) => p.userId === userId && p.sessionId === sessionId,
      ) ?? null
    )
  }, [allSessionsData, userId, sessionId])

  // Track if ban query has loaded (for kick detection)
  const isBannedQueryLoaded = isBannedQuery !== undefined

  // Check if user has other active sessions (for session transfer detection)
  const userHasOtherActiveSession = useMemo(() => {
    if (!allSessionsData || !userId) return false
    // Check if there's another session for this user (not our current session)
    return allSessionsData.some(
      (p: RoomPlayer) => p.userId === userId && p.sessionId !== sessionId,
    )
  }, [allSessionsData, userId, sessionId])

  // Effect Event: run removal handling with latest callbacks (avoids callback refs in deps)
  const onRemovalDetected = useEffectEvent(() => {
    setHasJoined(false)
    // Check why we were removed:
    // 1. If user has another active session → session was transferred to another tab
    // 2. If user is banned → they were banned
    // 3. Otherwise → they were kicked
    if (userHasOtherActiveSession) {
      console.log(
        '[ConvexPresence] Session transferred - user has another active session',
      )
      onSessionTransferred?.()
    } else if (isBanned) {
      console.log(
        '[ConvexPresence] Detected ban - session removed and user is banned',
      )
      onBanned?.()
    } else {
      console.log(
        '[ConvexPresence] Detected kick - session removed but not banned',
      )
      onKicked?.()
    }
  })

  // Detect if we were kicked, banned, or had session transferred
  // Convex is the source of truth - if we joined but our session is gone, we were removed
  useEffect(() => {
    // Only check after queries have loaded (not undefined)
    if (allSessionsData === undefined || !isBannedQueryLoaded) return

    // If we had joined but our session no longer exists, we were removed
    if (hasJoined && mySession === null) {
      onRemovalDetected()
    }
  }, [allSessionsData, hasJoined, mySession, isBannedQueryLoaded])

  // Effect Event: join attempt with latest onError (avoids onError in deps)
  const onJoinAttempt = useEffectEvent(() => {
    console.log('[ConvexPresence] Joining room:', convexRoomId)
    joinRoomRef
      .current({
        roomId: convexRoomId,
        sessionId,
        username,
        avatar: avatar ?? undefined,
      })
      .then(() => {
        console.log('[ConvexPresence] Successfully joined room')
        setHasJoined(true)
        setError(null)
      })
      .catch((err) => {
        console.error('[ConvexPresence] Failed to join room:', err)
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        onError?.(error)
      })
  })

  // Join room on mount (when enabled)
  useEffect(() => {
    if (!enabled || !userId || !username || !sessionId || hasJoined) return
    onJoinAttempt()
  }, [enabled, convexRoomId, userId, username, avatar, sessionId, hasJoined])

  // Effect Event: leave when disabled (defers setState to avoid sync setState in effect)
  const onLeaveWhenDisabled = useEffectEvent(() => {
    console.log('[ConvexPresence] Leaving room (disabled)')
    leaveRoomRef.current({ roomId: convexRoomId, sessionId }).catch((err) => {
      console.error('[ConvexPresence] Failed to leave room:', err)
    })
    queueMicrotask(() => setHasJoined(false))
  })

  // Leave room on unmount or when disabled
  useEffect(() => {
    if (!enabled) {
      if (hasJoined) onLeaveWhenDisabled()
      return
    }

    // Cleanup on unmount
    return () => {
      if (hasJoined) {
        console.log('[ConvexPresence] Leaving room (unmount)')
        leaveRoomRef
          .current({ roomId: convexRoomId, sessionId })
          .catch((err) => {
            console.error('[ConvexPresence] Failed to leave room:', err)
          })
      }
    }
  }, [enabled, convexRoomId, sessionId, hasJoined])

  // Effect Event: start heartbeat loop (reads latest roomId/sessionId when invoked)
  const startHeartbeatLoop = useEffectEvent(() => {
    const sendHeartbeat = () => {
      console.log('[ConvexPresence] Sending heartbeat...')
      heartbeatRef
        .current({ roomId: convexRoomId, sessionId })
        .then(() => {
          console.log('[ConvexPresence] Heartbeat sent successfully')
        })
        .catch((err) => {
          console.error('[ConvexPresence] Heartbeat failed:', err)
        })
    }
    sendHeartbeat()
    return setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
  })

  // Heartbeat interval to maintain presence
  useEffect(() => {
    if (!enabled || !hasJoined) return
    const intervalId = startHeartbeatLoop()
    return () => clearInterval(intervalId)
  }, [enabled, convexRoomId, sessionId, hasJoined])

  // Convert Convex players to Participant format
  const participants: Participant[] = useMemo(() => {
    if (!allSessionsData) return []

    return allSessionsData
      .filter((p: RoomPlayer) => p.status !== 'left')
      .map((player: RoomPlayer) => ({
        id: player.userId,
        username: player.username,
        avatar: player.avatar,
        joinedAt: player.joinedAt,
        sessionId: player.sessionId,
        health: player.health,
        poison: player.poison ?? 0,
        commanders: player.commanders ?? [],
        commanderDamage: player.commanderDamage ?? {},
        lastSeenAt: player.lastSeenAt,
      }))
      .sort((a: Participant, b: Participant) => a.joinedAt - b.joinedAt)
  }, [allSessionsData])

  // Deduplicate participants by userId (keep oldest session per user)
  const uniqueParticipants: Participant[] = useMemo(() => {
    const seen = new Map<string, Participant>()
    for (const p of participants) {
      if (!seen.has(p.id)) {
        seen.set(p.id, p)
      }
    }
    return Array.from(seen.values())
  }, [participants])

  // Detect duplicate sessions (same userId, different sessionId)
  const duplicateSessions = useMemo(() => {
    return participants.filter(
      (p) => p.id === userId && p.sessionId !== sessionId,
    )
  }, [participants, userId, sessionId])

  const hasDuplicateSession = duplicateSessions.length > 0

  // Notify about duplicate session when detected
  useEffect(() => {
    if (hasDuplicateSession && onDuplicateSession && duplicateSessions[0]) {
      console.log(
        '[ConvexPresence] Duplicate session detected:',
        duplicateSessions[0].sessionId,
      )
      onDuplicateSession(duplicateSessions[0].sessionId)
    }
  }, [hasDuplicateSession, duplicateSessions, onDuplicateSession])

  // Get owner from room record (not first participant)
  const ownerId = roomOwnerId ?? null
  const isOwner = ownerId !== null && ownerId === userId

  // Kick a player (temporary - they can rejoin)
  const kickPlayer = useCallback(
    async (playerId: string): Promise<void> => {
      if (!convexRoomId || !userId) {
        throw new Error('Cannot kick player: not connected to room')
      }

      await kickMutationRef.current({
        roomId: convexRoomId,
        userId: playerId,
      })
    },
    [convexRoomId, userId],
  )

  // Ban a player (persistent - they cannot rejoin)
  const banPlayer = useCallback(
    async (playerId: string): Promise<void> => {
      if (!convexRoomId || !userId) {
        throw new Error('Cannot ban player: not connected to room')
      }

      await banMutationRef.current({
        roomId: convexRoomId,
        userId: playerId,
      })
    },
    [convexRoomId, userId],
  )

  // Transfer session to this tab (kick other tabs with same user)
  // For Convex, we mark other sessions as 'left'
  // The other tabs will detect their session was closed via the reactive query
  const transferSession = useCallback(async (): Promise<void> => {
    if (!convexRoomId || !userId) {
      throw new Error('Cannot transfer session: not connected to room')
    }

    const sessionsToClose = duplicateSessions.map((p) => p.sessionId)
    if (sessionsToClose.length === 0) {
      console.log('[ConvexPresence] No duplicate sessions to close')
      return
    }

    console.log(
      '[ConvexPresence] Transferring session, closing:',
      sessionsToClose,
    )

    // Leave each duplicate session - they will detect via reactive query
    // and call onSessionTransferred on their end
    for (const otherSessionId of sessionsToClose) {
      await leaveRoomRef.current({
        roomId: convexRoomId,
        sessionId: otherSessionId,
      })
    }
  }, [convexRoomId, userId, duplicateSessions])

  // Set room seat count (owner only)
  const setRoomSeatCount = useCallback(
    async (seatCount: number): Promise<{ seatCount: number }> => {
      if (!convexRoomId) {
        throw new Error('Cannot set seat count: not connected to room')
      }

      return await setSeatCountRef.current({
        roomId: convexRoomId,
        seatCount,
      })
    },
    [convexRoomId],
  )

  // Explicitly leave the room (call before navigating away)
  const leaveRoom = useCallback(async (): Promise<void> => {
    if (!convexRoomId || !sessionId) {
      console.warn(
        '[ConvexPresence] Cannot leave room: missing roomId or sessionId',
      )
      return
    }

    if (!hasJoined) {
      console.log('[ConvexPresence] Not joined, skipping leave')
      return
    }

    console.log('[ConvexPresence] Explicitly leaving room')
    try {
      await leaveRoomRef.current({ roomId: convexRoomId, sessionId })
      setHasJoined(false)
      console.log('[ConvexPresence] Successfully left room')
    } catch (err) {
      console.error('[ConvexPresence] Failed to leave room:', err)
      // Still mark as not joined even if mutation fails
      setHasJoined(false)
      throw err
    }
  }, [convexRoomId, sessionId, hasJoined])

  // Determine loading state
  const isLoading = activePlayersData === undefined || roomQuery === undefined

  return {
    participants,
    uniqueParticipants,
    isLoading,
    error,
    ownerId,
    isOwner,
    kickPlayer,
    banPlayer,
    sessionId,
    hasDuplicateSession,
    transferSession,
    leaveRoom,
    roomSeatCount,
    setRoomSeatCount,
  }
}
