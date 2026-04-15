/**
 * useConvexWebRTC - React hook for WebRTC connections via Convex
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
import {
  CHECK_INTERVAL_MS,
  getStableRemotePlayerIds,
  reconcilePeerConnections,
  replayPendingSignals,
  runReconnectWatchdogTick,
} from './useConvexWebRTC.helpers'

interface UseConvexWebRTCProps {
  localPlayerId: string
  remotePlayerIds: string[]
  roomId: string
  localStream: MediaStream | null
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
  const initiatedPeersRef = useRef<Set<string>>(new Set())
  const localStreamRef = useRef<MediaStream | null>(localStream)
  const connectionStatesRef = useRef(connectionStates)
  const pendingSignalsRef = useRef<WebRTCSignal[]>([])
  const reconnectAttemptsRef = useRef<
    Map<string, { attempts: number; lastAttemptAt: number }>
  >(new Map())
  const connectingSinceMsRef = useRef<Map<string, number>>(new Map())
  const onWebrtcErrorRef = useRef<(error: Error) => void>(() => {})

  const stableRemotePlayerIds = useMemo(
    () => getStableRemotePlayerIds(remotePlayerIds),
    [remotePlayerIds],
  )

  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  useEffect(() => {
    connectionStatesRef.current = connectionStates
  }, [connectionStates])

  useEffect(() => {
    onWebrtcErrorRef.current = (error: Error) => {
      setWebrtcError(error)
      onError?.(error)
    }
  }, [onError])

  const handleSignal = useCallback((signal: WebRTCSignal) => {
    const manager = webrtcManagerRef.current

    if (!manager || !manager.hasLocalStream()) {
      pendingSignalsRef.current.push(signal)
      return
    }

    manager.handleSignal(signal).catch((error) => {
      onWebrtcErrorRef.current(
        error instanceof Error ? error : new Error(String(error)),
      )
    })
  }, [])

  const {
    send: sendSignal,
    isInitialized: isSignalingInitialized,
    error: signalingError,
  } = useConvexSignaling({
    roomId,
    localPeerId: localPlayerId,
    enabled: !!localPlayerId && !!roomId && presenceReady,
    onSignal: handleSignal,
    onError: (error) => onWebrtcErrorRef.current(error),
  })

  const sendSignalLatest = useEffectEvent(async (signal: WebRTCSignal) => {
    await sendSignal(signal)
  })

  const resetSessionState = useCallback(() => {
    pendingSignalsRef.current = []
    reconnectAttemptsRef.current.clear()
    connectingSinceMsRef.current.clear()
    setRemoteStreams(new Map())
    setConnectionStates(new Map())
    setTrackStates(new Map())
    setWebrtcError(null)
  }, [])

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

    const manager = new WebRTCManager(
      localPlayerId,
      async (signal: WebRTCSignal) => {
        if (!isDestroyed) {
          await sendSignalLatest(signal)
        }
      },
      {
        onRemoteStream: (peerId, stream) => {
          if (isDestroyed) {
            return
          }

          initiatedPeers.add(peerId)
          setRemoteStreams((previous) => {
            const next = new Map(previous)
            if (stream) {
              next.set(peerId, stream)
            } else {
              next.delete(peerId)
            }
            return next
          })
        },
        onConnectionStateChange: (peerId, state) => {
          if (isDestroyed) {
            return
          }

          setConnectionStates((previous) =>
            new Map(previous).set(peerId, state),
          )

          if (state === 'connected') {
            reconnectAttemptsRef.current.delete(peerId)
          } else if (state === 'failed' || state === 'disconnected') {
            initiatedPeers.delete(peerId)
          }
        },
        onTrackStateChange: (peerId, state) => {
          if (!isDestroyed) {
            setTrackStates((previous) => new Map(previous).set(peerId, state))
          }
        },
        onError: (_peerId, error) => {
          if (!isDestroyed) {
            onWebrtcErrorRef.current(error)
          }
        },
      },
    )

    webrtcManagerRef.current = manager

    if (localStreamRef.current) {
      manager.setLocalStream(localStreamRef.current)
    }

    return () => {
      isDestroyed = true
      manager.destroy()
      webrtcManagerRef.current = null
      initiatedPeers.clear()
      resetSessionState()
    }
  }, [
    localPlayerId,
    roomId,
    presenceReady,
    isSignalingInitialized,
    resetSessionState,
  ])

  useEffect(() => {
    const manager = webrtcManagerRef.current
    if (!manager) {
      return
    }

    manager.setLocalStream(localStream)

    if (localStream && pendingSignalsRef.current.length > 0) {
      const queuedSignals = [...pendingSignalsRef.current]
      pendingSignalsRef.current = []

      void replayPendingSignals({
        manager,
        pendingSignals: queuedSignals,
        onError: onWebrtcErrorRef.current,
      })
    }
  }, [localStream])

  useEffect(() => {
    const manager = webrtcManagerRef.current
    if (!isSignalingInitialized || !manager) {
      return
    }

    reconcilePeerConnections({
      manager,
      remotePlayerIds: stableRemotePlayerIds,
      localPlayerId,
      roomId,
      localStreamReady: !!localStream && manager.hasLocalStream(),
      initiatedPeers: initiatedPeersRef.current,
      onError: onWebrtcErrorRef.current,
    })
  }, [
    stableRemotePlayerIds,
    isSignalingInitialized,
    localPlayerId,
    roomId,
    localStream,
  ])

  useEffect(() => {
    if (!isSignalingInitialized || !webrtcManagerRef.current) {
      return
    }

    const interval = window.setInterval(() => {
      const manager = webrtcManagerRef.current
      if (!manager) {
        return
      }

      runReconnectWatchdogTick({
        manager,
        localStreamReady: !!localStreamRef.current,
        connectionStates: connectionStatesRef.current,
        connectingSinceMs: connectingSinceMsRef.current,
        reconnectAttempts: reconnectAttemptsRef.current,
        initiatedPeers: initiatedPeersRef.current,
        localPlayerId,
        roomId,
        onConnectionReset: (peerId) => {
          setConnectionStates((previous) => {
            const next = new Map(previous)
            next.delete(peerId)
            return next
          })
        },
        onError: onWebrtcErrorRef.current,
      })
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
    error: signalingError ?? webrtcError,
    isInitialized: isSignalingInitialized,
  }
}
