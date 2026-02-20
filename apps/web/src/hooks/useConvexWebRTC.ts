/**
 * useConvexWebRTC - React hook for WebRTC connections via Convex
 *
 * Wires together useConvexSignaling and WebRTCManager for peer-to-peer
 * video streaming using Convex as the signaling server.
 */

import type { ConnectionState, TrackState } from '@/types/connection'
import type { WebRTCSignal } from '@/types/webrtc-signal'
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { WebRTCManager } from '@/lib/webrtc/WebRTCManager'

import { useConvexSignaling } from './useConvexSignaling'

const RECONNECT_COOLDOWN_MS = 60_000
const MAX_RECONNECT_ATTEMPTS = 3
const STUCK_THRESHOLD_MS = 30_000
const CHECK_INTERVAL_MS = 5_000

interface UseConvexWebRTCProps {
  localPlayerId: string
  remotePlayerIds: string[]
  roomId: string
  localStream: MediaStream | null
  /**
   * When true, signaling will be initialized.
   * Set to true after presence has joined the room.
   */
  presenceReady?: boolean
  onError?: (error: Error) => void
}

interface UseConvexWebRTCReturn {
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  connectionStates: Map<string, ConnectionState>
  trackStates: Map<string, TrackState>
  error: Error | null
  isInitialized: boolean
}

/**
 * Hook for managing WebRTC connections via Convex signaling
 */
export function useConvexWebRTC({
  localPlayerId,
  remotePlayerIds,
  roomId,
  localStream,
  presenceReady = true,
  onError,
}: UseConvexWebRTCProps): UseConvexWebRTCReturn {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  )
  const [connectionStates, setConnectionStates] = useState<
    Map<string, ConnectionState>
  >(new Map())
  const [trackStates, setTrackStates] = useState<Map<string, TrackState>>(
    new Map(),
  )
  const [webrtcError, setWebrtcError] = useState<Error | null>(null)

  const webrtcManagerRef = useRef<WebRTCManager | null>(null)
  /**
   * Tracks which remote peer IDs we have already initiated or acknowledged a
   * connection for.  Only IDs that we actively called (shouldInitiate) or that
   * successfully called us (incoming offer creates the PC) belong here.
   * Using a Set for O(1) lookups.
   */
  const initiatedPeersRef = useRef<Set<string>>(new Set())
  const localStreamRef = useRef<MediaStream | null>(localStream)

  const pendingSignalsRef = useRef<WebRTCSignal[]>([])

  // Per-peer reconnect tracking: { attempts, lastAttemptAt }
  const reconnectAttemptsRef = useRef<
    Map<string, { attempts: number; lastAttemptAt: number }>
  >(new Map())

  // Persistent watchdog bookkeeping (survives effect re-runs)
  const connectingSinceMsRef = useRef<Map<string, number>>(new Map())
  const connectionStatesRef = useRef(connectionStates)

  // Stabilize remotePlayerIds so the peer-connection effect only re-runs
  // when the actual set of IDs changes, not on every array reference change.
  const stableRemotePlayerIds = useMemo(() => {
    const sorted = [...remotePlayerIds].sort()
    return sorted
  }, [remotePlayerIds])

  // Keep refs in sync for use in non-reactive callbacks
  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  useEffect(() => {
    connectionStatesRef.current = connectionStates
  }, [connectionStates])

  // Effect events: always read latest props without becoming dependencies
  const onWebrtcError = useEffectEvent((err: Error) => {
    setWebrtcError(err)
    onError?.(err)
  })

  const sendSignalLatest = useEffectEvent(async (signal: WebRTCSignal) => {
    await sendSignal(signal)
  })

  // Handle incoming signals from Convex
  const handleSignal = useCallback((signal: WebRTCSignal) => {
    const manager = webrtcManagerRef.current

    // Queue signals when manager isn't ready or local stream isn't set.
    // Processing an offer without local tracks produces a media-less answer
    // that causes the initiator's connection to stay stuck at "connecting".
    if (!manager || !manager.hasLocalStream()) {
      pendingSignalsRef.current.push(signal)
      return
    }

    manager.handleSignal(signal).catch((err) => {
      const error = err instanceof Error ? err : new Error(String(err))
      onWebrtcError(error)
    })
  }, [])

  // Handle signaling errors
  const handleSignalingError = useCallback((err: Error) => {
    onWebrtcError(err)
  }, [])

  // Use Convex signaling hook
  const {
    send: sendSignal,
    isInitialized: isSignalingInitialized,
    error: signalingError,
  } = useConvexSignaling({
    roomId,
    localPeerId: localPlayerId,
    enabled: !!localPlayerId && !!roomId && presenceReady,
    onSignal: handleSignal,
    onError: handleSignalingError,
  })

  // Derive combined error from signaling and webrtc errors
  const error = signalingError ?? webrtcError

  /** Reset all session-scoped state when manager is torn down / recreated. */
  const resetSessionState = useEffectEvent(() => {
    pendingSignalsRef.current = []
    reconnectAttemptsRef.current.clear()
    connectingSinceMsRef.current.clear()
    setRemoteStreams(new Map())
    setConnectionStates(new Map())
    setTrackStates(new Map())
    setWebrtcError(null)
  })

  // Initialize WebRTC manager when signaling is ready
  useEffect(() => {
    if (
      !localPlayerId ||
      !roomId ||
      !presenceReady ||
      !isSignalingInitialized
    ) {
      return
    }

    let isDestroyed = false
    const initiatedPeers = initiatedPeersRef.current

    console.log('[ConvexWebRTC:Hook] Initializing WebRTC manager...')

    const webrtcManager = new WebRTCManager(
      localPlayerId,
      async (signal: WebRTCSignal) => {
        if (!isDestroyed) {
          await sendSignalLatest(signal)
        }
      },
      {
        onRemoteStream: (peerId, stream) => {
          if (!isDestroyed) {
            initiatedPeers.add(peerId)
            setRemoteStreams((prev) => {
              const next = new Map(prev)
              if (stream) {
                next.set(peerId, stream)
              } else {
                next.delete(peerId)
              }
              return next
            })
          }
        },
        onConnectionStateChange: (peerId, state) => {
          if (!isDestroyed) {
            setConnectionStates((prev) => new Map(prev).set(peerId, state))

            if (state === 'failed' || state === 'disconnected') {
              initiatedPeers.delete(peerId)
            }
          }
        },
        onTrackStateChange: (peerId, state) => {
          if (!isDestroyed) {
            setTrackStates((prev) => new Map(prev).set(peerId, state))
          }
        },
        onError: (_peerId, err) => {
          if (!isDestroyed) {
            onWebrtcError(err)
          }
        },
      },
    )

    webrtcManagerRef.current = webrtcManager

    if (localStreamRef.current) {
      console.log(
        '[ConvexWebRTC:Hook] Setting existing local stream on newly created manager',
      )
      webrtcManager.setLocalStream(localStreamRef.current)
    }

    console.log('[ConvexWebRTC:Hook] WebRTC manager initialized')

    return () => {
      isDestroyed = true
      console.log('[ConvexWebRTC:Hook] Destroying WebRTC manager')
      webrtcManager.destroy()
      webrtcManagerRef.current = null
      initiatedPeers.clear()
      resetSessionState()
    }
  }, [localPlayerId, roomId, presenceReady, isSignalingInitialized])

  // Update local stream and replay any pending signals
  useEffect(() => {
    console.log('[ConvexWebRTC:Hook] Local stream effect triggered:', {
      hasLocalStream: !!localStream,
      hasManager: !!webrtcManagerRef.current,
    })
    if (webrtcManagerRef.current) {
      console.log('[ConvexWebRTC:Hook] Setting local stream on WebRTC manager')
      webrtcManagerRef.current.setLocalStream(localStream)

      if (localStream && pendingSignalsRef.current.length > 0) {
        console.log(
          `[ConvexWebRTC:Hook] Replaying ${pendingSignalsRef.current.length} queued signals after local stream set`,
        )
        const signalsToReplay = [...pendingSignalsRef.current]
        pendingSignalsRef.current = []

        for (const signal of signalsToReplay) {
          webrtcManagerRef.current?.handleSignal(signal).catch((err) => {
            const error = err instanceof Error ? err : new Error(String(err))
            console.error('[ConvexWebRTC:Hook] Error replaying signal:', error)
            onWebrtcError(error)
          })
        }
      }
    }
  }, [localStream])

  // Connect to remote peers (uses stableRemotePlayerIds to avoid churn)
  useEffect(() => {
    console.log('[ConvexWebRTC:Hook] Peer connection effect triggered:', {
      isSignalingInitialized,
      remotePlayerIds: [...stableRemotePlayerIds],
      remotePlayerIdsLength: stableRemotePlayerIds.length,
      localPlayerId,
      roomId,
      hasLocalStream: !!localStream,
    })

    if (!isSignalingInitialized || !webrtcManagerRef.current) {
      console.log(
        '[ConvexWebRTC:Hook] Skipping - not initialized or manager missing',
      )
      return
    }

    if (!localStream || !webrtcManagerRef.current.hasLocalStream()) {
      console.log(
        '[ConvexWebRTC:Hook] Skipping - local stream not ready on manager',
      )
      return
    }

    const initiated = initiatedPeersRef.current
    console.log('[ConvexWebRTC:Hook] Already-initiated peers:', [...initiated])

    if (stableRemotePlayerIds.length === 0) {
      console.log('[ConvexWebRTC:Hook] No remote players to connect to')
    }

    const currentRemoteSet = new Set(stableRemotePlayerIds)

    for (const remotePlayerId of stableRemotePlayerIds) {
      if (remotePlayerId === localPlayerId) continue

      if (initiated.has(remotePlayerId)) {
        continue
      }

      const shouldInitiate = localPlayerId < remotePlayerId

      if (shouldInitiate) {
        console.log(
          `[ConvexWebRTC:Hook] Initiating call to peer: ${remotePlayerId} in room ${roomId} (we have smaller ID)`,
        )
        initiated.add(remotePlayerId)
        webrtcManagerRef.current
          .callPeer(remotePlayerId, roomId)
          .then(() => {
            console.log(
              `[ConvexWebRTC:Hook] Successfully initiated call to ${remotePlayerId}`,
            )
          })
          .catch((err) => {
            console.error(
              `[ConvexWebRTC:Hook] Error calling peer ${remotePlayerId}:`,
              err,
            )
            initiated.delete(remotePlayerId)
            const callError =
              err instanceof Error ? err : new Error(String(err))
            onWebrtcError(callError)
          })
      } else {
        console.log(
          `[ConvexWebRTC:Hook] Waiting for peer ${remotePlayerId} to call us (they have smaller ID)`,
        )
      }
    }

    for (const peerId of initiated) {
      if (!currentRemoteSet.has(peerId)) {
        console.log(`[ConvexWebRTC:Hook] Closing connection to peer: ${peerId}`)
        webrtcManagerRef.current.closePeer(peerId)
        initiated.delete(peerId)
      }
    }
  }, [
    stableRemotePlayerIds,
    isSignalingInitialized,
    roomId,
    localPlayerId,
    localStream,
  ])

  // Periodically check for stuck connections and retry with rate limiting.
  // Per-peer cooldown and max attempts prevent unbounded signaling churn.
  // The watchdog reads latest state from refs so the interval is stable and
  // `connectingSinceMs` bookkeeping persists across React state updates.
  useEffect(() => {
    if (!isSignalingInitialized || !webrtcManagerRef.current) return

    const interval = window.setInterval(() => {
      const manager = webrtcManagerRef.current
      if (!manager || !localStreamRef.current) return

      const states = connectionStatesRef.current
      const connectingSinceMs = connectingSinceMsRef.current

      for (const [peerId, state] of states) {
        if (state !== 'connecting') {
          connectingSinceMs.delete(peerId)
          continue
        }

        const now = Date.now()
        const firstSeen = connectingSinceMs.get(peerId) ?? now
        if (!connectingSinceMs.has(peerId)) {
          connectingSinceMs.set(peerId, firstSeen)
        }
        const connectingForMs = now - firstSeen
        if (connectingForMs < STUCK_THRESHOLD_MS) {
          continue
        }

        const initiated = initiatedPeersRef.current
        if (!initiated.has(peerId)) continue

        const tracker = reconnectAttemptsRef.current.get(peerId)
        if (tracker) {
          if (tracker.attempts >= MAX_RECONNECT_ATTEMPTS) {
            if (now - tracker.lastAttemptAt < RECONNECT_COOLDOWN_MS) {
              continue
            }
            tracker.attempts = 0
          }
        }

        console.log(
          `[ConvexWebRTC:Hook] Peer ${peerId} stuck at "connecting" for ${connectingForMs}ms, attempting reconnect`,
        )
        manager.closePeer(peerId)
        initiated.delete(peerId)
        connectingSinceMs.delete(peerId)
        setConnectionStates((prev) => {
          const next = new Map(prev)
          next.delete(peerId)
          return next
        })

        if (localPlayerId < peerId) {
          const entry = reconnectAttemptsRef.current.get(peerId) ?? {
            attempts: 0,
            lastAttemptAt: 0,
          }
          entry.attempts++
          entry.lastAttemptAt = now
          reconnectAttemptsRef.current.set(peerId, entry)

          initiated.add(peerId)
          manager.callPeer(peerId, roomId).catch((err) => {
            console.error(
              `[ConvexWebRTC:Hook] Reconnect callPeer failed for ${peerId}:`,
              err,
            )
            initiated.delete(peerId)
          })
        }
      }

      // Drop peers no longer tracked
      const currentPeerIds = new Set(states.keys())
      for (const trackedPeerId of Array.from(connectingSinceMs.keys())) {
        if (!currentPeerIds.has(trackedPeerId)) {
          connectingSinceMs.delete(trackedPeerId)
        }
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [isSignalingInitialized, localPlayerId, roomId])

  return {
    localStream,
    remoteStreams,
    connectionStates,
    trackStates,
    error,
    isInitialized: isSignalingInitialized,
  }
}
