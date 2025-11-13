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
import { useCallback, useEffect, useRef, useState } from 'react'
import { PeerJSManager } from '@/lib/peerjs/PeerJSManager'

export interface UsePeerJSProps {
  localPlayerId: string
  remotePlayerIds: string[]
  onError?: (error: PeerJSError) => void
}

export interface UsePeerJSReturn {
  localStream: MediaStream | null
  localTrackState: PeerTrackState
  remoteStreams: Map<string, MediaStream>
  peerTrackStates: Map<string, PeerTrackState>
  connectionStates: Map<string, ConnectionState>
  toggleVideo: (enabled: boolean) => void
  toggleAudio: (enabled: boolean) => void
  switchCamera: (deviceId: string) => Promise<void>
  initializeLocalMedia: (deviceId?: string) => Promise<void>
  error: PeerJSError | null
  isInitialized: boolean
}

/**
 * Hook for managing PeerJS WebRTC connections
 */
export function usePeerJS({
  localPlayerId,
  remotePlayerIds,
  onError,
}: UsePeerJSProps): UsePeerJSReturn {
  const managerRef = useRef<PeerJSManager | null>(null)
  
  // State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [localTrackState, setLocalTrackState] = useState<PeerTrackState>({
    videoEnabled: true,
    audioEnabled: true,
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
    if (managerRef.current != null) {
      return
    }

    const manager = new PeerJSManager(localPlayerId, {
      onLocalStreamChanged: (stream) => {
        setLocalStream(stream)
      },
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
        onError?.(err)
      },
    })

    managerRef.current = manager

    // Initialize peer
    manager
      .initialize()
      .then(() => {
        setIsInitialized(true)
      })
      .catch((err) => {
        console.error('[usePeerJS] Failed to initialize:', err)
        setError(err)
        onError?.(err)
      })

    return () => {
      manager.destroy()
      managerRef.current = null
    }
  }, [localPlayerId, onError])

  // Connect to remote peers when they change
  useEffect(() => {
    if (!isInitialized || !managerRef.current) {
      return
    }

    managerRef.current.connectToPeers(remotePlayerIds).catch((err) => {
      console.error('[usePeerJS] Failed to connect to peers:', err)
      setError(err)
      onError?.(err)
    })
  }, [remotePlayerIds, isInitialized])

  // Initialize local media when called
  const initializeLocalMedia = useCallback(
    async (deviceId?: string) => {
      if (!managerRef.current) {
        throw new Error('Manager not initialized')
      }
      await managerRef.current.initializeLocalMedia(deviceId)
    },
    [],
  )

  // Toggle video
  const toggleVideo = useCallback((enabled: boolean) => {
    managerRef.current?.toggleVideo(enabled)
  }, [])

  // Toggle audio
  const toggleAudio = useCallback((enabled: boolean) => {
    managerRef.current?.toggleAudio(enabled)
  }, [])

  // Switch camera
  const switchCamera = useCallback(async (deviceId: string) => {
    if (!managerRef.current) {
      throw new Error('Manager not initialized')
    }
    await managerRef.current.switchCamera(deviceId)
  }, [])

  return {
    localStream,
    localTrackState,
    remoteStreams,
    peerTrackStates,
    connectionStates,
    toggleVideo,
    toggleAudio,
    switchCamera,
    initializeLocalMedia,
    error,
    isInitialized,
  }
}
