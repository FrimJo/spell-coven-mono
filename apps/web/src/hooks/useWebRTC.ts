/**
 * WebRTC Hook
 * Manages peer-to-peer WebRTC connections for all players in a room
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PeerConnectionManager } from '@/lib/webrtc/peer-connection'
import type { PeerConnectionState } from '@/lib/webrtc/types'
import type { SignalingMessageSSE } from '@/lib/webrtc/signaling'
import { useWebRTCSignaling } from './useWebRTCSignaling'

interface RoomParticipant {
  id: string
  name: string
  isOnline?: boolean // Whether player is connected to SSE (backend)
}

interface UseWebRTCOptions {
  roomId: string
  localPlayerId: string
  players: RoomParticipant[]
  enabled?: boolean
}

interface PeerConnectionData {
  manager: PeerConnectionManager
  state: PeerConnectionState
  remoteStream: MediaStream | null
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
}

/**
 * Hook for managing WebRTC peer connections
 * Creates and manages peer connections for all players in the room
 */
export function useWebRTC({
  roomId,
  localPlayerId,
  players,
  enabled = true,
}: UseWebRTCOptions): UseWebRTCReturn {
  const [peerConnections, setPeerConnections] = useState<
    Map<string, PeerConnectionData>
  >(new Map())
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isVideoActive, setIsVideoActive] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)

  // Log initialization
  useEffect(() => {
    console.log('[WebRTC] Hook initialized:', {
      enabled,
      roomId,
      localPlayerId,
      playersCount: players.length,
      playerIds: players.map((p) => p.id),
    })
  }, [enabled, roomId, localPlayerId, players])

  const peerConnectionsRef = useRef<Map<string, PeerConnectionData>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  // Store offers that failed to send (for retry when player connects)
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map())

  // Update ref when state changes
  useEffect(() => {
    peerConnectionsRef.current = peerConnections
  }, [peerConnections])

  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  // Store sendAnswer in a ref so it can be used in the callback
  const sendAnswerRef = useRef<((to: string, answer: RTCSessionDescriptionInit) => Promise<void>) | null>(null)
  const sendIceCandidateRef = useRef<((to: string, candidate: RTCIceCandidateInit) => Promise<void>) | null>(null)

  /**
   * Handle incoming signaling messages
   */
  const handleSignalingMessage = useCallback(
    (message: SignalingMessageSSE) => {
      console.log(`[WebRTC] handleSignalingMessage called:`, {
        from: message.from,
        messageType: message.message.type,
        roomId: message.roomId,
        hasConnection: peerConnectionsRef.current.has(message.from),
        localPlayerId,
      })
      
      let connectionData = peerConnectionsRef.current.get(message.from)
      
      // Normalize IDs for comparison
      const normalizedMessageFrom = String(message.from)
      const normalizedLocalPlayerId = String(localPlayerId || '')
      
      // Don't process messages from ourselves
      if (normalizedMessageFrom === normalizedLocalPlayerId) {
        console.error(`[WebRTC] ERROR: Received signaling message from local player ${message.from}! Ignoring.`)
        return
      }
      
      // If we receive an offer from a peer we don't have a connection for yet,
      // create a passive connection to handle it (even if we haven't started video)
      if (!connectionData && message.message.type === 'offer') {
        console.log(
          `[WebRTC] Received offer from unknown peer ${message.from}, creating passive connection`,
        )
        
        // Find the player to get their info (using normalized comparison)
        const player = players.find((p) => String(p.id) === normalizedMessageFrom)
        if (!player) {
          console.warn(`[WebRTC] Received offer from unknown player: ${message.from}, available players:`, 
            players.map((p) => ({ id: p.id, idType: typeof p.id })))
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
          console.log(
            `[WebRTC] State changed for ${message.from}: ${state}`,
          )
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
          console.log(
            `[WebRTC] Received remote stream for ${message.from}:`,
            stream ? {
              id: stream.id,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              active: stream.active,
            } : 'null',
          )
          setPeerConnections((current) => {
            const updated = new Map(current)
            const existing = updated.get(message.from)
            if (existing) {
              updated.set(message.from, {
                ...existing,
                remoteStream: stream,
              })
            } else {
              console.warn(`[WebRTC] Received remote stream but connection data not found for ${message.from}`)
            }
            return updated
          })
        })

        manager.onIceCandidate((candidate) => {
          if (candidate && sendIceCandidateRef.current) {
            // Double-check we're not sending to ourselves (using normalized comparison)
            const normalizedMessageFrom = String(message.from)
            const normalizedLocalPlayerId = String(localPlayerId)
            if (normalizedMessageFrom === normalizedLocalPlayerId) {
              console.error(`[WebRTC] ERROR: Attempted to send ICE candidate to local player ${message.from} in passive connection! Skipping.`)
              return
            }
            
            console.log(`[WebRTC] Sending ICE candidate to ${message.from} (passive connection)`)
            sendIceCandidateRef.current(message.from, candidate).catch((error) => {
              // If player is not connected yet, this is expected during connection establishment
              const errorMessage = error instanceof Error ? error.message : String(error)
              if (errorMessage.includes('not found or not connected')) {
                console.warn(
                  `[WebRTC] Player ${message.from} not connected to SSE yet, ICE candidate will be retried automatically`,
                )
              } else {
                console.error(
                  `[WebRTC] Failed to send ICE candidate to ${message.from}:`,
                  error,
                )
              }
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
        }
        
        peerConnectionsRef.current.set(message.from, newConnectionData)
        setPeerConnections((prev) => {
          const updated = new Map(prev)
          updated.set(message.from, newConnectionData)
          return updated
        })

        connectionData = newConnectionData
      } else if (!connectionData) {
        console.warn(
          `[WebRTC] Received signaling message from unknown peer: ${message.from}`,
        )
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
                  console.error(`[WebRTC] Failed to send answer to ${message.from}:`, error)
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
      }
    },
    [localPlayerId, roomId, players],
  )

  // Setup signaling hook with callback
  const { sendOffer, sendAnswer, sendIceCandidate } = useWebRTCSignaling({
    roomId,
    localPlayerId,
    onSignalingMessage: handleSignalingMessage,
    enabled,
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

      console.log('[WebRTC] Obtained local media stream')
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
        console.warn('[WebRTC] Cannot initialize connections: localPlayerId is empty')
        return
      }
      
      // Normalize IDs to strings for comparison (Discord IDs can be strings or numbers)
      const normalizedLocalPlayerId = String(localPlayerId || '')
      
      const remotePlayers = players.filter((p) => {
        const normalizedPlayerId = String(p.id)
        const isRemote = normalizedPlayerId !== normalizedLocalPlayerId
        if (!isRemote) {
          console.warn(`[WebRTC] Skipping local player in connection creation: ${p.id} (${p.name}) [type: ${typeof p.id}] vs localPlayerId: ${localPlayerId} [type: ${typeof localPlayerId}]`)
        }
        return isRemote
      })
      
      console.log('[WebRTC] initializePeerConnections called:', {
        allPlayersCount: players.length,
        allPlayerIds: players.map((p) => ({ id: p.id, idType: typeof p.id, name: p.name })),
        localPlayerId,
        localPlayerIdType: typeof localPlayerId,
        normalizedLocalPlayerId,
        remotePlayersCount: remotePlayers.length,
        remotePlayerIds: remotePlayers.map((p) => p.id),
      })
      const newConnections = new Map<string, PeerConnectionData>()

      for (const player of remotePlayers) {
        // Double-check this isn't the local player (using normalized comparison)
        const normalizedPlayerId = String(player.id)
        if (normalizedPlayerId === normalizedLocalPlayerId) {
          console.error(`[WebRTC] ERROR: Attempted to create connection for local player ${player.id}! Skipping.`)
          continue
        }
        
        console.log(`[WebRTC] Creating connection for remote player: ${player.id} (${player.name})`)
        // Skip if connection already exists
        if (peerConnectionsRef.current.has(player.id)) {
          console.log(`[WebRTC] Connection already exists for ${player.id}, skipping`)
          continue
        }

        // Create peer connection manager
        const manager = new PeerConnectionManager({
          localPlayerId,
          remotePlayerId: player.id,
          roomId,
        })

        // Get initial state from manager (based on actual ICE connection state)
        const initialState = manager.getState()

        // Add local stream
        manager.addLocalStream(stream)

        // Capture normalized values for the ICE candidate callback
        const capturedPlayerId = player.id
        const capturedNormalizedPlayerId = normalizedPlayerId
        const capturedNormalizedLocalPlayerId = normalizedLocalPlayerId

        // Setup state change callback
        manager.onStateChange((state) => {
          console.log(
            `[WebRTC] State changed for ${capturedPlayerId}: ${state}`,
          )
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
        })
        
        // Check current state after setup (in case it changed during callback registration)
        // Use setTimeout to ensure this runs after any immediate state changes
        setTimeout(() => {
          const currentState = manager.getState()
          if (currentState !== initialState) {
            setPeerConnections((prev) => {
              const updated = new Map(prev)
              const existing = updated.get(capturedPlayerId)
              if (existing && existing.state !== currentState) {
                updated.set(capturedPlayerId, {
                  ...existing,
                  state: currentState,
                })
                return updated
              }
              return prev
            })
          }
        }, 0)

        // Setup remote stream callback
        manager.onRemoteStream((stream) => {
          console.log(
            `[WebRTC] Received remote stream for ${capturedPlayerId}`,
          )
          setPeerConnections((prev) => {
            const updated = new Map(prev)
            const existing = updated.get(capturedPlayerId)
            if (existing) {
              // When we receive a remote stream, connection is likely established
              // Check current state and update if needed
              const currentState = manager.getState()
              updated.set(capturedPlayerId, {
                ...existing,
                remoteStream: stream,
                // Update state if it's not already connected and we have a stream
                state: currentState === 'connected' ? currentState : existing.state,
              })
              
              // If we have a stream but state isn't connected, force check
              if (stream && currentState !== 'connected') {
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
        })

        // Setup ICE candidate callback - use captured values to avoid closure issues
        manager.onIceCandidate((candidate) => {
          if (candidate) {
            // Use captured normalized values to ensure correct comparison
            if (capturedNormalizedPlayerId === capturedNormalizedLocalPlayerId) {
              console.error(`[WebRTC] ERROR: Attempted to send ICE candidate to local player ${capturedPlayerId}! Skipping.`)
              return
            }
            
            // Only log first few ICE candidates to reduce noise
            const logKey = `ice-${capturedPlayerId}`
            const logCount = (window as any)[logKey] = ((window as any)[logKey] || 0) + 1
            if (logCount <= 3) {
              console.log(`[WebRTC] Sending ICE candidate #${logCount} to ${capturedPlayerId}`)
            }
            sendIceCandidate(capturedPlayerId, candidate).catch((error) => {
              // If player is not connected yet, this is expected during connection establishment
              // Log as warning instead of error to reduce noise
              const errorMessage = error instanceof Error ? error.message : String(error)
              if (errorMessage.includes('not found or not connected')) {
                console.warn(
                  `[WebRTC] Player ${capturedPlayerId} not connected to SSE yet, ICE candidate will be retried automatically`,
                )
              } else {
                console.error(
                  `[WebRTC] Failed to send ICE candidate to ${capturedPlayerId}:`,
                  error,
                )
              }
            })
          }
        })

        // Create offer and send it
        // Final safety check before creating offer (using normalized comparison)
        const normalizedPlayerIdForOffer = String(player.id)
        if (normalizedPlayerIdForOffer === normalizedLocalPlayerId) {
          console.error(`[WebRTC] ERROR: Attempted to create offer for local player ${player.id}! Skipping offer creation.`)
          continue
        }
        
        console.log(`[WebRTC] Creating offer for ${player.id}...`)
        manager
          .createOffer()
          .then((offer) => {
            console.log(`[WebRTC] Offer created for ${player.id}, sending via signaling...`)
            return sendOffer(player.id, offer)
              .then(() => {
                console.log(`[WebRTC] Offer sent successfully to ${player.id}`)
                // Remove from pending offers if it was there
                pendingOffersRef.current.delete(player.id)
              })
              .catch((error) => {
                // If player is not connected yet, store offer for retry
                const errorMessage = error instanceof Error ? error.message : String(error)
                if (errorMessage.includes('not found or not connected')) {
                  console.warn(
                    `[WebRTC] Player ${player.id} not connected to SSE yet, storing offer for retry`,
                  )
                  // Store the offer for retry when player connects
                  pendingOffersRef.current.set(player.id, offer)
                } else {
                  console.error(
                    `[WebRTC] Failed to send offer to ${player.id}:`,
                    error,
                  )
                }
                throw error // Re-throw to prevent success path
              })
          })
          .catch((error) => {
            // Handle offer creation failure
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (!errorMessage.includes('not found or not connected')) {
              console.error(
                `[WebRTC] Failed to create offer for ${player.id}:`,
                error,
              )
            }
          })

        newConnections.set(player.id, {
          manager,
          state: initialState,
          remoteStream: null,
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
    [roomId, localPlayerId, players, sendOffer, sendIceCandidate],
  )

  /**
   * Start video - request permissions and initialize connections
   */
  const startVideo = useCallback(async () => {
    console.log('[WebRTC] startVideo() called')
    try {
      console.log('[WebRTC] Requesting local media stream...')
      const stream = await getLocalMediaStream()
      console.log('[WebRTC] Obtained local media stream, initializing peer connections...')
      setLocalStream(stream)
      setIsVideoActive(true)

      // Initialize peer connections with local stream
      const remotePlayers = players.filter((p) => p.id !== localPlayerId)
      console.log('[WebRTC] Initializing connections for remote players:', remotePlayers.map((p) => p.id))
      initializePeerConnections(stream)
    } catch (error) {
      console.error('[WebRTC] Failed to start video:', error)
      setIsVideoActive(false)
      throw error
    }
  }, [getLocalMediaStream, initializePeerConnections, players, localPlayerId])

  /**
   * Stop video - stop local stream but keep connections open for receiving remote streams
   */
  const stopVideo = useCallback(() => {
    console.log('[WebRTC] stopVideo() called - stopping local stream but keeping connections open')
    
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
          console.log(`[WebRTC] Removed local stream from connection to ${playerId}`)
        } catch (error) {
          console.error(`[WebRTC] Failed to remove local stream from ${playerId}:`, error)
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

    videoTracks.forEach((track) => {
      track.enabled = enabled
    })

    // Note: This doesn't stop the stream, just disables video tracks
    // The UI will show "video off" when tracks are disabled
  }, [])

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
  const switchCamera = useCallback(
    async (deviceId: string) => {
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
    },
    [],
  )

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

  // Periodic state sync to ensure UI reflects actual connection states
  useEffect(() => {
    if (peerConnections.size === 0) {
      return
    }

    const syncInterval = setInterval(() => {
      setPeerConnections((prev) => {
        let changed = false
        const updated = new Map(prev)
        
        for (const [playerId, connectionData] of prev) {
          const actualState = connectionData.manager.getState()
          if (actualState !== connectionData.state) {
            console.log(
              `[WebRTC] State sync: ${playerId} was ${connectionData.state}, actually ${actualState}`,
            )
            updated.set(playerId, {
              ...connectionData,
              state: actualState,
            })
            changed = true
          }
        }
        
        return changed ? updated : prev
      })
    }, 2000) // Check every 2 seconds

    return () => clearInterval(syncInterval)
  }, [peerConnections])

  // Retry sending pending offers when players come online
  useEffect(() => {
    if (!localStreamRef.current) {
      return
    }

    if (pendingOffersRef.current.size === 0) {
      return
    }

    const normalizedLocalPlayerId = String(localPlayerId)
    const playerStatuses = players.map((p) => {
      const normalizedPlayerId = String(p.id)
      return {
        id: p.id,
        name: p.name,
        isOnline: p.isOnline,
        isOnlineExplicitlyTrue: p.isOnline === true,
        isRemote: normalizedPlayerId !== normalizedLocalPlayerId,
      }
    })

    const onlinePlayerIds = new Set(
      players
        .filter((p) => {
          const normalizedPlayerId = String(p.id)
          return (
            normalizedPlayerId !== normalizedLocalPlayerId &&
            p.isOnline === true // Only retry for explicitly online players
          )
        })
        .map((p) => p.id),
    )

    console.log('[WebRTC] Checking pending offers for retry:', {
      pendingOffers: Array.from(pendingOffersRef.current.keys()),
      playerStatuses,
      onlinePlayerIds: Array.from(onlinePlayerIds),
    })

    // Retry sending offers for players who are now online
    for (const [playerId, offer] of pendingOffersRef.current) {
      if (onlinePlayerIds.has(playerId)) {
        console.log(`[WebRTC] Player ${playerId} is now online, retrying offer`)
        sendOffer(playerId, offer)
          .then(() => {
            console.log(`[WebRTC] Retry: Offer sent successfully to ${playerId}`)
            pendingOffersRef.current.delete(playerId)
          })
          .catch((error) => {
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage.includes('not found or not connected')) {
              // Still not connected, keep in pending
              console.warn(
                `[WebRTC] Retry: Player ${playerId} still not connected, will retry again`,
              )
            } else {
              console.error(
                `[WebRTC] Retry: Failed to send offer to ${playerId}:`,
                error,
              )
              // Remove from pending if it's a different error
              pendingOffersRef.current.delete(playerId)
            }
          })
      }
    }
  }, [players, localPlayerId, sendOffer])

  // Update connections when players change (join/leave)
  useEffect(() => {
    console.log('[WebRTC] Players changed, checking connections:', {
      hasLocalStream: !!localStreamRef.current,
      playersCount: players.length,
      playerIds: players.map((p) => p.id),
      localPlayerId,
    })
    
    if (!localStreamRef.current) {
      // No local stream yet - connections will be created when video starts
      console.log('[WebRTC] No local stream yet, skipping connection updates')
      return
    }

    // Normalize IDs to strings for comparison
    const normalizedLocalPlayerId = String(localPlayerId)
    const currentPlayerIds = new Set(players.map((p) => String(p.id)))
    const remotePlayers = players.filter((p) => {
      const normalizedPlayerId = String(p.id)
      const isRemote = normalizedPlayerId !== normalizedLocalPlayerId
      if (!isRemote) {
        console.warn(`[WebRTC] Skipping local player in connection update: ${p.id} (${p.name}) [type: ${typeof p.id}] vs localPlayerId: ${localPlayerId} [type: ${typeof localPlayerId}]`)
      }
      return isRemote
    })
    console.log('[WebRTC] Updating connections for remote players:', {
      allPlayersCount: players.length,
      allPlayerIds: players.map((p) => ({ id: p.id, name: p.name })),
      localPlayerId,
      remotePlayersCount: remotePlayers.length,
      remotePlayerIds: remotePlayers.map((p) => p.id),
    })

    setPeerConnections((prev) => {
      const updated = new Map(prev)
      let changed = false

      // Close connections for players who left
      for (const [playerId, connectionData] of prev) {
        // Normalize playerId for comparison
        const normalizedPlayerId = String(playerId)
        if (!currentPlayerIds.has(normalizedPlayerId)) {
          // Player left - close connection
          connectionData.manager.close()
          updated.delete(playerId)
          changed = true
        }
      }

      // Create connections for new players
      for (const player of remotePlayers) {
        // Double-check this isn't the local player (using normalized comparison)
        const normalizedPlayerId = String(player.id)
        if (normalizedPlayerId === normalizedLocalPlayerId) {
          console.error(`[WebRTC] ERROR: Attempted to create connection for local player ${player.id} in useEffect! Skipping.`)
          continue
        }
        
        if (!updated.has(player.id)) {
          console.log(`[WebRTC] Creating new connection for player: ${player.id} (${player.name})`)
          // New player - create connection
          const manager = new PeerConnectionManager({
            localPlayerId,
            remotePlayerId: player.id,
            roomId,
          })

          // Get initial state from manager
          const initialState = manager.getState()

          if (localStreamRef.current) {
            manager.addLocalStream(localStreamRef.current)
          } else {
            console.warn(`[WebRTC] No local stream available when creating connection for ${player.id}`)
          }

          // Setup callbacks
          manager.onStateChange((state) => {
            console.log(
              `[WebRTC] State changed for ${player.id}: ${state}`,
            )
            setPeerConnections((current) => {
              const updated = new Map(current)
              const existing = updated.get(player.id)
              if (existing) {
                updated.set(player.id, {
                  ...existing,
                  state,
                })
              }
              return updated
            })
          })

          manager.onRemoteStream((stream) => {
            console.log(
              `[WebRTC] Received remote stream for ${player.id} (useEffect connection):`,
              stream ? {
                streamId: stream.id,
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length,
                active: stream.active,
              } : 'null',
            )
            setPeerConnections((current) => {
              const updated = new Map(current)
              const existing = updated.get(player.id)
              if (existing) {
                updated.set(player.id, {
                  ...existing,
                  remoteStream: stream,
                })
                console.log(`[WebRTC] Updated peer connection for ${player.id} with remote stream`)
              } else {
                console.warn(`[WebRTC] Received remote stream but connection data not found for ${player.id}`)
              }
              return updated
            })
          })

          manager.onIceCandidate((candidate) => {
            if (candidate) {
              // Double-check we're not sending to ourselves (using normalized comparison)
              const normalizedPlayerId = String(player.id)
              if (normalizedPlayerId === normalizedLocalPlayerId) {
                console.error(`[WebRTC] ERROR: Attempted to send ICE candidate to local player ${player.id} in useEffect! Skipping.`)
                return
              }
              
              console.log(`[WebRTC] Sending ICE candidate to ${player.id} (useEffect connection)`)
              sendIceCandidate(player.id, candidate).catch((error) => {
                // If player is not connected yet, this is expected during connection establishment
                const errorMessage = error instanceof Error ? error.message : String(error)
                if (errorMessage.includes('not found or not connected')) {
                  console.warn(
                    `[WebRTC] Player ${player.id} not connected to SSE yet, ICE candidate will be retried automatically`,
                  )
                } else {
                  console.error(
                    `[WebRTC] Failed to send ICE candidate to ${player.id}:`,
                    error,
                  )
                }
              })
            }
          })

          // Create and send offer
          manager
            .createOffer()
            .then((offer) => {
              return sendOffer(player.id, offer)
            })
            .catch((error) => {
              // If player is not connected yet, this is expected during connection establishment
              const errorMessage = error instanceof Error ? error.message : String(error)
              if (errorMessage.includes('not found or not connected')) {
                console.warn(
                  `[WebRTC] Player ${player.id} not connected to SSE yet, offer will be sent when they connect`,
                )
              } else {
                console.error(
                  `[WebRTC] Failed to create/send offer to ${player.id}:`,
                  error,
                )
              }
            })

          updated.set(player.id, {
            manager,
            state: initialState,
            remoteStream: null,
          })
          changed = true
        }
      }

      return changed ? updated : prev
    })
  }, [players, roomId, localPlayerId, sendOffer, sendIceCandidate])

  // Clean up any connections that were incorrectly created for the local player
  useEffect(() => {
    if (!localPlayerId) return

    const normalizedLocalPlayerId = String(localPlayerId)
    let cleaned = false

    setPeerConnections((prev) => {
      const updated = new Map(prev)
      for (const [playerId, connectionData] of prev) {
        const normalizedPlayerId = String(playerId)
        if (normalizedPlayerId === normalizedLocalPlayerId) {
          console.error(
            `[WebRTC] Found connection for local player ${playerId}, closing it`,
          )
          connectionData.manager.close()
          updated.delete(playerId)
          cleaned = true
        }
      }
      return cleaned ? updated : prev
    })
  }, [localPlayerId, peerConnections])

  // Derive connection states and remote streams maps
  // Use useMemo to ensure stable references and prevent unnecessary re-renders
  const { connectionStates, remoteStreams } = useMemo(() => {
    const states = new Map<string, PeerConnectionState>()
    const streams = new Map<string, MediaStream | null>()
    const normalizedLocalPlayerId = String(localPlayerId)

    for (const [playerId, connectionData] of peerConnections) {
      // Skip local player connections
      const normalizedPlayerId = String(playerId)
      if (normalizedPlayerId === normalizedLocalPlayerId) {
        console.warn(
          `[WebRTC] Skipping local player connection in derived maps: ${playerId}`,
        )
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
  }
}

