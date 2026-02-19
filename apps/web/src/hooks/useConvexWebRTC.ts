/**
 * useConvexWebRTC - React hook for WebRTC connections via Convex
 *
 * Wires together useConvexSignaling and WebRTCManager for peer-to-peer
 * video streaming using Convex as the signaling server.
 */

import type { ConnectionState, TrackState } from '@/types/connection'
import type { WebRTCSignal } from '@/types/webrtc-signal'
import { useCallback, useEffect, useRef, useState } from 'react'
import { WebRTCManager } from '@/lib/webrtc/WebRTCManager'

import { useConvexSignaling } from './useConvexSignaling'

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
  const onErrorRef = useRef(onError)
  /**
   * Tracks which remote peer IDs we have already initiated or acknowledged a
   * connection for.  Only IDs that we actively called (shouldInitiate) or that
   * successfully called us (incoming offer creates the PC) belong here.
   * Using a Set for O(1) lookups.
   */
  const initiatedPeersRef = useRef<Set<string>>(new Set())
  const localStreamRef = useRef<MediaStream | null>(localStream)

  // Queue for signals that arrive before manager is ready
  const pendingSignalsRef = useRef<WebRTCSignal[]>([])

  // Keep local stream ref up to date
  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  // Update error callback ref
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

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
      setWebrtcError(error)
      onErrorRef.current?.(error)
    })
  }, [])

  // Handle signaling errors
  const handleSignalingError = useCallback((err: Error) => {
    setWebrtcError(err)
    onErrorRef.current?.(err)
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

  // Store sendSignal in a ref for WebRTCManager
  const sendSignalRef = useRef(sendSignal)
  useEffect(() => {
    sendSignalRef.current = sendSignal
  }, [sendSignal])

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

    // Create WebRTC manager with sendSignal callback
    const webrtcManager = new WebRTCManager(
      localPlayerId,
      async (signal: WebRTCSignal) => {
        if (!isDestroyed) {
          await sendSignalRef.current(signal)
        }
      },
      {
        onRemoteStream: (peerId, stream) => {
          if (!isDestroyed) {
            // Mark peer as connected so the peer-connection effect won't
            // try to re-initiate a call to them.
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
          }
        },
        onTrackStateChange: (peerId, state) => {
          if (!isDestroyed) {
            setTrackStates((prev) => new Map(prev).set(peerId, state))
          }
        },
        onError: (peerId, err) => {
          if (!isDestroyed) {
            setWebrtcError(err)
            onErrorRef.current?.(err)
          }
        },
      },
    )

    webrtcManagerRef.current = webrtcManager

    // Set local stream immediately if it already exists
    // This prevents race conditions where peer connection effect runs before local stream effect
    if (localStreamRef.current) {
      console.log(
        '[ConvexWebRTC:Hook] Setting existing local stream on newly created manager',
      )
      webrtcManager.setLocalStream(localStreamRef.current)
    }

    console.log('[ConvexWebRTC:Hook] WebRTC manager initialized')

    // Note: Don't replay signals here - wait for local stream to be set first
    // Signals will be replayed in the local stream effect

    // Cleanup
    return () => {
      isDestroyed = true
      console.log('[ConvexWebRTC:Hook] Destroying WebRTC manager')
      webrtcManager.destroy()
      webrtcManagerRef.current = null
      initiatedPeers.clear()
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

      // Replay any queued signals now that we have both manager AND local stream
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
            setWebrtcError(error)
            onErrorRef.current?.(error)
          })
        }
      }
    }
  }, [localStream])

  // Connect to remote peers
  useEffect(() => {
    console.log('[ConvexWebRTC:Hook] Peer connection effect triggered:', {
      isSignalingInitialized,
      remotePlayerIds: [...remotePlayerIds],
      remotePlayerIdsLength: remotePlayerIds.length,
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

    if (remotePlayerIds.length === 0) {
      console.log('[ConvexWebRTC:Hook] No remote players to connect to')
    }

    const currentRemoteSet = new Set(remotePlayerIds)

    for (const remotePlayerId of remotePlayerIds) {
      if (remotePlayerId === localPlayerId) continue

      if (initiated.has(remotePlayerId)) {
        // Already initiated or peer already called us — skip
        continue
      }

      // Determine who should initiate: peer with lexicographically smaller ID
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
            // Remove from initiated so it can be retried
            initiated.delete(remotePlayerId)
            const callError =
              err instanceof Error ? err : new Error(String(err))
            setWebrtcError(callError)
            onErrorRef.current?.(callError)
          })
      } else {
        // We expect the remote peer to call us. Don't add to initiated set —
        // the handleSignal path will create the PC when the offer arrives.
        console.log(
          `[ConvexWebRTC:Hook] Waiting for peer ${remotePlayerId} to call us (they have smaller ID)`,
        )
      }
    }

    // Close connections to peers that are no longer in the list
    for (const peerId of initiated) {
      if (!currentRemoteSet.has(peerId)) {
        console.log(`[ConvexWebRTC:Hook] Closing connection to peer: ${peerId}`)
        webrtcManagerRef.current.closePeer(peerId)
        initiated.delete(peerId)
      }
    }
  }, [
    remotePlayerIds,
    isSignalingInitialized,
    roomId,
    localPlayerId,
    localStream,
  ])

  // Periodically check for stuck connections and retry.
  // A connection stuck at "connecting" for too long likely means the signaling
  // handshake failed silently (e.g. the offer/answer was lost).
  useEffect(() => {
    if (!isSignalingInitialized || !webrtcManagerRef.current) return

    const STUCK_THRESHOLD_MS = 30_000
    const CHECK_INTERVAL_MS = 5_000
    const connectingSinceMs = new Map<string, number>()

    const interval = window.setInterval(() => {
      const manager = webrtcManagerRef.current
      if (!manager || !localStream) return

      for (const [peerId, state] of connectionStates) {
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

        // Check how long this peer has been in connecting state by looking
        // at whether we already initiated. If so, try tearing down and
        // re-initiating after a threshold.
        const initiated = initiatedPeersRef.current
        if (!initiated.has(peerId)) continue

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

        // Re-initiate if we should be the caller
        if (localPlayerId < peerId) {
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

      // Drop peers no longer present in connection states.
      const currentPeerIds = new Set(connectionStates.keys())
      for (const trackedPeerId of Array.from(connectingSinceMs.keys())) {
        if (!currentPeerIds.has(trackedPeerId)) {
          connectingSinceMs.delete(trackedPeerId)
        }
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [
    isSignalingInitialized,
    connectionStates,
    localStream,
    localPlayerId,
    roomId,
  ])

  return {
    localStream,
    remoteStreams,
    connectionStates,
    trackStates,
    error,
    isInitialized: isSignalingInitialized,
  }
}
