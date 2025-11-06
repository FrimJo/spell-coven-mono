/**
 * WebRTC Peer Connection Manager
 * Wrapper around RTCPeerConnection for managing peer-to-peer connections
 */

import type {
  PeerConnectionConfig,
  PeerConnectionMetadata,
  PeerConnectionState,
} from './types'

/**
 * Peer connection manager class
 * Wraps RTCPeerConnection and manages connection lifecycle
 */
export class PeerConnectionManager {
  private rtcPeerConnection: RTCPeerConnection
  private metadata: PeerConnectionMetadata
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private stateChangeCallbacks: Set<(state: PeerConnectionState) => void> =
    new Set()
  private remoteStreamCallbacks: Set<(stream: MediaStream | null) => void> =
    new Set()

  constructor(config: PeerConnectionConfig) {
    // Validate that local and remote player IDs are different
    if (config.localPlayerId === config.remotePlayerId) {
      throw new Error(
        'Local and remote player IDs must be different for peer connection',
      )
    }

    // Create RTCPeerConnection with STUN server configuration
    this.rtcPeerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    // Initialize metadata
    const now = Date.now()
    // Initialize state based on current ICE connection state
    const initialIceState = this.rtcPeerConnection.iceConnectionState
    const initialState = this.mapIceStateToAppState(initialIceState)
    
    this.metadata = {
      id: `${config.localPlayerId}-${config.remotePlayerId}`,
      localPlayerId: config.localPlayerId,
      remotePlayerId: config.remotePlayerId,
      roomId: config.roomId,
      state: initialState,
      createdAt: now,
      lastStateChange: now,
    }

    // Setup event listeners
    this.setupEventListeners()
    
    // Immediately check and update state in case it changed during setup
    const currentIceState = this.rtcPeerConnection.iceConnectionState
    const currentAppState = this.mapIceStateToAppState(currentIceState)
    if (currentAppState !== initialState) {
      this.updateState(currentAppState)
    }
  }

  /**
   * Setup RTCPeerConnection event listeners
   */
  private setupEventListeners(): void {
    // Handle ICE connection state changes
    this.rtcPeerConnection.oniceconnectionstatechange = () => {
      const iceState = this.rtcPeerConnection.iceConnectionState
      const appState = this.mapIceStateToAppState(iceState)
      console.log(
        `[PeerConnection] ICE connection state changed: ${iceState} → app state: ${appState} for ${this.metadata.remotePlayerId}`,
      )
      this.updateState(appState)
    }
    
    // Also listen to connectionstatechange as a backup/additional check
    this.rtcPeerConnection.onconnectionstatechange = () => {
      const connectionState = this.rtcPeerConnection.connectionState
      const iceState = this.rtcPeerConnection.iceConnectionState
      console.log(
        `[PeerConnection] Connection state: ${connectionState}, ICE state: ${iceState} for ${this.metadata.remotePlayerId}`,
      )
      // Update state based on ICE connection state (primary source)
      const appState = this.mapIceStateToAppState(iceState)
      this.updateState(appState)
    }

    // Handle remote stream tracks
    this.rtcPeerConnection.ontrack = (event) => {
      console.log(
        `[PeerConnection] Received remote track: ${event.track.kind} from ${this.metadata.remotePlayerId}`,
        {
          trackId: event.track.id,
          trackKind: event.track.kind,
          trackEnabled: event.track.enabled,
          trackReadyState: event.track.readyState,
          streamsCount: event.streams.length,
          streamIds: event.streams.map((s) => s.id),
        },
      )

      const stream = event.streams[0]
      if (stream) {
        console.log(
          `[PeerConnection] Setting remote stream for ${this.metadata.remotePlayerId}:`,
          {
            streamId: stream.id,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            active: stream.active,
          },
        )
        this.remoteStream = stream
        console.log(
          `[PeerConnection] Calling ${this.remoteStreamCallbacks.size} remote stream callbacks for ${this.metadata.remotePlayerId}`,
        )
        this.remoteStreamCallbacks.forEach((callback) => callback(stream))
      } else {
        console.warn(
          `[PeerConnection] Received track event but no stream found for ${this.metadata.remotePlayerId}`,
        )
      }
    }

    // Handle ICE candidates
    this.rtcPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(
          `[PeerConnection] ICE candidate generated for ${this.metadata.remotePlayerId}`,
        )
        // ICE candidates are handled by the hook, not here
      }
    }

  }

  /**
   * Map RTCPeerConnection.iceConnectionState to application state
   */
  private mapIceStateToAppState(
    iceState: RTCIceConnectionState,
  ): PeerConnectionState {
    switch (iceState) {
      case 'new':
        return 'connecting'
      case 'checking':
        return 'connecting'
      case 'connected':
        return 'connected'
      case 'completed':
        return 'connected'
      case 'failed':
        return 'failed'
      case 'disconnected':
        return 'reconnecting'
      case 'closed':
        return 'disconnected'
      default:
        return 'disconnected'
    }
  }

  /**
   * Update connection state and notify callbacks
   */
  private updateState(newState: PeerConnectionState): void {
    if (this.metadata.state === newState) {
      return
    }

    const oldState = this.metadata.state
    this.metadata.state = newState
    this.metadata.lastStateChange = Date.now()

    console.log(
      `[PeerConnection] State transition: ${oldState} → ${newState} for ${this.metadata.remotePlayerId}`,
    )

    // Notify state change callbacks
    this.stateChangeCallbacks.forEach((callback) => callback(newState))
  }

  /**
   * Add local media stream to peer connection
   */
  addLocalStream(stream: MediaStream): void {
    this.localStream = stream

    // Add all tracks from the stream to the peer connection
    stream.getTracks().forEach((track) => {
      this.rtcPeerConnection.addTrack(track, stream)
    })

    console.log(
      `[PeerConnection] Added local stream with ${stream.getTracks().length} tracks`,
    )
  }

  /**
   * Create offer and set local description
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    try {
      const offer = await this.rtcPeerConnection.createOffer()
      await this.rtcPeerConnection.setLocalDescription(offer)

      console.log(
        `[PeerConnection] Created offer for ${this.metadata.remotePlayerId}`,
      )

      return offer
    } catch (error) {
      console.error('[PeerConnection] Failed to create offer:', error)
      throw error
    }
  }

  /**
   * Handle incoming offer: set remote description and create answer
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    try {
      await this.rtcPeerConnection.setRemoteDescription(
        new RTCSessionDescription(offer),
      )

      const answer = await this.rtcPeerConnection.createAnswer()
      await this.rtcPeerConnection.setLocalDescription(answer)

      console.log(
        `[PeerConnection] Created answer for offer from ${this.metadata.remotePlayerId}`,
      )

      return answer
    } catch (error) {
      console.error('[PeerConnection] Failed to handle offer:', error)
      throw error
    }
  }

  /**
   * Handle incoming answer: set remote description
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      await this.rtcPeerConnection.setRemoteDescription(
        new RTCSessionDescription(answer),
      )

      console.log(
        `[PeerConnection] Set remote description from answer for ${this.metadata.remotePlayerId}`,
      )
    } catch (error) {
      console.error('[PeerConnection] Failed to handle answer:', error)
      throw error
    }
  }

  /**
   * Handle incoming ICE candidate: add to peer connection
   */
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.rtcPeerConnection.addIceCandidate(
        new RTCIceCandidate(candidate),
      )

      console.log(
        `[PeerConnection] Added ICE candidate for ${this.metadata.remotePlayerId}`,
      )
    } catch (error) {
      console.error('[PeerConnection] Failed to add ICE candidate:', error)
      // Don't throw - ICE candidate errors are often non-fatal
    }
  }

  /**
   * Replace video track in peer connection (for camera switching)
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    const senders = this.rtcPeerConnection.getSenders()
    const videoSender = senders.find(
      (sender) => sender.track?.kind === 'video',
    )

    if (!videoSender) {
      throw new Error('No video sender found in peer connection')
    }

    try {
      await videoSender.replaceTrack(newTrack)
      console.log(
        `[PeerConnection] Replaced video track for ${this.metadata.remotePlayerId}`,
      )
    } catch (error) {
      console.error('[PeerConnection] Failed to replace video track:', error)
      throw error
    }
  }

  /**
   * Get RTCPeerConnection instance
   */
  getRTCPeerConnection(): RTCPeerConnection {
    return this.rtcPeerConnection
  }

  /**
   * Get metadata
   */
  getMetadata(): PeerConnectionMetadata {
    return { ...this.metadata }
  }

  /**
   * Get current state
   */
  getState(): PeerConnectionState {
    return this.metadata.state
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  /**
   * Register callback for state changes
   */
  onStateChange(callback: (state: PeerConnectionState) => void): () => void {
    this.stateChangeCallbacks.add(callback)
    return () => {
      this.stateChangeCallbacks.delete(callback)
    }
  }

  /**
   * Register callback for remote stream changes
   */
  onRemoteStream(callback: (stream: MediaStream | null) => void): () => void {
    this.remoteStreamCallbacks.add(callback)
    
    // Immediately call with existing remote stream if available
    // This handles the case where stream was received before callback was registered
    if (this.remoteStream) {
      console.log(
        `[PeerConnection] Calling immediate callback for existing remote stream for ${this.metadata.remotePlayerId}`,
      )
      callback(this.remoteStream)
    }
    
    return () => {
      this.remoteStreamCallbacks.delete(callback)
    }
  }

  /**
   * Get ICE candidates (for sending via signaling)
   */
  onIceCandidate(
    callback: (candidate: RTCIceCandidateInit | null) => void,
  ): () => void {
    const handler = (event: RTCPeerConnectionIceEvent) => {
      callback(event.candidate ? event.candidate.toJSON() : null)
    }

    this.rtcPeerConnection.addEventListener('icecandidate', handler)

    return () => {
      this.rtcPeerConnection.removeEventListener('icecandidate', handler)
    }
  }

  /**
   * Close peer connection and cleanup
   */
  close(): void {
    console.log(
      `[PeerConnection] Closing connection to ${this.metadata.remotePlayerId}`,
    )

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop()
      })
      this.localStream = null
    }

    // Close peer connection
    this.rtcPeerConnection.close()

    // Update state
    this.updateState('disconnected')

    // Clear callbacks
    this.stateChangeCallbacks.clear()
    this.remoteStreamCallbacks.clear()
  }
}

