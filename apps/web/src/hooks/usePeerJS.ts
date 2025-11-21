/**
 * usePeerJS Hook - Simplified WebRTC implementation using PeerJS
 *
 * Thin React wrapper around PeerJSManager that handles state updates.
 * All core logic is in PeerJSManager class.
 */

import type {
  ConnectionState,
  PeerJSError,
  PeerTrackState,
} from '@/types/peerjs'
import { useEffect, useRef, useState } from 'react'
import { PeerJSManager } from '@/lib/peerjs/PeerJSManager'

export interface UsePeerJSProps {
  localPlayerId: string
  remotePlayerIds: string[]
  roomId: string
  localStream: MediaStream | null
  onError?: (error: PeerJSError) => void
}

export interface UsePeerJSReturn {
  // Local media stream (passed through for convenience)
  localStream: MediaStream | null
  localTrackState: PeerTrackState
  // Remote peer streams and states
  remoteStreams: Map<string, MediaStream>
  peerTrackStates: Map<string, PeerTrackState>
  connectionStates: Map<string, ConnectionState>
  // Error and status
  error: PeerJSError | null
  isInitialized: boolean
}

/**
 * Hook for managing PeerJS WebRTC connections
 */
export function usePeerJS({
  localPlayerId,
  remotePlayerIds,
  roomId,
  localStream,
  onError,
}: UsePeerJSProps): UsePeerJSReturn {
  const managerRef = useRef<PeerJSManager | null>(null)
  const initializationAttemptedRef = useRef(false)
  const initializationFailedRef = useRef(false)
  const onErrorRef = useRef(onError)

  // Update error callback ref when it changes
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  // State
  const [localTrackState, setLocalTrackState] = useState<PeerTrackState>({
    videoEnabled: false,
    audioEnabled: false,
  })
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  )
  const [peerTrackStates, setPeerTrackStates] = useState<
    Map<string, PeerTrackState>
  >(new Map())
  const [connectionStates, setConnectionStates] = useState<
    Map<string, ConnectionState>
  >(new Map())
  const [error, setError] = useState<PeerJSError | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize manager
  useEffect(() => {
    // Don't retry if initialization has already failed
    // This prevents repeated attempts when the server is not available
    if (initializationFailedRef.current) {
      return
    }

    // Don't create a new manager if one already exists
    if (managerRef.current != null) {
      return
    }

    // Prevent multiple initialization attempts
    if (initializationAttemptedRef.current) {
      return
    }

    initializationAttemptedRef.current = true

    const manager = new PeerJSManager(localPlayerId, roomId, {
      onRemoteStreamAdded: (peerId, stream) => {
        setRemoteStreams((prev) => new Map(prev).set(peerId, stream))
      },
      onRemoteStreamRemoved: (peerId) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev)
          next.delete(peerId)
          return next
        })
      },
      onConnectionStateChanged: (peerId, state) => {
        setConnectionStates((prev) => new Map(prev).set(peerId, state))
      },
      onTrackStateChanged: (peerId, state) => {
        setPeerTrackStates((prev) => new Map(prev).set(peerId, state))

        // Update local track state if it's for local player
        if (peerId === localPlayerId) {
          setLocalTrackState(state)
        }
      },
      onError: (err) => {
        setError(err)
        onErrorRef.current?.(err)
      },
    })

    managerRef.current = manager

    // Initialize peer
    manager
      .initialize()
      .then(() => {
        setIsInitialized(true)
        initializationFailedRef.current = false
      })
      .catch((err) => {
        // Only log the error once to avoid spam in console
        if (!initializationFailedRef.current) {
          console.error(
            '[usePeerJS] Failed to initialize PeerJS:',
            err instanceof Error ? err.message : err,
          )
          if (err instanceof Error && err.message.includes('PeerJS server')) {
            console.error(
              '[usePeerJS] Make sure the PeerJS server is running: cd apps/peerjs-server && bun run dev',
            )
          }
        }
        initializationFailedRef.current = true
        setError(err)
        onErrorRef.current?.(err)
      })

    return () => {
      manager.destroy()
      managerRef.current = null
      initializationAttemptedRef.current = false
      // Don't reset initializationFailedRef here - we want to remember failures
    }
  }, [localPlayerId, roomId])

  // Update local stream in manager when it changes
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.updateLocalStream(localStream)
    }
  }, [localStream])

  // Connect to remote peers when they change
  useEffect(() => {
    if (!isInitialized || !managerRef.current) {
      return
    }

    // Only connect if manager is actually initialized
    if (!managerRef.current.getIsInitialized()) {
      return
    }

    managerRef.current.connectToPeers(remotePlayerIds).catch((err) => {
      console.error('[usePeerJS] Failed to connect to peers:', err)
      setError(err)
      onErrorRef.current?.(err)
    })
  }, [remotePlayerIds, isInitialized])

  return {
    localStream,
    localTrackState,
    remoteStreams,
    peerTrackStates,
    connectionStates,
    error,
    isInitialized,
  }
}
