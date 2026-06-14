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
import {
  addAppBreadcrumb,
  captureAppException,
} from '@/integrations/sentry/reporting'
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

/** Gate verbose per-render diagnostics. Flip on locally when debugging. */
const DEBUG = false

/** Diagnostic logging gated behind DEBUG. Errors are logged unconditionally. */
function debugLog(...args: unknown[]): void {
  if (DEBUG) console.log(...args)
}

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
    debugLog('[ConvexPresence] Generated new session ID:', sessionId)
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
  debugLog('[ConvexPresence] Hook called with:', {
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
  const hasJoinedRef = useRef(hasJoined)
  // Suppress auto-rejoin after an explicit leaveRoom(). Set only by leaveRoom;
  // cleared on room/session change. Removals (kick/ban/transfer) are NOT
  // suppressed here - the consumer disconnects (flips `enabled`) in response.
  const suppressRejoin = useRef(false)
  const joinInFlightRef = useRef(false)

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
    hasJoinedRef.current = hasJoined
  })

  // Clear suppression when the membership identity changes (new room or new
  // tab session).
  useEffect(() => {
    suppressRejoin.current = false
  }, [convexRoomId, sessionId])

  // Base eligibility derived at render time. Listed (plus room/session) as a
  // reconcile dep so the effect stays lint-checkable. The full desired check is
  // `baseEligible && !suppressRejoin.current`; suppression is a ref, so reading
  // it inline keeps it latest without adding a dep.
  const baseEligible = enabled && !!userId && !!username && !!sessionId

  // Effect Event for the async join compensation path. Reading the desired
  // state inline in the join's .then would capture a stale closure (the
  // baseEligible from when the join started); this re-reads the latest so a
  // leave/disable that races the in-flight join is caught.
  const isDesired = useEffectEvent(
    () => baseEligible && !suppressRejoin.current,
  )

  // Fire-and-forget leave (used by reconcile, unmount, and late-join compensation)
  const leaveSilently = useEffectEvent(() => {
    leaveRoomRef.current({ roomId: convexRoomId, sessionId }).catch((err) => {
      console.error('[ConvexPresence] Failed to leave room:', err)
      captureAppException(err, {
        tags: { feature: 'presence', operation: 'leave_room_silently' },
      })
    })
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
  debugLog('[ConvexPresence] Query results:', {
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
    // Removal handling: reset joined state and notify the consumer. Suppression
    // of auto-rejoin is the consumer's responsibility - it disconnects (flips
    // `enabled`) in response to these callbacks, which gates the reconcile.
    setHasJoined(false)
    // Check why we were removed:
    // 1. If user has another active session → session was transferred to another tab
    // 2. If user is banned → they were banned
    // 3. Otherwise → they were kicked
    if (userHasOtherActiveSession) {
      addAppBreadcrumb('presence', 'Session transferred to another tab')
      debugLog(
        '[ConvexPresence] Session transferred - user has another active session',
      )
      onSessionTransferred?.()
    } else if (isBanned) {
      addAppBreadcrumb('presence', 'Session removed: banned')
      debugLog(
        '[ConvexPresence] Detected ban - session removed and user is banned',
      )
      onBanned?.()
    } else {
      addAppBreadcrumb('presence', 'Session removed: kicked')
      debugLog(
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
    debugLog('[ConvexPresence] Joining room:', convexRoomId)
    joinInFlightRef.current = true
    joinRoomRef
      .current({
        roomId: convexRoomId,
        sessionId,
        username,
        avatar: avatar ?? undefined,
      })
      .then(() => {
        joinInFlightRef.current = false
        // If intent flipped while the join was in flight (explicit leave or
        // disabled), compensate. leaveRoom is idempotent server-side, so a
        // leave that races ahead of the row insert is safely re-applied here.
        if (!isDesired()) {
          leaveSilently()
          return
        }
        debugLog('[ConvexPresence] Successfully joined room')
        setHasJoined(true)
        setError(null)
      })
      .catch((err) => {
        joinInFlightRef.current = false
        console.error('[ConvexPresence] Failed to join room:', err)
        captureAppException(err, {
          tags: { feature: 'presence', operation: 'join_room' },
        })
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        onError?.(error)
      })
  })

  // Reconcile desired membership against actual (hasJoined) state.
  // Replaces the separate join-on-mount, leave-when-disabled, and explicit-left
  // guards with one desired-vs-actual flow.
  //
  // Removal handling: onRemovalDetected only resets hasJoined and notifies the
  // consumer. The consumer disconnects (flips `enabled`) in response, which
  // makes `desired` false here and prevents an auto-rejoin. Re-enabling allows a
  // fresh rejoin. Explicit leaveRoom() additionally sets suppressRejoin so it
  // stays out even while enabled remains true.
  //
  // avatar is intentionally NOT a dep: it is captured once in the join payload
  // (no mid-session refresh) and never affects desired-vs-actual.
  useEffect(() => {
    const desired = baseEligible && !suppressRejoin.current
    if (desired) {
      if (!hasJoined && !joinInFlightRef.current) onJoinAttempt()
      return
    }
    if (hasJoined) {
      debugLog('[ConvexPresence] Reconcile: leaving room')
      leaveSilently()
      // Eagerly clear the ref so the unmount cleanup below won't fire a second
      // (redundant) leave before the state update commits.
      hasJoinedRef.current = false
      queueMicrotask(() => setHasJoined(false))
    }
  }, [baseEligible, convexRoomId, sessionId, hasJoined])

  // Leave room on unmount (only on real unmount; reads latest joined state)
  useEffect(() => {
    return () => {
      if (hasJoinedRef.current) {
        debugLog('[ConvexPresence] Leaving room (unmount)')
        leaveSilently()
      }
    }
  }, [])

  // Effect Event: start heartbeat loop (reads latest roomId/sessionId when invoked)
  const startHeartbeatLoop = useEffectEvent(() => {
    const sendHeartbeat = () => {
      debugLog('[ConvexPresence] Sending heartbeat...')
      heartbeatRef
        .current({
          roomId: convexRoomId,
          sessionId,
        })
        .then(() => {
          debugLog('[ConvexPresence] Heartbeat sent successfully')
        })
        .catch((err) => {
          console.error('[ConvexPresence] Heartbeat failed:', err)
          captureAppException(err, {
            tags: { feature: 'presence', operation: 'heartbeat' },
          })
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
      addAppBreadcrumb('presence', 'Duplicate session detected')
      debugLog(
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

      try {
        await kickMutationRef.current({
          roomId: convexRoomId,
          userId: playerId,
        })
      } catch (error) {
        captureAppException(error, {
          tags: { feature: 'presence', operation: 'kick_player' },
        })
        throw error
      }
    },
    [convexRoomId, userId],
  )

  // Ban a player (persistent - they cannot rejoin)
  const banPlayer = useCallback(
    async (playerId: string): Promise<void> => {
      if (!convexRoomId || !userId) {
        throw new Error('Cannot ban player: not connected to room')
      }

      try {
        await banMutationRef.current({
          roomId: convexRoomId,
          userId: playerId,
        })
      } catch (error) {
        captureAppException(error, {
          tags: { feature: 'presence', operation: 'ban_player' },
        })
        throw error
      }
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
      debugLog('[ConvexPresence] No duplicate sessions to close')
      return
    }

    debugLog('[ConvexPresence] Transferring session, closing:', sessionsToClose)

    // Leave each duplicate session - they will detect via reactive query
    // and call onSessionTransferred on their end
    for (const otherSessionId of sessionsToClose) {
      try {
        await leaveRoomRef.current({
          roomId: convexRoomId,
          sessionId: otherSessionId,
        })
      } catch (error) {
        captureAppException(error, {
          tags: { feature: 'presence', operation: 'transfer_session_leave' },
        })
        throw error
      }
    }
  }, [convexRoomId, userId, duplicateSessions])

  // Set room seat count (owner only)
  const setRoomSeatCount = useCallback(
    async (seatCount: number): Promise<{ seatCount: number }> => {
      if (!convexRoomId) {
        throw new Error('Cannot set seat count: not connected to room')
      }

      try {
        return await setSeatCountRef.current({
          roomId: convexRoomId,
          seatCount,
        })
      } catch (error) {
        captureAppException(error, {
          tags: { feature: 'presence', operation: 'set_room_seat_count' },
        })
        throw error
      }
    },
    [convexRoomId],
  )

  // Explicitly leave the room (call before navigating away).
  // Sets suppressRejoin so reconcile will NOT auto-rejoin this room/session even
  // while enabled stays true; the flag clears only on roomId/sessionId change.
  // Disconnect flows that want to reconnect should toggle `enabled`
  // (setIsConnected) instead of calling this.
  const leaveRoom = useCallback(async (): Promise<void> => {
    if (!convexRoomId || !sessionId) {
      console.warn(
        '[ConvexPresence] Cannot leave room: missing roomId or sessionId',
      )
      return
    }

    debugLog('[ConvexPresence] Explicitly leaving room')
    suppressRejoin.current = true
    try {
      await leaveRoomRef.current({ roomId: convexRoomId, sessionId })
      setHasJoined(false)
      debugLog('[ConvexPresence] Successfully left room')
    } catch (err) {
      console.error('[ConvexPresence] Failed to leave room:', err)
      captureAppException(err, {
        tags: { feature: 'presence', operation: 'leave_room' },
      })
      // Still mark as not joined even if mutation fails
      setHasJoined(false)
      throw err
    }
  }, [convexRoomId, sessionId])

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
