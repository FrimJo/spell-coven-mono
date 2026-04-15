import type { ConnectionState } from '@/types/connection'
import type { WebRTCSignal } from '@/types/webrtc-signal'

export const RECONNECT_COOLDOWN_MS = 60_000
export const MAX_RECONNECT_ATTEMPTS = 3
export const STUCK_THRESHOLD_MS = 30_000
export const CHECK_INTERVAL_MS = 5_000

export interface WebRTCSessionManager {
  hasLocalStream(): boolean
  handleSignal(signal: WebRTCSignal): Promise<void>
  callPeer(peerId: string, roomId: string): Promise<void>
  closePeer(peerId: string): void
}

export interface ReconnectTracker {
  attempts: number
  lastAttemptAt: number
}

export function getStableRemotePlayerIds(remotePlayerIds: string[]): string[] {
  return [...remotePlayerIds].sort()
}

export async function replayPendingSignals({
  manager,
  pendingSignals,
  onError,
}: {
  manager: WebRTCSessionManager
  pendingSignals: WebRTCSignal[]
  onError: (error: Error) => void
}): Promise<void> {
  for (const signal of pendingSignals) {
    try {
      await manager.handleSignal(signal)
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

export function reconcilePeerConnections({
  manager,
  remotePlayerIds,
  localPlayerId,
  roomId,
  localStreamReady,
  initiatedPeers,
  onError,
}: {
  manager: WebRTCSessionManager
  remotePlayerIds: string[]
  localPlayerId: string
  roomId: string
  localStreamReady: boolean
  initiatedPeers: Set<string>
  onError: (error: Error) => void
}): void {
  if (!localStreamReady) {
    return
  }

  const currentRemoteSet = new Set(remotePlayerIds)

  for (const remotePlayerId of remotePlayerIds) {
    if (
      remotePlayerId === localPlayerId ||
      initiatedPeers.has(remotePlayerId)
    ) {
      continue
    }

    if (localPlayerId < remotePlayerId) {
      initiatedPeers.add(remotePlayerId)
      manager.callPeer(remotePlayerId, roomId).catch((error) => {
        initiatedPeers.delete(remotePlayerId)
        onError(error instanceof Error ? error : new Error(String(error)))
      })
    }
  }

  for (const peerId of Array.from(initiatedPeers)) {
    if (!currentRemoteSet.has(peerId)) {
      manager.closePeer(peerId)
      initiatedPeers.delete(peerId)
    }
  }
}

export function runReconnectWatchdogTick({
  manager,
  localStreamReady,
  connectionStates,
  connectingSinceMs,
  reconnectAttempts,
  initiatedPeers,
  localPlayerId,
  roomId,
  onConnectionReset,
  onError,
  now = Date.now(),
}: {
  manager: WebRTCSessionManager
  localStreamReady: boolean
  connectionStates: Map<string, ConnectionState>
  connectingSinceMs: Map<string, number>
  reconnectAttempts: Map<string, ReconnectTracker>
  initiatedPeers: Set<string>
  localPlayerId: string
  roomId: string
  onConnectionReset: (peerId: string) => void
  onError: (error: Error) => void
  now?: number
}): void {
  if (!localStreamReady) {
    return
  }

  for (const [peerId, state] of connectionStates) {
    if (state !== 'connecting') {
      connectingSinceMs.delete(peerId)
      continue
    }

    const firstSeen = connectingSinceMs.get(peerId) ?? now
    if (!connectingSinceMs.has(peerId)) {
      connectingSinceMs.set(peerId, firstSeen)
    }

    if (now - firstSeen < STUCK_THRESHOLD_MS || !initiatedPeers.has(peerId)) {
      continue
    }

    const tracker = reconnectAttempts.get(peerId)
    if (tracker?.attempts && tracker.attempts >= MAX_RECONNECT_ATTEMPTS) {
      if (now - tracker.lastAttemptAt < RECONNECT_COOLDOWN_MS) {
        continue
      }
      tracker.attempts = 0
    }

    manager.closePeer(peerId)
    initiatedPeers.delete(peerId)
    connectingSinceMs.delete(peerId)
    onConnectionReset(peerId)

    if (localPlayerId < peerId) {
      const nextTracker = reconnectAttempts.get(peerId) ?? {
        attempts: 0,
        lastAttemptAt: 0,
      }
      nextTracker.attempts += 1
      nextTracker.lastAttemptAt = now
      reconnectAttempts.set(peerId, nextTracker)
      initiatedPeers.add(peerId)

      manager.callPeer(peerId, roomId).catch((error) => {
        initiatedPeers.delete(peerId)
        onError(error instanceof Error ? error : new Error(String(error)))
      })
    }
  }

  const currentPeerIds = new Set(connectionStates.keys())
  for (const trackedPeerId of Array.from(connectingSinceMs.keys())) {
    if (!currentPeerIds.has(trackedPeerId)) {
      connectingSinceMs.delete(trackedPeerId)
    }
  }
}
