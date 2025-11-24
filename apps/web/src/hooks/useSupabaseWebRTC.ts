/**
 * useSupabaseWebRTC - React hook for WebRTC connections via Supabase
 *
 * Thin wrapper that wires WebRTCManager and SignalingManager together.
 */

import type { ConnectionState, TrackState } from '@/types/connection'
import type { WebRTCSignal } from '@/types/webrtc-signal'
import { useEffect, useRef, useState } from 'react'
import { SignalingManager } from '@/lib/supabase/signaling'
import { WebRTCManager } from '@/lib/webrtc/WebRTCManager'

interface UseSupabaseWebRTCProps {
  localPlayerId: string
  remotePlayerIds: string[]
  roomId: string
  localStream: MediaStream | null
  onError?: (error: Error) => void
}

interface UseSupabaseWebRTCReturn {
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  connectionStates: Map<string, ConnectionState>
  trackStates: Map<string, TrackState>
  error: Error | null
  isInitialized: boolean
}

/**
 * Hook for managing WebRTC connections via Supabase signaling
 */
export function useSupabaseWebRTC({
  localPlayerId,
  remotePlayerIds,
  roomId,
  localStream,
  onError,
}: UseSupabaseWebRTCProps): UseSupabaseWebRTCReturn {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  )
  const [connectionStates, setConnectionStates] = useState<
    Map<string, ConnectionState>
  >(new Map())
  const [trackStates, setTrackStates] = useState<Map<string, TrackState>>(
    new Map(),
  )
  const [error, setError] = useState<Error | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const signalingManagerRef = useRef<SignalingManager | null>(null)
  const webrtcManagerRef = useRef<WebRTCManager | null>(null)
  const onErrorRef = useRef(onError)
  const previousRemotePlayerIdsRef = useRef<string[]>([])

  // Update error callback ref
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  // Initialize managers
  useEffect(() => {
    if (!localPlayerId || !roomId) {
      return
    }

    let isDestroyed = false

    // Create signaling manager
    const signalingManager = new SignalingManager({
      onSignal: (signal: WebRTCSignal) => {
        if (!isDestroyed && webrtcManagerRef.current) {
          webrtcManagerRef.current.handleSignal(signal).catch((err) => {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            onErrorRef.current?.(error)
          })
        }
      },
      onError: (err) => {
        if (!isDestroyed) {
          setError(err)
          onErrorRef.current?.(err)
        }
      },
    })

    signalingManagerRef.current = signalingManager

    // Create WebRTC manager
    const sendSignal = async (signal: WebRTCSignal): Promise<void> => {
      if (!isDestroyed && signalingManagerRef.current) {
        await signalingManagerRef.current.send(signal)
      }
    }

    const webrtcManager = new WebRTCManager(localPlayerId, sendSignal, {
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
          setError(err)
          onErrorRef.current?.(err)
        }
      },
    })

    webrtcManagerRef.current = webrtcManager

    // Initialize signaling
    console.log('[WebRTC:Hook] Starting signaling initialization...')
    signalingManager
      .initialize(roomId, localPlayerId)
      .then(() => {
        if (!isDestroyed) {
          console.log(
            '[WebRTC:Hook] Signaling initialized, setting isInitialized=true',
          )
          setIsInitialized(true)
        } else {
          console.log(
            '[WebRTC:Hook] Signaling initialized but hook was destroyed',
          )
        }
      })
      .catch((err) => {
        console.error('[WebRTC:Hook] Signaling initialization failed:', err)
        if (!isDestroyed) {
          const error = err instanceof Error ? err : new Error(String(err))
          setError(error)
          onErrorRef.current?.(error)
        }
      })

    // Cleanup
    return () => {
      isDestroyed = true
      setIsInitialized(false)
      webrtcManager.destroy()
      signalingManager.destroy().catch((err) => {
        console.error('[WebRTC:Hook] Error destroying signaling:', err)
      })
      signalingManagerRef.current = null
      webrtcManagerRef.current = null
    }
  }, [localPlayerId, roomId])

  // Update local stream
  useEffect(() => {
    console.log('[WebRTC:Hook] Local stream effect triggered:', {
      hasLocalStream: !!localStream,
      hasManager: !!webrtcManagerRef.current,
    })
    if (webrtcManagerRef.current) {
      console.log('[WebRTC:Hook] Setting local stream on WebRTC manager')
      webrtcManagerRef.current.setLocalStream(localStream)
    }
  }, [localStream])

  // Connect to remote peers
  useEffect(() => {
    console.log('[WebRTC:Hook] Peer connection effect triggered:', {
      isInitialized,
      remotePlayerIds: [...remotePlayerIds],
      remotePlayerIdsLength: remotePlayerIds.length,
      localPlayerId,
      roomId,
      hasLocalStream: !!localStream,
    })

    if (!isInitialized || !webrtcManagerRef.current) {
      console.log('[WebRTC:Hook] Skipping - not initialized or manager missing')
      return
    }

    if (!localStream) {
      console.log('[WebRTC:Hook] Skipping - local stream not ready')
      return
    }

    const previousRemotePlayerIds = previousRemotePlayerIdsRef.current
    console.log('[WebRTC:Hook] Previous remote player IDs:', [
      ...previousRemotePlayerIds,
    ])

    // Connect to new remote peers
    if (remotePlayerIds.length === 0) {
      console.log('[WebRTC:Hook] No remote players to connect to')
    }

    for (const remotePlayerId of remotePlayerIds) {
      if (remotePlayerId !== localPlayerId) {
        // Only call if this peer wasn't in the previous list
        if (!previousRemotePlayerIds.includes(remotePlayerId)) {
          console.log(
            `[WebRTC:Hook] Calling new peer: ${remotePlayerId} in room ${roomId}`,
          )
          webrtcManagerRef.current
            .callPeer(remotePlayerId, roomId)
            .then(() => {
              console.log(
                `[WebRTC:Hook] Successfully initiated call to ${remotePlayerId}`,
              )
            })
            .catch((err) => {
              console.error(
                `[WebRTC:Hook] Error calling peer ${remotePlayerId}:`,
                err,
              )
              const error = err instanceof Error ? err : new Error(String(err))
              setError(error)
              onErrorRef.current?.(error)
            })
        } else {
          console.log(
            `[WebRTC:Hook] Skipping peer ${remotePlayerId} - already connected`,
          )
        }
      }
    }

    // Close connections to peers that are no longer in the list
    for (const peerId of previousRemotePlayerIds) {
      if (!remotePlayerIds.includes(peerId)) {
        console.log(`[WebRTC:Hook] Closing connection to peer: ${peerId}`)
        webrtcManagerRef.current.closePeer(peerId)
      }
    }

    // Update ref for next comparison
    previousRemotePlayerIdsRef.current = remotePlayerIds
    console.log('[WebRTC:Hook] Updated previous remote player IDs ref:', [
      ...previousRemotePlayerIdsRef.current,
    ])
  }, [remotePlayerIds, isInitialized, roomId, localPlayerId, localStream])

  return {
    localStream,
    remoteStreams,
    connectionStates,
    trackStates,
    error,
    isInitialized,
  }
}
