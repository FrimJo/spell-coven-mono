import { useState } from 'react'
import { useConvexPresence } from '@/hooks/useConvexPresence'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const joinRoom = vi.fn()
const leaveRoom = vi.fn()
const heartbeat = vi.fn()
const kickPlayer = vi.fn()
const banPlayer = vi.fn()
const setRoomSeatCount = vi.fn()

// Server-side membership state, driven by the mutation mocks.
let serverJoined = false
// Simulates a kick/transfer: the session row disappears from queries.
let sessionRemoved = false
// Latest pending join resolver, so tests can control the join race deterministically.
let resolveJoin: (() => void) | null = null

const joinedPlayer = {
  _creationTime: 0,
  _id: 'player-a',
  avatar: undefined,
  commanderDamage: {},
  commanders: [],
  health: 40,
  joinedAt: 1,
  lastSeenAt: Date.now(),
  poison: 0,
  roomId: 'ABC123',
  sessionId: 'session-a',
  status: 'active',
  userId: 'user-a',
  username: 'Player A',
}

vi.mock('@convex/_generated/api', () => ({
  api: {
    bans: {
      banPlayer: 'bans.banPlayer',
      isBanned: 'bans.isBanned',
      kickPlayer: 'bans.kickPlayer',
    },
    players: {
      heartbeat: 'players.heartbeat',
      joinRoom: 'players.joinRoom',
      leaveRoom: 'players.leaveRoom',
      listActivePlayers: 'players.listActivePlayers',
      listAllPlayerSessions: 'players.listAllPlayerSessions',
    },
    rooms: {
      getRoom: 'rooms.getRoom',
      setRoomSeatCount: 'rooms.setRoomSeatCount',
    },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: (mutation: string) => {
    switch (mutation) {
      case 'players.joinRoom':
        return joinRoom
      case 'players.leaveRoom':
        return leaveRoom
      case 'players.heartbeat':
        return heartbeat
      case 'bans.kickPlayer':
        return kickPlayer
      case 'bans.banPlayer':
        return banPlayer
      case 'rooms.setRoomSeatCount':
        return setRoomSeatCount
      default:
        throw new Error(`Unexpected mutation: ${mutation}`)
    }
  },
  useQuery: (query: string, args: unknown) => {
    if (args === 'skip') return undefined

    switch (query) {
      case 'rooms.getRoom':
        return { ownerId: 'user-a', seatCount: 4 }
      case 'players.listActivePlayers':
      case 'players.listAllPlayerSessions':
        return serverJoined && !sessionRemoved ? [joinedPlayer] : []
      case 'bans.isBanned':
        return false
      default:
        throw new Error(`Unexpected query: ${query}`)
    }
  },
}))

const flush = () => act(async () => undefined)

beforeEach(() => {
  sessionStorage.clear()
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      randomUUID: () => 'session-a',
    },
  })

  joinRoom.mockReset()
  leaveRoom.mockReset()
  heartbeat.mockReset()
  kickPlayer.mockReset()
  banPlayer.mockReset()
  setRoomSeatCount.mockReset()

  serverJoined = false
  sessionRemoved = false
  resolveJoin = null

  // Deferred join: stays pending until the test resolves it, simulating the
  // server round-trip during which intent can change.
  joinRoom.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveJoin = () => {
          serverJoined = true
          resolve()
        }
      }),
  )
  leaveRoom.mockImplementation(async () => {
    serverJoined = false
  })
  heartbeat.mockResolvedValue(undefined)
  kickPlayer.mockResolvedValue(undefined)
  banPlayer.mockResolvedValue(undefined)
  setRoomSeatCount.mockResolvedValue({ seatCount: 4 })
})

describe('useConvexPresence', () => {
  it('compensates with a leave when join resolves after an explicit leave', async () => {
    const { result } = renderHook(() =>
      useConvexPresence({
        roomId: 'ABC123',
        userId: 'user-a',
        username: 'Player A',
      }),
    )

    await waitFor(() => expect(joinRoom).toHaveBeenCalledTimes(1))

    // Leave while the join is still in flight.
    await act(async () => {
      await result.current.leaveRoom()
    })
    expect(leaveRoom).toHaveBeenCalledTimes(1)

    // The join lands late; the hook must clean up the ghost row.
    await act(async () => {
      resolveJoin?.()
    })

    expect(joinRoom).toHaveBeenCalledTimes(1)
    expect(leaveRoom).toHaveBeenCalledTimes(2)
    expect(serverJoined).toBe(false)
  })

  it('leaves exactly once when leaving after a settled join', async () => {
    const { result } = renderHook(() =>
      useConvexPresence({
        roomId: 'ABC123',
        userId: 'user-a',
        username: 'Player A',
      }),
    )

    await waitFor(() => expect(joinRoom).toHaveBeenCalledTimes(1))
    await act(async () => {
      resolveJoin?.()
    })

    await act(async () => {
      await result.current.leaveRoom()
    })

    expect(joinRoom).toHaveBeenCalledTimes(1)
    expect(leaveRoom).toHaveBeenCalledTimes(1)
    expect(serverJoined).toBe(false)
  })

  it('compensates with a leave when disabled mid-join', async () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useConvexPresence({
          roomId: 'ABC123',
          userId: 'user-a',
          username: 'Player A',
          enabled,
        }),
      { initialProps: { enabled: true } },
    )

    await waitFor(() => expect(joinRoom).toHaveBeenCalledTimes(1))

    rerender({ enabled: false })
    await flush()

    await act(async () => {
      resolveJoin?.()
    })

    expect(joinRoom).toHaveBeenCalledTimes(1)
    expect(leaveRoom).toHaveBeenCalledTimes(1)
    expect(serverJoined).toBe(false)
  })

  it('does not auto-rejoin after a kick once the consumer disconnects', async () => {
    const onKicked = vi.fn()
    // Mirror PresenceProvider: the consumer disconnects (flips `enabled`) in
    // response to the kick. The hook no longer owns removal suppression; it
    // relies on the consumer batching that disconnect with its own state reset.
    const { result, rerender } = renderHook(() => {
      const [enabled, setEnabled] = useState(true)
      useConvexPresence({
        roomId: 'ABC123',
        userId: 'user-a',
        username: 'Player A',
        enabled,
        onKicked: () => {
          onKicked()
          setEnabled(false)
        },
      })
      return { enabled }
    })

    await waitFor(() => expect(joinRoom).toHaveBeenCalledTimes(1))
    await act(async () => {
      resolveJoin?.()
    })

    // Our session vanishes from the room (kicked).
    sessionRemoved = true
    rerender()
    await flush()

    expect(onKicked).toHaveBeenCalledTimes(1)
    expect(result.current.enabled).toBe(false)
    // The consumer's disconnect batches with the hook's hasJoined reset, so the
    // reconcile never sees a rejoin window.
    await flush()
    expect(joinRoom).toHaveBeenCalledTimes(1)
  })

  it('rejoins after a kick once the hook is re-enabled', async () => {
    const onKicked = vi.fn()
    // Consumer owns suppression: it disconnects on kick (via onKicked) and later
    // reconnects by re-enabling. The kick window must not auto-rejoin, but a
    // fresh re-enable must.
    const { result, rerender } = renderHook(() => {
      const [enabled, setEnabled] = useState(true)
      useConvexPresence({
        roomId: 'ABC123',
        userId: 'user-a',
        username: 'Player A',
        enabled,
        onKicked: () => {
          onKicked()
          setEnabled(false)
        },
      })
      return { enabled, setEnabled }
    })

    await waitFor(() => expect(joinRoom).toHaveBeenCalledTimes(1))
    await act(async () => {
      resolveJoin?.()
    })

    // Kicked: session removed; the consumer disconnects via onKicked.
    sessionRemoved = true
    rerender()
    await flush()
    expect(onKicked).toHaveBeenCalledTimes(1)
    expect(result.current.enabled).toBe(false)
    // No premature rejoin during the kick window.
    expect(joinRoom).toHaveBeenCalledTimes(1)

    // Reconnect: session is restored and the consumer re-enables.
    sessionRemoved = false
    await act(async () => {
      result.current.setEnabled(true)
    })

    await waitFor(() => expect(joinRoom).toHaveBeenCalledTimes(2))
  })
})
