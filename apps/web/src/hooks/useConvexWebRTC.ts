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
  const previousRemotePlayerIdsRef = useRef<string[]>([])

  // Queue for signals that arrive before manager is ready
  const pendingSignalsRef = useRef<WebRTCSignal[]>([])

  // Update error callback ref
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  // Handle incoming signals from Convex
  const handleSignal = useCallback((signal: WebRTCSignal) => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.handleSignal(signal).catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err))
        setWebrtcError(error)
        onErrorRef.current?.(error)
      })
    } else {
      // Queue signal for later processing when manager and local stream are ready
      pendingSignalsRef.current.push(signal)
    }
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

    console.log('[ConvexWebRTC:Hook] WebRTC manager initialized')

    // Note: Don't replay signals here - wait for local stream to be set first
    // Signals will be replayed in the local stream effect

    // Cleanup
    return () => {
      isDestroyed = true
      console.log('[ConvexWebRTC:Hook] Destroying WebRTC manager')
      webrtcManager.destroy()
      webrtcManagerRef.current = null
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
          webrtcManagerRef.current!.handleSignal(signal).catch((err) => {
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

    if (!localStream) {
      console.log('[ConvexWebRTC:Hook] Skipping - local stream not ready')
      return
    }

    const previousRemotePlayerIds = previousRemotePlayerIdsRef.current
    console.log('[ConvexWebRTC:Hook] Previous remote player IDs:', [
      ...previousRemotePlayerIds,
    ])

    // Connect to new remote peers
    if (remotePlayerIds.length === 0) {
      console.log('[ConvexWebRTC:Hook] No remote players to connect to')
    }

    for (const remotePlayerId of remotePlayerIds) {
      if (remotePlayerId !== localPlayerId) {
        // Only call if this peer wasn't in the previous list
        if (!previousRemotePlayerIds.includes(remotePlayerId)) {
          // To avoid race conditions where both peers try to call each other,
          // only the peer with the lexicographically smaller ID initiates the call
          const shouldInitiate = localPlayerId < remotePlayerId

          if (shouldInitiate) {
            console.log(
              `[ConvexWebRTC:Hook] Initiating call to peer: ${remotePlayerId} in room ${roomId} (we have smaller ID)`,
            )
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
                const callError =
                  err instanceof Error ? err : new Error(String(err))
                setWebrtcError(callError)
                onErrorRef.current?.(callError)
              })
          } else {
            console.log(
              `[ConvexWebRTC:Hook] Waiting for peer ${remotePlayerId} to call us (they have smaller ID)`,
            )
          }
        } else {
          console.log(
            `[ConvexWebRTC:Hook] Skipping peer ${remotePlayerId} - already connected`,
          )
        }
      }
    }

    // Close connections to peers that are no longer in the list
    for (const peerId of previousRemotePlayerIds) {
      if (!remotePlayerIds.includes(peerId)) {
        console.log(`[ConvexWebRTC:Hook] Closing connection to peer: ${peerId}`)
        webrtcManagerRef.current.closePeer(peerId)
      }
    }

    // Update ref for next comparison
    previousRemotePlayerIdsRef.current = remotePlayerIds
    console.log('[ConvexWebRTC:Hook] Updated previous remote player IDs ref:', [
      ...previousRemotePlayerIdsRef.current,
    ])
  }, [
    remotePlayerIds,
    isSignalingInitialized,
    roomId,
    localPlayerId,
    localStream,
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
