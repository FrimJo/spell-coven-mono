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
      this.updateState(appState)
    }
    
    // Also listen to connectionstatechange as a backup/additional check
    this.rtcPeerConnection.onconnectionstatechange = () => {
      const iceState = this.rtcPeerConnection.iceConnectionState
      // Update state based on ICE connection state (primary source)
      const appState = this.mapIceStateToAppState(iceState)
      this.updateState(appState)
    }

    // Handle remote stream tracks
    this.rtcPeerConnection.ontrack = (event) => {
      const stream = event.streams[0]
      if (stream) {
        this.remoteStream = stream
        this.remoteStreamCallbacks.forEach((callback) => callback(stream))
      }
    }

    // Handle ICE candidates
    this.rtcPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
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

    this.metadata.state = newState
    this.metadata.lastStateChange = Date.now()

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
  }

  /**
   * Remove local media stream from peer connection
   * This stops sending local tracks but keeps the connection alive to receive remote streams
   */
  removeLocalStream(): void {
    if (!this.localStream) {
      return
    }

    // Remove all tracks from the peer connection
    const senders = this.rtcPeerConnection.getSenders()
    senders.forEach((sender) => {
      if (sender.track && this.localStream?.getTracks().includes(sender.track)) {
        this.rtcPeerConnection.removeTrack(sender)
      }
    })

    this.localStream = null
  }

  /**
   * Create offer and set local description
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    try {
      const offer = await this.rtcPeerConnection.createOffer()
      await this.rtcPeerConnection.setLocalDescription(offer)

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

