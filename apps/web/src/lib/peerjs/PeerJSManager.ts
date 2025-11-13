/**
 * PeerJSManager - Core PeerJS connection management
 * 
 * Handles all PeerJS logic outside of React. This class manages:
 * - Peer instance lifecycle
 * - Local media stream management
 * - Outgoing and incoming calls
 * - Connection state tracking
 * - Error handling and retry logic
 */

import type {
  ConnectionState,
  LocalMediaStream,
  PeerJSError,
  PeerTrackState,
} from '@/types/peerjs'
import type { MediaConnection } from 'peerjs'
import Peer from 'peerjs'
import { env } from '@/env'
import { createPeerJSError, logError } from './errors'
import { DEFAULT_RETRY_CONFIG, retryWithBackoff } from './retry'
import {
  DEFAULT_TIMEOUT_CONFIG,
  executeWithTimeout,
} from './timeout'

export interface PeerJSManagerCallbacks {
  onLocalStreamChanged?: (stream: MediaStream | null) => void
  onRemoteStreamAdded?: (peerId: string, stream: MediaStream) => void
  onRemoteStreamRemoved?: (peerId: string) => void
  onConnectionStateChanged?: (peerId: string, state: ConnectionState) => void
  onTrackStateChanged?: (peerId: string, state: PeerTrackState) => void
  onError?: (error: PeerJSError) => void
}

export class PeerJSManager {
  private peer: Peer | null = null
  private localStream: LocalMediaStream | null = null
  private calls = new Map<string, MediaConnection>()
  private calledPeers = new Set<string>()
  private pendingIncomingCalls = new Map<string, MediaConnection>()
  private remoteStreams = new Map<string, MediaStream>()
  private trackStatePollInterval: number | null = null
  private trackStates = new Map<string, PeerTrackState>()
  private currentRemotePlayerIds: string[] = []
  private initializePromise: Promise<void> | null = null
  private isInitialized = false
  private isDestroyed = false
  private wasSuccessfullyConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout: NodeJS.Timeout | null = null
  private initializationErrorLogged = false
  private isRetryingId = false
  private idRetryTimeout: NodeJS.Timeout | null = null

  constructor(
    private localPlayerId: string,
    private callbacks: PeerJSManagerCallbacks = {},
  ) {}

  /**
   * Initialize Peer instance
   */
  async initialize(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Manager has been destroyed')
    }

    // Return existing promise if initialization is in progress
    if (this.initializePromise) {
      return this.initializePromise
    }

    if (this.isInitialized && this.peer) {
      return // Already initialized
    }

    // Don't retry if we've already logged an initialization error
    // This prevents spam when the server is not available
    if (this.initializationErrorLogged && !this.isInitialized) {
      throw new Error(
        'Peer initialization previously failed. The PeerJS server may not be running. ' +
        'Please ensure the server is started with: cd apps/peerjs-server && bun run dev'
      )
    }

    this.initializePromise = this.doInitialize()
    return this.initializePromise
  }

  /**
   * Internal initialization logic
   */
  private async doInitialize(): Promise<void> {
    const peerConfig = {
      host: env.VITE_PEERJS_HOST,
      port: parseInt(env.VITE_PEERJS_PORT, 10),
      path: env.VITE_PEERJS_PATH,
      secure: env.VITE_PEERJS_SSL, // Use wss:// (secure WebSocket) or ws:// based on config
    }

    const protocol = peerConfig.secure ? 'wss' : 'ws'
    console.log(
      `[PeerJSManager] Connecting to PeerJS server at ${protocol}://${peerConfig.host}:${peerConfig.port}${peerConfig.path}`,
    )

    this.peer = new Peer(this.localPlayerId, peerConfig)

    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout | null = null
      let resolved = false

      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
      }

      const cleanupPeer = () => {
        if (this.peer && !this.wasSuccessfullyConnected) {
          try {
            this.peer.destroy()
          } catch (err) {
            // Ignore errors during cleanup
          }
          this.peer = null
        }
      }

      const resolveOnce = () => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve()
        }
      }

      const rejectOnce = (error: Error) => {
        if (!resolved) {
          resolved = true
          cleanup()
          cleanupPeer()
          this.initializePromise = null
          reject(error)
        }
      }

      timeout = setTimeout(() => {
        const protocol = peerConfig.secure ? 'wss' : 'ws'
        const serverUrl = `${protocol}://${peerConfig.host}:${peerConfig.port}${peerConfig.path}`
        const error = new Error(
          `Peer initialization timeout. The PeerJS server at ${serverUrl} may not be running. ` +
          'Please ensure the PeerJS server is started with: cd apps/peerjs-server && bun run dev'
        )
        
        // Only log the error once to avoid spam
        if (!this.initializationErrorLogged) {
          console.error('[PeerJSManager] Peer initialization failed:', error.message)
          console.error('[PeerJSManager] To start the PeerJS server, run: cd apps/peerjs-server && bun run dev')
          this.initializationErrorLogged = true
        }
        
        rejectOnce(error)
      }, 10000)

      const handleOpen = (id: string) => {
        console.log('[PeerJSManager] Peer opened:', id)
        this.wasSuccessfullyConnected = true
        this.isInitialized = true
        
        // Reset reconnect attempts on successful connection
        if (this.reconnectAttempts > 0) {
          console.log('[PeerJSManager] Reconnected successfully, resetting reconnect attempts')
          this.reconnectAttempts = 0
        }
        
        // Only resolve the promise if this is the initial connection
        if (!resolved) {
          this.initializePromise = null
          resolveOnce()
        }
      }
      
      this.peer!.on('open', handleOpen)

      this.peer!.on('error', (err) => {
        const peerError = createPeerJSError(err)

        // Handle ID taken error with retry
        if (peerError.type === 'unavailable-id') {
          console.log('[PeerJSManager] ID taken, retrying...')
          cleanupPeer()
          this.initializePromise = null
          // Reset wasSuccessfullyConnected for retry attempt
          this.wasSuccessfullyConnected = false
          this.isRetryingId = true
          
          // Cancel any existing retry timeout
          if (this.idRetryTimeout) {
            clearTimeout(this.idRetryTimeout)
            this.idRetryTimeout = null
          }
          
          this.idRetryTimeout = setTimeout(() => {
            this.idRetryTimeout = null
            // Only retry if not destroyed
            if (!this.isDestroyed) {
              this.doInitialize()
                .then(() => {
                  this.isRetryingId = false
                  resolveOnce()
                })
                .catch((retryError) => {
                  this.isRetryingId = false
                  rejectOnce(retryError)
                })
            } else {
              // Manager was destroyed, don't reject - just clean up
              this.isRetryingId = false
            }
          }, 2000)
          return
        }

        // Only log network/socket errors once to avoid spam
        if (!this.initializationErrorLogged && 
            (peerError.type === 'network' || peerError.type === 'socket-error' || peerError.type === 'socket-closed')) {
          console.error('[PeerJSManager] Peer initialization failed:', peerError.message)
          console.error('[PeerJSManager] To start the PeerJS server, run: cd apps/peerjs-server && bun run dev')
          this.initializationErrorLogged = true
        } else if (peerError.type !== 'network' && peerError.type !== 'socket-error' && peerError.type !== 'socket-closed') {
          // Log other errors normally
          logError(peerError, { context: 'peer initialization' })
        }
        
        this.callbacks.onError?.(peerError)
        rejectOnce(peerError)
      })

      this.peer!.on('call', (call: MediaConnection) => {
        this.handleIncomingCall(call)
      })

      // Handle disconnection from server
      // Only reconnect if we were previously successfully connected
      this.peer!.on('disconnected', () => {
        // Don't log disconnect messages during ID retry attempts
        if (this.isRetryingId) {
          return
        }
        
        if (!this.wasSuccessfullyConnected) {
          // Never successfully connected, don't try to reconnect
          console.log('[PeerJSManager] Disconnected before successful connection, not reconnecting')
          return
        }
        
        // Check if we've exceeded max reconnection attempts
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log('[PeerJSManager] Max reconnection attempts reached, giving up')
          const error = new Error('Max reconnection attempts reached')
          const peerError = createPeerJSError(error)
          this.callbacks.onError?.(peerError)
          return
        }
        
        this.reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000) // Exponential backoff, max 10s
        console.log(`[PeerJSManager] Disconnected from PeerServer, attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`)
        
        // Clear any existing reconnect timeout
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout)
        }
        
        // Attempt reconnection after exponential backoff delay
        if (!this.isDestroyed && this.peer && !this.peer.destroyed) {
          this.reconnectTimeout = setTimeout(() => {
            if (this.peer && !this.peer.destroyed && !this.isDestroyed) {
              this.peer.reconnect()
            }
            this.reconnectTimeout = null
          }, delay)
        }
      })
    })
  }

  /**
   * Initialize local media stream
   */
  async initializeLocalMedia(deviceId?: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Manager has been destroyed')
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? {
              deviceId: { exact: deviceId },
              width: { ideal: 3840 },
              height: { ideal: 2160 },
            }
          : {
              width: { ideal: 3840 },
              height: { ideal: 2160 },
            },
        audio: true,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const videoTrack = stream.getVideoTracks()[0] || null
      const audioTrack = stream.getAudioTracks()[0] || null

      this.localStream = {
        stream,
        videoTrack,
        audioTrack,
      }

      this.callbacks.onLocalStreamChanged?.(stream)

      // Answer any pending incoming calls
      this.answerPendingCalls(stream)

      // Automatically connect to current remote peers
      if (this.currentRemotePlayerIds.length > 0) {
        this.connectToPeers(this.currentRemotePlayerIds).catch((err) => {
          console.error('[PeerJSManager] Failed to connect to peers after stream init:', err)
        })
      }
    } catch (err) {
      const peerError = createPeerJSError(err)
      logError(peerError, { context: 'initializeLocalMedia' })
      this.callbacks.onError?.(peerError)
      throw peerError
    }
  }

  /**
   * Answer pending incoming calls with local stream
   */
  private answerPendingCalls(stream: MediaStream): void {
    for (const [peerId, call] of this.pendingIncomingCalls) {
      console.log('[PeerJSManager] Answering pending call from:', peerId)
      call.answer(stream)
      this.setupCallHandlers(call, peerId)
      this.calls.set(peerId, call)
    }
    this.pendingIncomingCalls.clear()
  }

  /**
   * Handle incoming call
   */
  private handleIncomingCall(call: MediaConnection): void {
    const peerId = call.peer
    console.log('[PeerJSManager] Incoming call from:', peerId)
    console.log('[PeerJSManager] Call metadata:', call.metadata)

    if (!this.localStream?.stream) {
      console.log('[PeerJSManager] No local stream, deferring call from:', peerId)
      this.pendingIncomingCalls.set(peerId, call)
      this.callbacks.onConnectionStateChanged?.(peerId, 'connecting')
      return
    }

    console.log('[PeerJSManager] Answering incoming call from:', peerId)
    call.answer(this.localStream.stream)
    this.setupCallHandlers(call, peerId)
    this.calls.set(peerId, call)
  }

  /**
   * Setup event handlers for a call
   */
  private setupCallHandlers(call: MediaConnection, peerId: string): void {
    const trackEndHandlers = new Map<string, () => void>()

    call.on('stream', (remoteStream: MediaStream) => {
      console.log('[PeerJSManager] Received remote stream from:', peerId)
      console.log('[PeerJSManager] Call metadata:', call.metadata)
      console.log('[PeerJSManager] Call open:', call.open)
      
      this.remoteStreams.set(peerId, remoteStream)
      this.callbacks.onRemoteStreamAdded?.(peerId, remoteStream)
      this.callbacks.onConnectionStateChanged?.(peerId, 'connected')

      // Initial track state
      this.updateTrackState(peerId, remoteStream)

      // Monitor track ended events
      const videoTrack = remoteStream.getVideoTracks()[0]
      const audioTrack = remoteStream.getAudioTracks()[0]

      const onVideoEnded = () => {
        this.updateTrackState(peerId, remoteStream)
      }
      const onAudioEnded = () => {
        this.updateTrackState(peerId, remoteStream)
      }

      videoTrack?.addEventListener('ended', onVideoEnded)
      audioTrack?.addEventListener('ended', onAudioEnded)

      // Store handlers for cleanup
      if (videoTrack) {
        trackEndHandlers.set(`${peerId}-video`, onVideoEnded)
      }
      if (audioTrack) {
        trackEndHandlers.set(`${peerId}-audio`, onAudioEnded)
      }

      // Start polling for track enabled state changes if not already started
      this.startTrackStatePolling()
    })

    call.on('error', (err) => {
      const peerError = createPeerJSError(err)
      logError(peerError, { context: 'call', peerId })
      this.callbacks.onConnectionStateChanged?.(peerId, 'failed')
      this.callbacks.onError?.(peerError)
    })

    call.on('close', () => {
      console.log('[PeerJSManager] Call closed with:', peerId)
      
      // Clean up track event listeners
      const stream = this.remoteStreams.get(peerId)
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0]
        const audioTrack = stream.getAudioTracks()[0]
        const onVideoEnded = trackEndHandlers.get(`${peerId}-video`)
        const onAudioEnded = trackEndHandlers.get(`${peerId}-audio`)
        
        if (videoTrack && onVideoEnded) {
          videoTrack.removeEventListener('ended', onVideoEnded)
        }
        if (audioTrack && onAudioEnded) {
          audioTrack.removeEventListener('ended', onAudioEnded)
        }
      }
      
      trackEndHandlers.clear()
      this.calls.delete(peerId)
      this.calledPeers.delete(peerId)
      this.remoteStreams.delete(peerId)
      this.trackStates.delete(peerId)
      this.callbacks.onRemoteStreamRemoved?.(peerId)
      this.callbacks.onConnectionStateChanged?.(peerId, 'disconnected')
      
      // Stop polling if no more remote streams
      if (this.remoteStreams.size === 0) {
        this.stopTrackStatePolling()
      }
    })
  }

  /**
   * Update track state for a peer
   */
  private updateTrackState(peerId: string, stream: MediaStream): void {
    const videoTrack = stream.getVideoTracks()[0]
    const audioTrack = stream.getAudioTracks()[0]
    
    const newState: PeerTrackState = {
      videoEnabled: videoTrack?.enabled ?? false,
      audioEnabled: audioTrack?.enabled ?? false,
    }

    // Only notify if state actually changed
    const currentState = this.trackStates.get(peerId)
    if (
      !currentState ||
      currentState.videoEnabled !== newState.videoEnabled ||
      currentState.audioEnabled !== newState.audioEnabled
    ) {
      this.trackStates.set(peerId, newState)
      this.callbacks.onTrackStateChanged?.(peerId, newState)
    }
  }

  /**
   * Start polling for track enabled state changes
   */
  private startTrackStatePolling(): void {
    if (this.trackStatePollInterval !== null) {
      return // Already polling
    }

    // Poll every 500ms to detect enabled/disabled state changes
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
   * Connect to remote peers
   */
  async connectToPeers(remotePlayerIds: string[]): Promise<void> {
    if (!this.isInitialized || !this.peer) {
      throw new Error('Peer not initialized')
    }

    // Store current remote player IDs for later connection when stream is ready
    this.currentRemotePlayerIds = remotePlayerIds

    if (!this.localStream?.stream) {
      console.log('[PeerJSManager] No local stream, will connect when stream is ready')
      return
    }

    // Create calls for new peers in parallel
    const connectionPromises = remotePlayerIds
      .filter((remotePlayerId) => !this.calls.has(remotePlayerId) && !this.calledPeers.has(remotePlayerId))
      .map((remotePlayerId) => this.createOutgoingCall(remotePlayerId))

    // Wait for all connections, but don't fail if one fails
    await Promise.allSettled(connectionPromises)

    // Close calls for removed peers
    for (const [peerId] of this.calls) {
      if (!remotePlayerIds.includes(peerId)) {
        this.calls.get(peerId)?.close()
      }
    }
  }

  /**
   * Create outgoing call to a remote peer
   */
  private async createOutgoingCall(remotePlayerId: string): Promise<void> {
    if (!this.peer || !this.localStream?.stream) {
      return
    }

    // Check if already called or connected
    if (this.calledPeers.has(remotePlayerId) || this.calls.has(remotePlayerId)) {
      return
    }

    try {
      console.log('[PeerJSManager] Creating outgoing call to:', remotePlayerId)
      this.callbacks.onConnectionStateChanged?.(remotePlayerId, 'connecting')
      this.calledPeers.add(remotePlayerId)

      const call = await executeWithTimeout(
        async () => {
          return await retryWithBackoff(
            () =>
              Promise.resolve(
                this.peer!.call(remotePlayerId, this.localStream!.stream, {
                  metadata: {
                    callerId: this.localPlayerId,
                    timestamp: Date.now(),
                  },
                }),
              ),
            DEFAULT_RETRY_CONFIG,
          )
        },
        DEFAULT_TIMEOUT_CONFIG.connectionTimeoutMs,
        `Connection timeout to ${remotePlayerId}`,
      )

      this.setupCallHandlers(call, remotePlayerId)
      this.calls.set(remotePlayerId, call)
    } catch (err) {
      const peerError = createPeerJSError(err)
      logError(peerError, { context: 'createOutgoingCall', peerId: remotePlayerId })
      this.callbacks.onConnectionStateChanged?.(remotePlayerId, 'failed')
      this.callbacks.onError?.(peerError)
      this.calledPeers.delete(remotePlayerId)
    }
  }

  /**
   * Toggle video track
   */
  toggleVideo(enabled: boolean): void {
    if (!this.localStream?.videoTrack) {
      return
    }

    this.localStream.videoTrack.enabled = enabled
    console.log('[PeerJSManager] Video toggled:', enabled)

    // Notify about local track state change
    this.callbacks.onTrackStateChanged?.(this.localPlayerId, {
      videoEnabled: enabled,
      audioEnabled: this.localStream.audioTrack?.enabled ?? false,
    })
  }

  /**
   * Toggle audio track
   */
  toggleAudio(enabled: boolean): void {
    if (!this.localStream?.audioTrack) {
      return
    }

    this.localStream.audioTrack.enabled = enabled
    console.log('[PeerJSManager] Audio toggled:', enabled)

    // Notify about local track state change
    this.callbacks.onTrackStateChanged?.(this.localPlayerId, {
      videoEnabled: this.localStream.videoTrack?.enabled ?? false,
      audioEnabled: enabled,
    })
  }

  /**
   * Switch camera device
   */
  async switchCamera(deviceId: string): Promise<void> {
    if (!this.localStream?.stream || !this.localStream.videoTrack) {
      throw new Error('No video track available')
    }

    try {
      // Stop old track
      this.localStream.videoTrack.stop()

      // Get new stream
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
        audio: false,
      })

      const newVideoTrack = newStream.getVideoTracks()[0]
      if (!newVideoTrack) {
        throw new Error('No video track in new stream')
      }

      // Update local stream
      this.localStream.stream.removeTrack(this.localStream.videoTrack)
      this.localStream.stream.addTrack(newVideoTrack)
      this.localStream.videoTrack = newVideoTrack

      // Replace track in all active calls
      for (const [peerId, call] of this.calls) {
        // Only replace track if call is open
        if (!call.open) {
          console.log('[PeerJSManager] Call not open, skipping track replacement for:', peerId)
          continue
        }
        
        const sender = call.peerConnection
          ?.getSenders()
          .find((s) => s.track?.kind === 'video')
        if (sender) {
          await sender.replaceTrack(newVideoTrack)
          console.log('[PeerJSManager] Video track replaced for:', peerId)
        }
      }

      // Notify about stream change
      this.callbacks.onLocalStreamChanged?.(this.localStream.stream)
    } catch (err) {
      const peerError = createPeerJSError(err)
      logError(peerError, { context: 'switchCamera' })
      this.callbacks.onError?.(peerError)
      throw peerError
    }
  }

  /**
   * Get current local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream?.stream ?? null
  }

  /**
   * Check if initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    if (this.isDestroyed) {
      return
    }

    this.isDestroyed = true

    // Close all calls
    for (const call of this.calls.values()) {
      call.close()
    }
    this.calls.clear()

    // Close pending calls
    for (const call of this.pendingIncomingCalls.values()) {
      call.close()
    }
    this.pendingIncomingCalls.clear()

    // Stop track state polling
    this.stopTrackStatePolling()

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    // Clear ID retry timeout
    if (this.idRetryTimeout) {
      clearTimeout(this.idRetryTimeout)
      this.idRetryTimeout = null
    }

    // Stop local stream tracks
    if (this.localStream?.stream) {
      this.localStream.stream.getTracks().forEach((track) => track.stop())
    }
    this.localStream = null

    // Destroy peer
    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }

    // Clear state
    this.calledPeers.clear()
    this.remoteStreams.clear()
    this.trackStates.clear()
    this.currentRemotePlayerIds = []
    this.initializePromise = null
    this.isInitialized = false
    this.wasSuccessfullyConnected = false
    this.reconnectAttempts = 0
    this.initializationErrorLogged = false
    this.isRetryingId = false
    this.idRetryTimeout = null
  }
}

