/**
 * WebRTC Manager - Transport-agnostic WebRTC connection management
 *
 * Handles peer-to-peer WebRTC connections without coupling to any signaling transport.
 * The sendSignal callback allows this manager to work with any signaling mechanism.
 */

import type { ConnectionState, TrackState } from '@/types/connection'
import type { WebRTCSignal } from '@/types/webrtc-signal'
import { createIceConfiguration } from './ice-config'
import { handleSignal } from './signal-handlers'
import { getTrackState } from './track-utils'

export interface WebRTCManagerCallbacks {
  onRemoteStream?: (peerId: string, stream: MediaStream | null) => void
  onConnectionStateChange?: (peerId: string, state: ConnectionState) => void
  onTrackStateChange?: (peerId: string, state: TrackState) => void
  onError?: (peerId: string | null, error: Error) => void
}

interface PeerInfo {
  pc: RTCPeerConnection
  roomId: string
}

export class WebRTCManager {
  private peers = new Map<string, PeerInfo>()
  private remoteStreams = new Map<string, MediaStream>()
  private localStream: MediaStream | null = null
  private trackStatePollInterval: number | null = null

  constructor(
    private readonly localPeerId: string,
    private readonly sendSignal: (signal: WebRTCSignal) => Promise<void>,
    private readonly callbacks: WebRTCManagerCallbacks = {},
  ) {
    if (!localPeerId) {
      throw new Error('WebRTCManager: localPeerId is required')
    }
    if (!sendSignal) {
      throw new Error('WebRTCManager: sendSignal callback is required')
    }
  }

  /**
   * Set the local media stream
   */
  setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream

    // Update all existing peer connections with new stream
    for (const [peerId, peerInfo] of this.peers) {
      this.updatePeerTracks(peerInfo.pc, peerId)
    }
  }

  /**
   * Handle an incoming signal from a remote peer
   */
  async handleSignal(signal: WebRTCSignal): Promise<void> {
    const { to, from, type, roomId } = signal

    // Only process signals intended for this peer
    if (to !== this.localPeerId) {
      return
    }

    // Ignore signals from self
    if (from === this.localPeerId) {
      return
    }

    // Get or create peer connection
    let peerInfo = this.peers.get(from)
    if (!peerInfo) {
      // For offers, create a new peer connection
      if (type === 'offer') {
        const pc = this.createPeerConnection(from, roomId)
        peerInfo = { pc, roomId }
        this.peers.set(from, peerInfo)
      } else {
        // For other signals, we need an existing connection
        // Candidates can arrive before connection is ready - ignore them
        if (type === 'candidate') {
          return
        }
        throw new Error(`No peer connection found for ${from}`)
      }
    }

    try {
      // Handle offer specially - need to add tracks and send answer back
      if (type === 'offer') {
        // Add local tracks if we have a stream
        if (this.localStream) {
          this.updatePeerTracks(peerInfo.pc, from)
        }

        await handleSignal(peerInfo.pc, signal)
        // After handling offer, create and send answer
        const answer = await peerInfo.pc.createAnswer()
        await peerInfo.pc.setLocalDescription(answer)

        if (!answer.sdp) {
          throw new Error('Created answer has no SDP')
        }

        await this.sendSignal({
          type: 'answer',
          from: this.localPeerId,
          to: from,
          roomId: signal.roomId,
          payload: {
            sdp: answer.sdp,
          },
        })
      } else {
        await handleSignal(peerInfo.pc, signal)
      }
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error(`Failed to handle ${type} signal: ${String(error)}`)
      this.callbacks.onError?.(from, err)
    }
  }

  /**
   * Initiate a call to a remote peer
   */
  async callPeer(remotePeerId: string, roomId: string): Promise<void> {
    if (!this.localStream) {
      throw new Error('WebRTCManager.callPeer: local stream is required')
    }

    if (!remotePeerId) {
      throw new Error('WebRTCManager.callPeer: remotePeerId is required')
    }

    if (!roomId) {
      throw new Error('WebRTCManager.callPeer: roomId is required')
    }

    // Don't call self
    if (remotePeerId === this.localPeerId) {
      return
    }

    // Check if already connected
    if (this.peers.has(remotePeerId)) {
      return
    }

    const pc = this.createPeerConnection(remotePeerId, roomId)
    this.peers.set(remotePeerId, { pc, roomId })

    // Add local tracks
    this.updatePeerTracks(pc, remotePeerId)

    // Create and send offer
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      if (!offer.sdp) {
        throw new Error('Created offer has no SDP')
      }

      await this.sendSignal({
        type: 'offer',
        from: this.localPeerId,
        to: remotePeerId,
        roomId,
        payload: {
          sdp: offer.sdp,
        },
      })

      this.callbacks.onConnectionStateChange?.(remotePeerId, 'connecting')
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error(`Failed to create offer: ${String(error)}`)
      this.callbacks.onError?.(remotePeerId, err)
      this.callbacks.onConnectionStateChange?.(remotePeerId, 'failed')
      this.peers.delete(remotePeerId)
      pc.close()
    }
  }

  /**
   * Create a new RTCPeerConnection
   */
  private createPeerConnection(
    remotePeerId: string,
    roomId: string,
  ): RTCPeerConnection {
    const pc = new RTCPeerConnection(createIceConfiguration())

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'candidate',
          from: this.localPeerId,
          to: remotePeerId,
          roomId,
          payload: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment,
          },
        }).catch((err) => {
          console.error(`Failed to send ICE candidate to ${remotePeerId}:`, err)
        })
      }
    }

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      let connectionState: ConnectionState

      switch (state) {
        case 'connecting':
        case 'checking':
          connectionState = 'connecting'
          break
        case 'connected':
          connectionState = 'connected'
          break
        case 'disconnected':
          connectionState = 'disconnected'
          break
        case 'failed':
          connectionState = 'failed'
          break
        case 'closed':
          connectionState = 'disconnected'
          break
        default:
          connectionState = 'connecting'
      }

      this.callbacks.onConnectionStateChange?.(remotePeerId, connectionState)
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0]
      if (stream) {
        this.remoteStreams.set(remotePeerId, stream)
        this.callbacks.onRemoteStream?.(remotePeerId, stream)
        this.updateTrackState(remotePeerId, stream)
        this.startTrackStatePolling()
      }
    }

    // Handle errors
    pc.onerror = (event) => {
      const error = new Error(`RTCPeerConnection error: ${String(event)}`)
      this.callbacks.onError?.(remotePeerId, error)
    }

    return pc
  }

  /**
   * Update peer connection tracks with local stream
   */
  private updatePeerTracks(
    pc: RTCPeerConnection,
    peerId: string,
  ): void {
    if (!this.localStream) {
      return
    }

    const senders = pc.getSenders()

    // Update video track
    const videoTrack = this.localStream.getVideoTracks()[0]
    const videoSender = senders.find((s) => s.track?.kind === 'video')
    if (videoSender && videoTrack) {
      videoSender.replaceTrack(videoTrack).catch((err) => {
        console.error(`Failed to replace video track for ${peerId}:`, err)
      })
    } else if (videoTrack && !videoSender) {
      pc.addTrack(videoTrack, this.localStream)
    }

    // Update audio track
    const audioTrack = this.localStream.getAudioTracks()[0]
    const audioSender = senders.find((s) => s.track?.kind === 'audio')
    if (audioSender && audioTrack) {
      audioSender.replaceTrack(audioTrack).catch((err) => {
        console.error(`Failed to replace audio track for ${peerId}:`, err)
      })
    } else if (audioTrack && !audioSender) {
      pc.addTrack(audioTrack, this.localStream)
    }
  }

  /**
   * Update track state for a peer
   */
  private updateTrackState(peerId: string, stream: MediaStream): void {
    const state = getTrackState(stream)
    this.callbacks.onTrackStateChange?.(peerId, state)
  }

  /**
   * Start polling for track state changes
   */
  private startTrackStatePolling(): void {
    if (this.trackStatePollInterval !== null) {
      return
    }

    this.trackStatePollInterval = window.setInterval(() => {
      for (const [peerId, stream] of this.remoteStreams) {
        this.updateTrackState(peerId, stream)
      }
    }, 500)
  }

  /**
   * Stop polling for track state changes
   */
  private stopTrackStatePolling(): void {
    if (this.trackStatePollInterval !== null) {
      clearInterval(this.trackStatePollInterval)
      this.trackStatePollInterval = null
    }
  }

  /**
   * Get remote streams
   */
  getRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams)
  }

  /**
   * Close connection to a peer
   */
  closePeer(peerId: string): void {
    const peerInfo = this.peers.get(peerId)
    if (peerInfo) {
      peerInfo.pc.close()
      this.peers.delete(peerId)
      this.remoteStreams.delete(peerId)
    }
  }

  /**
   * Destroy the manager and clean up all connections
   */
  destroy(): void {
    this.stopTrackStatePolling()

    for (const [peerId, pc] of this.peers) {
      pc.close()
    }

    this.peers.clear()
    this.remoteStreams.clear()
    this.localStream = null
  }
}

