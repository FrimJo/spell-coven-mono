/**
 * WebRTC Manager - Transport-agnostic WebRTC connection management
 *
 * Handles peer-to-peer WebRTC connections without coupling to any signaling transport.
 * The sendSignal callback allows this manager to work with any signaling mechanism.
 */

import type { ConnectionState, TrackState } from '@/types/connection'
import type { CandidateSignal, WebRTCSignal } from '@/types/webrtc-signal'

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
  private localStreamGeneration = 0
  private trackStatePollInterval: number | null = null
  private pendingCandidates = new Map<string, CandidateSignal[]>()

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
   * Set the local media stream.
   * Increments a generation counter so that concurrent replaceTrack calls
   * from a previous stream are superseded by the latest one.
   */
  setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream
    this.localStreamGeneration++

    for (const [peerId, peerInfo] of this.peers) {
      this.updatePeerTracks(peerInfo.pc, peerId)
    }
  }

  /**
   * Check if local stream is set
   */
  hasLocalStream(): boolean {
    return this.localStream !== null
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

    // On a new offer from an already-known peer (e.g. after page reload /
    // rejoin), tear down the stale connection and create a fresh one.
    if (peerInfo && type === 'offer') {
      console.debug(
        `[WebRTC] Received new offer from known peer ${from} (state: ${peerInfo.pc.connectionState}). Replacing stale connection.`,
      )
      peerInfo.pc.close()
      this.peers.delete(from)
      this.remoteStreams.delete(from)
      this.pendingCandidates.delete(from)
      peerInfo = undefined
    }

    if (!peerInfo) {
      if (type === 'offer') {
        const pc = this.createPeerConnection(from, roomId)
        peerInfo = { pc, roomId }
        this.peers.set(from, peerInfo)
      } else {
        if (type === 'candidate') {
          this.queueCandidate(from, signal)
          return
        }
        throw new Error(`No peer connection found for ${from}`)
      }
    }

    try {
      // Handle offer specially - need to add tracks and send answer back
      if (type === 'offer') {
        console.debug(`[WebRTC] Processing offer from ${from}`)

        // Add local tracks if we have a stream
        if (this.localStream) {
          this.updatePeerTracks(peerInfo.pc, from)
        }

        await handleSignal(peerInfo.pc, signal)
        console.debug(
          `[WebRTC] Offer processed, flushing pending candidates for ${from}`,
        )
        this.flushPendingCandidates(from)
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
        if (type === 'candidate' && !peerInfo.pc.remoteDescription) {
          console.debug(
            `[WebRTC] Peer ${from} exists but remote description not set yet, queuing candidate`,
          )
          this.queueCandidate(from, signal)
          return
        }

        await handleSignal(peerInfo.pc, signal)

        if (type === 'answer') {
          console.debug(
            `[WebRTC] Answer received from ${from}, flushing pending candidates`,
          )
          this.flushPendingCandidates(from)
        } else if (type === 'candidate') {
          console.debug(`[WebRTC] ICE candidate from ${from} added directly`)
        }
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

    console.debug(
      `[WebRTC] Initiating call to ${remotePeerId} in room ${roomId}`,
    )

    const pc = this.createPeerConnection(remotePeerId, roomId)
    this.peers.set(remotePeerId, { pc, roomId })

    // Add local tracks
    this.updatePeerTracks(pc, remotePeerId)

    // Create and send offer
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      console.debug(`[WebRTC] Created and sending offer to ${remotePeerId}`)

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

      console.debug(
        `[WebRTC] Connection state changed for ${remotePeerId}: ${state} -> ${connectionState}`,
      )
      this.callbacks.onConnectionStateChange?.(remotePeerId, connectionState)
    }

    // Log ICE connection state for debugging
    pc.oniceconnectionstatechange = () => {
      console.debug(
        `[WebRTC] ICE connection state for ${remotePeerId}: ${pc.iceConnectionState}`,
      )
    }

    // Log ICE gathering state for debugging
    pc.onicegatheringstatechange = () => {
      console.debug(
        `[WebRTC] ICE gathering state for ${remotePeerId}: ${pc.iceGatheringState}`,
      )
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0]
      if (stream) {
        console.debug(
          `[WebRTC] Received remote track from ${remotePeerId}: ${event.track.kind} (${event.track.id})`,
        )
        this.remoteStreams.set(remotePeerId, stream)
        this.callbacks.onRemoteStream?.(remotePeerId, stream)
        this.updateTrackState(remotePeerId, stream)
        this.startTrackStatePolling()

        // Listen for mute/unmute/ended on video track for immediate Camera Off feedback
        if (event.track.kind === 'video') {
          const onVideoTrackStateChange = () => {
            this.updateTrackState(remotePeerId, stream)
          }
          event.track.addEventListener('mute', onVideoTrackStateChange)
          event.track.addEventListener('unmute', onVideoTrackStateChange)
          event.track.addEventListener('ended', onVideoTrackStateChange)
        }
      }
    }

    // Handle errors via connectionstatechange (onerror is deprecated)
    // Errors will be caught through connectionstatechange -> 'failed' state

    return pc
  }

  /**
   * Find the sender for a given media kind using transceivers.
   * Unlike `getSenders().find(s => s.track?.kind)`, this works even after
   * `replaceTrack(null)` has set `sender.track` to null.
   */
  private findSenderByKind(
    pc: RTCPeerConnection,
    kind: 'video' | 'audio',
  ): RTCRtpSender | undefined {
    for (const transceiver of pc.getTransceivers()) {
      if (transceiver.receiver.track.kind === kind) {
        return transceiver.sender
      }
    }
    return undefined
  }

  /**
   * Update peer connection tracks with local stream.
   * Uses a generation counter so that if setLocalStream is called rapidly,
   * only the most recent stream's replaceTrack calls take effect.
   */
  private updatePeerTracks(pc: RTCPeerConnection, peerId: string): void {
    const stream = this.localStream
    const gen = this.localStreamGeneration

    const videoTrack = stream?.getVideoTracks()[0] ?? null
    const audioTrack = stream?.getAudioTracks()[0] ?? null

    const videoSender = this.findSenderByKind(pc, 'video')
    const audioSender = this.findSenderByKind(pc, 'audio')

    if (videoSender) {
      videoSender.replaceTrack(videoTrack).catch((err) => {
        if (this.localStreamGeneration !== gen) return
        console.error(`Failed to replace video track for ${peerId}:`, err)
      })
    } else if (videoTrack && stream) {
      pc.addTrack(videoTrack, stream)
    }

    if (audioSender) {
      audioSender.replaceTrack(audioTrack).catch((err) => {
        if (this.localStreamGeneration !== gen) return
        console.error(`Failed to replace audio track for ${peerId}:`, err)
      })
    } else if (audioTrack && stream) {
      pc.addTrack(audioTrack, stream)
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

    for (const [_peerId, peerInfo] of this.peers) {
      peerInfo.pc.close()
    }

    this.peers.clear()
    this.remoteStreams.clear()
    this.localStream = null
    this.pendingCandidates.clear()
  }

  private queueCandidate(peerId: string, signal: CandidateSignal): void {
    const existing = this.pendingCandidates.get(peerId) ?? []
    const newQueue = [...existing, signal]
    this.pendingCandidates.set(peerId, newQueue)
    console.debug(
      `[WebRTC] Queued ICE candidate for ${peerId} (${newQueue.length} pending, no remote description yet)`,
    )
  }

  private flushPendingCandidates(peerId: string): void {
    const candidateSignals = this.pendingCandidates.get(peerId)
    if (!candidateSignals?.length) {
      return
    }

    const peerInfo = this.peers.get(peerId)
    if (!peerInfo?.pc || !peerInfo.pc.remoteDescription) {
      console.warn(
        `[WebRTC] Cannot flush ${candidateSignals.length} candidates for ${peerId}: peer not ready`,
      )
      return
    }

    console.debug(
      `[WebRTC] Flushing ${candidateSignals.length} queued ICE candidates for ${peerId}`,
    )

    for (const candidateSignal of candidateSignals) {
      handleSignal(peerInfo.pc, candidateSignal)
        .then(() => {
          console.debug(
            `[WebRTC] Successfully added queued ICE candidate for ${peerId}`,
          )
        })
        .catch((err) => {
          console.error(
            `[WebRTC] Failed to process queued candidate for ${peerId}:`,
            err,
          )
          this.callbacks.onError?.(
            peerId,
            err instanceof Error ? err : new Error(String(err)),
          )
        })
    }

    this.pendingCandidates.delete(peerId)
  }
}
