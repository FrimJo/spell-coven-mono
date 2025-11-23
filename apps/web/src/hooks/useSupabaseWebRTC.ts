/**
 * useSupabaseWebRTC - React hook for WebRTC connections via Supabase
 *
 * Thin wrapper that wires WebRTCManager and SignalingManager together.
 */

import { useEffect, useRef, useState } from 'react'
import type { ConnectionState, TrackState } from '@/types/connection'
import { SignalingManager } from '@/lib/supabase/signaling'
import { WebRTCManager } from '@/lib/webrtc/WebRTCManager'
import type { WebRTCSignal } from '@/types/webrtc-signal'

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
    signalingManager
      .initialize(roomId, localPlayerId)
      .then(() => {
        if (!isDestroyed) {
          setIsInitialized(true)
        }
      })
      .catch((err) => {
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
        console.error('[useSupabaseWebRTC] Error destroying signaling:', err)
      })
      signalingManagerRef.current = null
      webrtcManagerRef.current = null
    }
  }, [localPlayerId, roomId])

  // Update local stream
  useEffect(() => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.setLocalStream(localStream)
    }
  }, [localStream])

  // Connect to remote peers
  useEffect(() => {
    if (!isInitialized || !webrtcManagerRef.current) {
      return
    }

    const previousRemotePlayerIds = previousRemotePlayerIdsRef.current

    // Connect to new remote peers
    for (const remotePlayerId of remotePlayerIds) {
      if (remotePlayerId !== localPlayerId) {
        // Only call if this peer wasn't in the previous list
        if (!previousRemotePlayerIds.includes(remotePlayerId)) {
          webrtcManagerRef.current
            .callPeer(remotePlayerId, roomId)
            .catch((err) => {
              const error = err instanceof Error ? err : new Error(String(err))
              setError(error)
              onErrorRef.current?.(error)
            })
        }
      }
    }

    // Close connections to peers that are no longer in the list
    for (const peerId of previousRemotePlayerIds) {
      if (!remotePlayerIds.includes(peerId)) {
        webrtcManagerRef.current.closePeer(peerId)
      }
    }

    // Update ref for next comparison
    previousRemotePlayerIdsRef.current = remotePlayerIds
  }, [remotePlayerIds, isInitialized, roomId, localPlayerId])

  return {
    localStream,
    remoteStreams,
    connectionStates,
    trackStates,
    error,
    isInitialized,
  }
}

