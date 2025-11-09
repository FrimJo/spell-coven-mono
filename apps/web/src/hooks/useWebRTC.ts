/**
 * WebRTC Hook
 * Manages peer-to-peer WebRTC connections for all players in a room
 */

import type { SignalingMessageSSE } from '@/lib/webrtc/signaling'
import type { PeerConnectionState } from '@/lib/webrtc/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isTrackStatePayload } from '@/lib/webrtc/signaling'
import { PeerConnectionManager } from '@/lib/webrtc/peer-connection'
import {
  createPeerConnectionWithCallbacks,
  isSelfConnection,
  normalizePlayerId,
} from '@/lib/webrtc/utils'
import { connectedUserIdsQueryOptions } from '@/routes/game.$gameId'
import { useSuspenseQuery } from '@tanstack/react-query'

import { useWebRTCSignaling } from './useWebRTCSignaling'

interface UseWebRTCOptions {
  roomId: string
  localPlayerId: string
}

interface PeerConnectionData {
  manager: PeerConnectionManager
  state: PeerConnectionState
  remoteStream: MediaStream | null
  videoEnabled: boolean
  audioEnabled: boolean
}

interface UseWebRTCReturn {
  /** Map of player ID to peer connection data */
  peerConnections: Map<string, PeerConnectionData>
  /** Local media stream */
  localStream: MediaStream | null
  /** Connection states per player */
  connectionStates: Map<string, PeerConnectionState>
  /** Remote streams per player */
  remoteStreams: Map<string, MediaStream | null>
  /** Start video - request permissions and create local stream */
  startVideo: () => Promise<void>
  /** Stop video - stop local stream */
  stopVideo: () => void
  /** Toggle video enabled/disabled */
  toggleVideo: () => void
  /** Toggle audio muted/unmuted */
  toggleAudio: () => void
  /** Switch camera device */
  switchCamera: (deviceId: string) => Promise<void>
  /** Whether local video is active */
  isVideoActive: boolean
  /** Whether local audio is muted */
  isAudioMuted: boolean
  /** Whether local video track is enabled */
  isVideoEnabled: boolean
}

/**
 * Hook for managing WebRTC peer connections
 * Creates and manages peer connections for all players in the room
 */
export function useWebRTC({
  roomId,
  localPlayerId,
}: UseWebRTCOptions): UseWebRTCReturn {
  const [peerConnections, setPeerConnections] = useState<
    Map<string, PeerConnectionData>
  >(new Map())
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isVideoActive, setIsVideoActive] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)

  const peerConnectionsRef = useRef<Map<string, PeerConnectionData>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)

  const { data: connectedUserIds } = useSuspenseQuery(
    connectedUserIdsQueryOptions(roomId),
  )

  const playerIds = Array.from(connectedUserIds.userIds)

  // Update ref when state changes
  useEffect(() => {
    peerConnectionsRef.current = peerConnections
  }, [peerConnections])

  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  // Store sendAnswer in a ref so it can be used in the callback
  const sendAnswerRef = useRef<
    ((to: string, answer: RTCSessionDescriptionInit) => Promise<void>) | null
  >(null)
  const sendIceCandidateRef = useRef<
    ((to: string, candidate: RTCIceCandidateInit) => Promise<void>) | null
  >(null)

  /**
   * Handle incoming signaling messages
   */
  const handleSignalingMessage = useCallback(
    (message: SignalingMessageSSE) => {
      let connectionData = peerConnectionsRef.current.get(message.from)

      // Normalize IDs for comparison
      const normalizedMessageFrom = normalizePlayerId(message.from)

      // Don't process messages from ourselves
      if (isSelfConnection(localPlayerId, normalizedMessageFrom)) {
        console.error(
          `[WebRTC] ERROR: Received signaling message from local player ${message.from}! Ignoring.`,
        )
        return
      }

      // If we receive an offer from a peer we don't have a connection for yet,
      // create a passive connection to handle it (even if we haven't started video)
      if (!connectionData && message.message.type === 'offer') {
        // Find the player to get their info (using normalized comparison)
        const player = playerIds.find(
          (playerId) => normalizePlayerId(playerId) === normalizedMessageFrom,
        )
        if (!player) {
          // Still create the connection - player might join soon or be in process of joining
        }

        // Create a passive peer connection (no local stream yet)
        // This allows receiving remote streams even if we haven't started our own video
        const manager = new PeerConnectionManager({
          localPlayerId,
          remotePlayerId: message.from,
          roomId,
        })

        const initialState = manager.getState()

        // Setup callbacks
        manager.onStateChange((state) => {
          setPeerConnections((current) => {
            const updated = new Map(current)
            const existing = updated.get(message.from)
            if (existing) {
              updated.set(message.from, {
                ...existing,
                state,
              })
            }
            return updated
          })
        })

        manager.onRemoteStream((stream) => {
          setPeerConnections((current) => {
            const updated = new Map(current)
            const existing = updated.get(message.from)
            if (existing) {
              updated.set(message.from, {
                ...existing,
                remoteStream: stream,
              })
            }
            return updated
          })
        })

        manager.onIceCandidate((candidate) => {
          if (candidate && sendIceCandidateRef.current) {
            // Double-check we're not sending to ourselves (using normalized comparison)
            if (isSelfConnection(localPlayerId, message.from)) {
              console.error(
                `[WebRTC] ERROR: Attempted to send ICE candidate to local player ${message.from} in passive connection! Skipping.`,
              )
              return
            }

            sendIceCandidateRef.current(message.from, candidate).catch(() => {
              // Error logging is handled in useWebRTCSignaling.sendIceCandidate
            })
          }
        })

        // Add local stream if we have one
        if (localStreamRef.current) {
          manager.addLocalStream(localStreamRef.current)
        }

        // Store the connection
        const newConnectionData: PeerConnectionData = {
          manager,
          state: initialState,
          remoteStream: null,
          videoEnabled: true,
          audioEnabled: true,
        }

        peerConnectionsRef.current.set(message.from, newConnectionData)
        setPeerConnections((prev) => {
          const updated = new Map(prev)
          updated.set(message.from, newConnectionData)
          return updated
        })

        connectionData = newConnectionData
      } else if (!connectionData) {
        // Unknown peer - ignore non-offer messages (offers create passive connections above)
        return
      }

      const { manager } = connectionData

      if (message.message.type === 'offer') {
        // Handle incoming offer
        const payload = message.message.payload
        if ('sdp' in payload && payload.type === 'offer') {
          manager
            .handleOffer({ type: 'offer', sdp: payload.sdp })
            .then((answer) => {
              // Send answer via signaling using ref
              if (sendAnswerRef.current) {
                sendAnswerRef.current(message.from, answer).catch((error) => {
                  console.error(
                    `[WebRTC] Failed to send answer to ${message.from}:`,
                    error,
                  )
                })
              }
            })
            .catch((error) => {
              console.error('[WebRTC] Failed to handle offer:', error)
            })
        }
      } else if (message.message.type === 'answer') {
        // Handle incoming answer
        const payload = message.message.payload
        if ('sdp' in payload && payload.type === 'answer') {
          manager
            .handleAnswer({ type: 'answer', sdp: payload.sdp })
            .catch((error) => {
              console.error('[WebRTC] Failed to handle answer:', error)
            })
        }
      } else if (message.message.type === 'ice-candidate') {
        // Handle incoming ICE candidate
        const payload = message.message.payload
        if ('candidate' in payload) {
          manager
            .handleIceCandidate({
              candidate: payload.candidate,
              sdpMLineIndex: payload.sdpMLineIndex ?? undefined,
              sdpMid: payload.sdpMid ?? undefined,
            })
            .catch((error) => {
              console.error('[WebRTC] Failed to handle ICE candidate:', error)
            })
        }
      } else if (message.message.type === 'track-state') {
        // Handle incoming track state change
        const payload = message.message.payload
        if (isTrackStatePayload(payload)) {
          console.log(
            `[WebRTC] Received track-state from ${message.from}:`,
            payload,
          )
          setPeerConnections((current) => {
            const updated = new Map(current)
            const existing = updated.get(message.from)
            if (existing) {
              updated.set(message.from, {
                ...existing,
                videoEnabled: payload.kind === 'video' ? payload.enabled : existing.videoEnabled,
                audioEnabled: payload.kind === 'audio' ? payload.enabled : existing.audioEnabled,
              })
              console.log(
                `[WebRTC] Updated peer ${message.from} track state:`,
                {
                  videoEnabled: payload.kind === 'video' ? payload.enabled : existing.videoEnabled,
                  audioEnabled: payload.kind === 'audio' ? payload.enabled : existing.audioEnabled,
                },
              )
            }
            return updated
          })
        }
      }
    },
    [localPlayerId, roomId, playerIds],
  )

  // Setup signaling hook with callback
  const { sendOffer, sendAnswer, sendIceCandidate, sendTrackState } = useWebRTCSignaling({
    roomId,
    localPlayerId,
    onSignalingMessage: handleSignalingMessage,
  })

  // Update sendAnswer and sendIceCandidate refs when they change
  useEffect(() => {
    sendAnswerRef.current = sendAnswer
    sendIceCandidateRef.current = sendIceCandidate
  }, [sendAnswer, sendIceCandidate])

  /**
   * Get local media stream (camera + microphone)
   */
  const getLocalMediaStream = useCallback(async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      return stream
    } catch (error) {
      console.error('[WebRTC] Failed to get media stream:', error)
      throw error
    }
  }, [])

  /**
   * Initialize peer connections for all remote players
   */
  const initializePeerConnections = useCallback(
    (stream: MediaStream) => {
      if (!localPlayerId) {
        return
      }

      const remotePlayers = playerIds.filter((playerId) => {
        return !isSelfConnection(localPlayerId, playerId)
      })
      const newConnections = new Map<string, PeerConnectionData>()

      for (const playerId of remotePlayers) {
        // Double-check this isn't the local player (using normalized comparison)
        if (isSelfConnection(localPlayerId, playerId)) {
          console.error(
            `[WebRTC] ERROR: Attempted to create connection for local player ${playerId}! Skipping.`,
          )
          continue
        }

        // Skip if connection already exists
        if (peerConnectionsRef.current.has(playerId)) {
          continue
        }

        // Capture values for callbacks
        const capturedPlayerId = playerId

        // Create peer connection using utility function
        const manager = createPeerConnectionWithCallbacks({
          localPlayerId,
          remotePlayerId: playerId,
          roomId,
          localStream: stream,
          onStateChange: (state) => {
            setPeerConnections((prev) => {
              const updated = new Map(prev)
              const existing = updated.get(capturedPlayerId)
              if (existing) {
                updated.set(capturedPlayerId, {
                  ...existing,
                  state,
                })
              }
              return updated
            })
          },
          onRemoteStream: (remoteStream) => {
            setPeerConnections((prev) => {
              const updated = new Map(prev)
              const existing = updated.get(capturedPlayerId)
              if (existing) {
                // When we receive a remote stream, connection is likely established
                // Check current state and update if needed
                const currentState = manager.getState()
                updated.set(capturedPlayerId, {
                  ...existing,
                  remoteStream,
                  // Update state if it's not already connected and we have a stream
                  state:
                    currentState === 'connected'
                      ? currentState
                      : existing.state,
                })

                // If we have a stream but state isn't connected, force check
                if (remoteStream && currentState !== 'connected') {
                  // The manager should update state via ICE events, but double-check
                  setTimeout(() => {
                    const latestState = manager.getState()
                    if (latestState === 'connected') {
                      setPeerConnections((current) => {
                        const latest = new Map(current)
                        const latestExisting = latest.get(capturedPlayerId)
                        if (latestExisting) {
                          latest.set(capturedPlayerId, {
                            ...latestExisting,
                            state: latestState,
                          })
                          return latest
                        }
                        return current
                      })
                    }
                  }, 100)
                }
              }
              return updated
            })
          },
          onIceCandidate: (candidate) => {
            sendIceCandidate(capturedPlayerId, candidate).catch(() => {
              // Error logging is handled in useWebRTCSignaling.sendIceCandidate
            })
          },
        })

        // Get initial state from manager (based on actual ICE connection state)
        const initialState = manager.getState()

        // Create offer and send it
        // Error handling is centralized in useWebRTCSignaling.sendOffer
        manager
          .createOffer()
          .then((offer) => {
            return sendOffer(playerId, offer)
          })
          .catch((error) => {
            // Handle offer creation/sending failure
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            if (!errorMessage.includes('not found or not connected')) {
              console.error(
                `[WebRTC] Failed to create/send offer for ${playerId}:`,
                error,
              )
            }
            // If player is not connected yet, this is expected during connection establishment
          })

        newConnections.set(playerId, {
          manager,
          state: initialState,
          remoteStream: null,
          videoEnabled: true,
          audioEnabled: true,
        })
      }

      if (newConnections.size > 0) {
        setPeerConnections((prev) => {
          const merged = new Map(prev)
          for (const [id, data] of newConnections) {
            merged.set(id, data)
          }
          return merged
        })
      }
    },
    [roomId, localPlayerId, playerIds, sendOffer, sendIceCandidate],
  )

  /**
   * Start video - request permissions and initialize connections
   */
  const startVideo = useCallback(async () => {
    try {
      const stream = await getLocalMediaStream()
      setLocalStream(stream)
      setIsVideoActive(true)

      // Initialize peer connections with local stream
      initializePeerConnections(stream)
    } catch (error) {
      console.error('[WebRTC] Failed to start video:', error)
      setIsVideoActive(false)
      throw error
    }
  }, [getLocalMediaStream, initializePeerConnections])

  /**
   * Stop video - stop local stream but keep connections open for receiving remote streams
   */
  const stopVideo = useCallback(() => {
    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      setLocalStream(null)
      setIsVideoActive(false)

      // Remove local stream from all peer connections but keep connections alive
      // This allows us to continue receiving remote streams
      for (const [playerId, connectionData] of peerConnectionsRef.current) {
        try {
          // Remove local stream from this connection but don't close it
          connectionData.manager.removeLocalStream()
        } catch (error) {
          console.error(
            `[WebRTC] Failed to remove local stream from ${playerId}:`,
            error,
          )
        }
      }
    }

    // Don't close peer connections - we want to keep receiving remote streams
    // Connections will be cleaned up when component unmounts or player leaves
  }, [])

  /**
   * Toggle video enabled/disabled
   */
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) {
      return
    }

    const videoTracks = localStreamRef.current.getVideoTracks()
    const enabled = !videoTracks[0]?.enabled

    console.log(`[WebRTC] Toggling video: ${enabled ? 'ON' : 'OFF'}`)

    videoTracks.forEach((track) => {
      track.enabled = enabled
    })

    // Update local state
    setIsVideoEnabled(enabled)

    // Broadcast track state change to all connected peers
    const connectedPeers = Array.from(peerConnectionsRef.current.entries())
      .filter(([, data]) => data.state === 'connected')
    
    console.log(
      `[WebRTC] Broadcasting track state to ${connectedPeers.length} connected peers`,
      connectedPeers.map(([id]) => id),
    )

    for (const [playerId, connectionData] of peerConnectionsRef.current) {
      if (connectionData.state === 'connected') {
        sendTrackState('video', enabled, playerId).catch((error) => {
          console.error(
            `[WebRTC] Failed to send video track state to ${playerId}:`,
            error,
          )
        })
      }
    }

    // Note: This doesn't stop the stream, just disables video tracks
    // The UI will show "video off" when tracks are disabled
  }, [sendTrackState])

  /**
   * Toggle audio muted/unmuted
   */
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) {
      return
    }

    const audioTracks = localStreamRef.current.getAudioTracks()
    const muted = !isAudioMuted

    audioTracks.forEach((track) => {
      track.enabled = !muted
    })

    setIsAudioMuted(muted)
  }, [isAudioMuted])

  /**
   * Switch camera device
   */
  const switchCamera = useCallback(async (deviceId: string) => {
    if (!localStreamRef.current) {
      throw new Error('No local stream available')
    }

    try {
      // Get new stream with selected camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: true,
      })

      const newVideoTrack = newStream.getVideoTracks()[0]
      if (!newVideoTrack) {
        throw new Error('No video track in new stream')
      }

      // Replace video track in all peer connections
      for (const [playerId, connectionData] of peerConnectionsRef.current) {
        try {
          await connectionData.manager.replaceVideoTrack(newVideoTrack)
        } catch (error) {
          console.error(
            `[WebRTC] Failed to replace track for ${playerId}:`,
            error,
          )
        }
      }

      // Stop old video track
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0]
      if (oldVideoTrack) {
        oldVideoTrack.stop()
      }

      // Update local stream reference
      setLocalStream(newStream)
      localStreamRef.current = newStream
    } catch (error) {
      console.error('[WebRTC] Failed to switch camera:', error)
      throw error
    }
  }, [])

  // Cleanup on unmount or when players change
  useEffect(() => {
    return () => {
      // Close all peer connections
      for (const [, connectionData] of peerConnectionsRef.current) {
        connectionData.manager.close()
      }

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop()
        })
      }
    }
  }, [])

  // State updates are now event-driven via PeerConnectionManager.onStateChange callbacks
  // No polling needed - removed in US3
  // Retry mechanism removed in US3 - offers are sent when connections are created

  // Update connections when players change (join/leave)
  useEffect(() => {
    if (!localStreamRef.current) {
      // No local stream yet - connections will be created when video starts
      return
    }

    // Normalize IDs to strings for comparison
    const currentPlayerIds = new Set(
      playerIds.map((playerId) => normalizePlayerId(playerId)),
    )
    const remotePlayers = playerIds.filter((playerId) => {
      return !isSelfConnection(localPlayerId, playerId)
    })

    setPeerConnections((prev) => {
      const updated = new Map(prev)
      let changed = false

      // Close connections for players who left
      for (const [playerId, connectionData] of prev) {
        // Normalize playerId for comparison
        const normalizedPlayerId = normalizePlayerId(playerId)
        if (!currentPlayerIds.has(normalizedPlayerId)) {
          // Player left - close connection
          connectionData.manager.close()
          updated.delete(playerId)
          changed = true
        }
      }

      // Create connections for new players
      for (const playerId of remotePlayers) {
        // Double-check this isn't the local player (using normalized comparison)
        if (isSelfConnection(localPlayerId, playerId)) {
          console.error(
            `[WebRTC] ERROR: Attempted to create connection for local player ${playerId} in useEffect! Skipping.`,
          )
          continue
        }

        if (!updated.has(playerId)) {
          // New player - create connection
          const manager = new PeerConnectionManager({
            localPlayerId,
            remotePlayerId: playerId,
            roomId,
          })

          // Get initial state from manager
          const initialState = manager.getState()

          if (localStreamRef.current) {
            manager.addLocalStream(localStreamRef.current)
          }

          // Setup callbacks
          manager.onStateChange((state) => {
            setPeerConnections((current) => {
              const updated = new Map(current)
              const existing = updated.get(playerId)
              if (existing) {
                updated.set(playerId, {
                  ...existing,
                  state,
                })
              }
              return updated
            })
          })

          manager.onRemoteStream((stream) => {
            setPeerConnections((current) => {
              const updated = new Map(current)
              const existing = updated.get(playerId)
              if (existing) {
                updated.set(playerId, {
                  ...existing,
                  remoteStream: stream,
                })
              }
              return updated
            })
          })

          manager.onIceCandidate((candidate) => {
            if (candidate) {
              // Double-check we're not sending to ourselves (using normalized comparison)
              if (isSelfConnection(localPlayerId, playerId)) {
                console.error(
                  `[WebRTC] ERROR: Attempted to send ICE candidate to local player ${playerId} in useEffect! Skipping.`,
                )
                return
              }

              sendIceCandidate(playerId, candidate).catch(() => {
                // Error logging is handled in useWebRTCSignaling.sendIceCandidate
              })
            }
          })

          // Create and send offer
          manager
            .createOffer()
            .then((offer) => {
              return sendOffer(playerId, offer)
            })
            .catch((error) => {
              // If player is not connected yet, this is expected during connection establishment
              const errorMessage =
                error instanceof Error ? error.message : String(error)
              if (!errorMessage.includes('not found or not connected')) {
                console.error(
                  `[WebRTC] Failed to create/send offer to ${playerId}:`,
                  error,
                )
              }
            })

          updated.set(playerId, {
            manager,
            state: initialState,
            remoteStream: null,
            videoEnabled: true,
            audioEnabled: true,
          })
          changed = true
        }
      }

      return changed ? updated : prev
    })
  }, [playerIds, roomId, localPlayerId, sendOffer, sendIceCandidate])

  // Self-connection prevention is now built into connection creation (US2)
  // No cleanup needed - isSelfConnection checks prevent self-connections from being created

  // Derive connection states and remote streams maps
  // Use useMemo to ensure stable references and prevent unnecessary re-renders
  const { connectionStates, remoteStreams } = useMemo(() => {
    const states = new Map<string, PeerConnectionState>()
    const streams = new Map<string, MediaStream | null>()
    const normalizedLocalPlayerId = normalizePlayerId(localPlayerId)

    for (const [playerId, connectionData] of peerConnections) {
      // Skip local player connections
      const normalizedPlayerId = normalizePlayerId(playerId)
      if (isSelfConnection(normalizedLocalPlayerId, normalizedPlayerId)) {
        continue
      }
      states.set(playerId, connectionData.state)
      streams.set(playerId, connectionData.remoteStream)
    }

    return { connectionStates: states, remoteStreams: streams }
  }, [peerConnections, localPlayerId])

  return {
    peerConnections,
    localStream,
    connectionStates,
    remoteStreams,
    startVideo,
    stopVideo,
    toggleVideo,
    toggleAudio,
    switchCamera,
    isVideoActive,
    isAudioMuted,
    isVideoEnabled,
  }
}
