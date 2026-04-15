import type { WebRTCSignal } from '@/types/webrtc-signal'
import {
  getStableRemotePlayerIds,
  MAX_RECONNECT_ATTEMPTS,
  reconcilePeerConnections,
  RECONNECT_COOLDOWN_MS,
  replayPendingSignals,
  runReconnectWatchdogTick,
  STUCK_THRESHOLD_MS,
} from '@/hooks/useConvexWebRTC.helpers'
import { describe, expect, it, vi } from 'vitest'

function createSignal(type: WebRTCSignal['type'], from: string): WebRTCSignal {
  if (type === 'candidate') {
    return {
      type,
      from,
      to: 'local',
      roomId: 'room-1',
      payload: { candidate: 'candidate', sdpMid: '0', sdpMLineIndex: 0 },
    }
  }

  return {
    type,
    from,
    to: 'local',
    roomId: 'room-1',
    payload: { sdp: 'sdp' },
  }
}

describe('useConvexWebRTC helpers', () => {
  it('sorts remote player ids and only initiates peers with larger ids', () => {
    const initiatedPeers = new Set<string>()
    const callPeerCalls: Array<[string, string]> = []
    const closedPeers: string[] = []

    reconcilePeerConnections({
      manager: {
        hasLocalStream: () => true,
        async handleSignal() {},
        async callPeer(peerId: string, roomId: string) {
          callPeerCalls.push([peerId, roomId])
        },
        closePeer(peerId: string) {
          closedPeers.push(peerId)
        },
      },
      remotePlayerIds: getStableRemotePlayerIds(['peer-c', 'peer-a', 'peer-b']),
      localPlayerId: 'peer-b',
      roomId: 'room-1',
      localStreamReady: true,
      initiatedPeers,
      onError: vi.fn(),
    })

    expect(callPeerCalls).toEqual([['peer-c', 'room-1']])
    expect(closedPeers).toHaveLength(0)
    expect(initiatedPeers.has('peer-c')).toBe(true)
    expect(initiatedPeers.has('peer-a')).toBe(false)
  })

  it('replays queued signals in order when the manager is ready', async () => {
    const handledSignals: WebRTCSignal[] = []

    await replayPendingSignals({
      manager: {
        hasLocalStream: () => true,
        async handleSignal(signal: WebRTCSignal) {
          handledSignals.push(signal)
        },
        async callPeer() {},
        closePeer() {},
      },
      pendingSignals: [
        createSignal('offer', 'peer-a'),
        createSignal('candidate', 'peer-a'),
      ],
      onError: vi.fn(),
    })

    expect(handledSignals.map((signal) => signal.type)).toEqual([
      'offer',
      'candidate',
    ])
  })

  it('reconnects stuck initiated peers and respects reconnect cooldowns', () => {
    const closedPeers: string[] = []
    const callPeerCalls: Array<[string, string]> = []
    const resetPeers: string[] = []
    const initiatedPeers = new Set(['peer-b'])
    const connectingSinceMs = new Map([['peer-b', 0]])
    const reconnectAttempts = new Map<
      string,
      { attempts: number; lastAttemptAt: number }
    >()

    runReconnectWatchdogTick({
      manager: {
        hasLocalStream: () => true,
        async handleSignal() {},
        async callPeer(peerId: string, roomId: string) {
          callPeerCalls.push([peerId, roomId])
        },
        closePeer(peerId: string) {
          closedPeers.push(peerId)
        },
      },
      localStreamReady: true,
      connectionStates: new Map([['peer-b', 'connecting']]),
      connectingSinceMs,
      reconnectAttempts,
      initiatedPeers,
      localPlayerId: 'peer-a',
      roomId: 'room-1',
      onConnectionReset: (peerId) => {
        resetPeers.push(peerId)
      },
      onError: vi.fn(),
      now: STUCK_THRESHOLD_MS + 1,
    })

    expect(closedPeers).toEqual(['peer-b'])
    expect(callPeerCalls).toEqual([['peer-b', 'room-1']])
    expect(resetPeers).toEqual(['peer-b'])
    const tracker = reconnectAttempts.get('peer-b')
    expect(tracker?.attempts).toBe(1)
    expect(tracker?.lastAttemptAt).toBe(STUCK_THRESHOLD_MS + 1)

    closedPeers.length = 0
    callPeerCalls.length = 0

    reconnectAttempts.set('peer-b', {
      attempts: MAX_RECONNECT_ATTEMPTS,
      lastAttemptAt: RECONNECT_COOLDOWN_MS - 1,
    })
    initiatedPeers.add('peer-b')
    connectingSinceMs.set('peer-b', 0)

    runReconnectWatchdogTick({
      manager: {
        hasLocalStream: () => true,
        async handleSignal() {},
        async callPeer(peerId: string, roomId: string) {
          callPeerCalls.push([peerId, roomId])
        },
        closePeer(peerId: string) {
          closedPeers.push(peerId)
        },
      },
      localStreamReady: true,
      connectionStates: new Map([['peer-b', 'connecting']]),
      connectingSinceMs,
      reconnectAttempts,
      initiatedPeers,
      localPlayerId: 'peer-a',
      roomId: 'room-1',
      onConnectionReset: (peerId) => {
        resetPeers.push(peerId)
      },
      onError: vi.fn(),
      now: RECONNECT_COOLDOWN_MS,
    })

    expect(closedPeers).toHaveLength(0)
    expect(callPeerCalls).toHaveLength(0)
  })
})
