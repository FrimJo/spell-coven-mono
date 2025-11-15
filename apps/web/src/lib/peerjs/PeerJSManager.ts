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
import { env } from '@/env'
import Peer from 'peerjs'

import { createPeerJSError, logError } from './errors'
import { DEFAULT_RETRY_CONFIG, retryWithBackoff } from './retry'
import { DEFAULT_TIMEOUT_CONFIG, executeWithTimeout } from './timeout'

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
  private lastVideoDeviceId: string | undefined = undefined

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
          'Please ensure the server is started with: cd apps/peerjs-server && bun run dev',
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
          } catch (_err) {
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
            'Please ensure the PeerJS server is started with: cd apps/peerjs-server && bun run dev',
        )

        // Only log the error once to avoid spam
        if (!this.initializationErrorLogged) {
          console.error(
            '[PeerJSManager] Peer initialization failed:',
            error.message,
          )
          console.error(
            '[PeerJSManager] To start the PeerJS server, run: cd apps/peerjs-server && bun run dev',
          )
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
          console.log(
            '[PeerJSManager] Reconnected successfully, resetting reconnect attempts',
          )
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
        if (
          !this.initializationErrorLogged &&
          (peerError.type === 'network' ||
            peerError.type === 'socket-error' ||
            peerError.type === 'socket-closed')
        ) {
          console.error(
            '[PeerJSManager] Peer initialization failed:',
            peerError.message,
          )
          console.error(
            '[PeerJSManager] To start the PeerJS server, run: cd apps/peerjs-server && bun run dev',
          )
          this.initializationErrorLogged = true
        } else if (
          peerError.type !== 'network' &&
          peerError.type !== 'socket-error' &&
          peerError.type !== 'socket-closed'
        ) {
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
          console.log(
            '[PeerJSManager] Disconnected before successful connection, not reconnecting',
          )
          return
        }

        // Check if we've exceeded max reconnection attempts
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log(
            '[PeerJSManager] Max reconnection attempts reached, giving up',
          )
          const error = new Error('Max reconnection attempts reached')
          const peerError = createPeerJSError(error)
          this.callbacks.onError?.(peerError)
          return
        }

        this.reconnectAttempts++
        const delay = Math.min(
          1000 * Math.pow(2, this.reconnectAttempts - 1),
          10000,
        ) // Exponential backoff, max 10s
        console.log(
          `[PeerJSManager] Disconnected from PeerServer, attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`,
        )

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
      // Try with ideal 4K resolution first
      let constraints: MediaStreamConstraints = {
        video: deviceId
          ? {
              deviceId: { ideal: deviceId }, // Use ideal instead of exact
              width: { ideal: 3840 },
              height: { ideal: 2160 },
            }
          : {
              width: { ideal: 3840 },
              height: { ideal: 2160 },
            },
        audio: true,
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err) {
        // If 4K fails, try with 1080p
        console.warn('[PeerJSManager] 4K failed, falling back to 1080p:', err)
        constraints = {
          video: deviceId
            ? {
                deviceId: { ideal: deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              }
            : {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
          audio: true,
        }
        
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch (err2) {
          // If 1080p fails, try with basic constraints
          console.warn('[PeerJSManager] 1080p failed, using basic constraints:', err2)
          constraints = {
            video: deviceId ? { deviceId: { ideal: deviceId } } : true,
            audio: true,
          }
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        }
      }
      const videoTrack = stream.getVideoTracks()[0] || null
      const audioTrack = stream.getAudioTracks()[0] || null

      // Store the device ID for later reinitialization
      if (videoTrack) {
        const settings = videoTrack.getSettings()
        this.lastVideoDeviceId = settings.deviceId || deviceId
      }

      this.localStream = {
        stream,
        videoTrack,
        audioTrack,
      }

      console.log('[PeerJSManager] Local stream initialized:', {
        hasVideo: !!videoTrack,
        hasAudio: !!audioTrack,
        videoDeviceId: deviceId,
      })

      this.callbacks.onLocalStreamChanged?.(stream)

      // Notify about initial local track state
      this.callbacks.onTrackStateChanged?.(this.localPlayerId, {
        videoEnabled: !!videoTrack && videoTrack.readyState === 'live',
        audioEnabled: !!audioTrack && audioTrack.enabled,
      })

      // Answer any pending incoming calls
      this.answerPendingCalls(stream)

      // Automatically connect to current remote peers
      if (this.currentRemotePlayerIds.length > 0) {
        this.connectToPeers(this.currentRemotePlayerIds).catch((err) => {
          console.error(
            '[PeerJSManager] Failed to connect to peers after stream init:',
            err,
          )
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
      console.log(
        '[PeerJSManager] No local stream, deferring call from:',
        peerId,
      )
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
    call.on('stream', (remoteStream: MediaStream) => {
      console.log('[PeerJSManager] Received remote stream from:', peerId)
      console.log('[PeerJSManager] Call metadata:', call.metadata)
      console.log('[PeerJSManager] Call open:', call.open)

      this.remoteStreams.set(peerId, remoteStream)
      this.callbacks.onRemoteStreamAdded?.(peerId, remoteStream)
      this.callbacks.onConnectionStateChanged?.(peerId, 'connected')

      // Initial track state
      this.updateTrackState(peerId, remoteStream)

      // Monitor track changes - simple approach: just poll for track presence
      // Start polling for track state changes if not already started
      this.startTrackStatePolling()

      // Listen for track events on the MediaStream itself
      // This fires when tracks are added/removed dynamically (e.g., via replaceTrack)
      remoteStream.onaddtrack = (event) => {
        console.log('[PeerJSManager] ✅ Track added to stream from:', peerId, {
          kind: event.track.kind,
          readyState: event.track.readyState,
          enabled: event.track.enabled,
          totalTracks: remoteStream.getTracks().length,
          videoTracks: remoteStream.getVideoTracks().length,
        })
        
        // Update track state immediately
        this.updateTrackState(peerId, remoteStream)
        
        // Create a new Map to trigger React re-render
        const newMap = new Map(this.remoteStreams)
        this.remoteStreams = newMap
        this.callbacks.onRemoteStreamAdded?.(peerId, remoteStream)
      }

      remoteStream.onremovetrack = (event) => {
        console.log('[PeerJSManager] ❌ Track removed from stream from:', peerId, {
          kind: event.track.kind,
          totalTracks: remoteStream.getTracks().length,
          videoTracks: remoteStream.getVideoTracks().length,
        })
        
        // Update track state immediately
        this.updateTrackState(peerId, remoteStream)
        
        // Create a new Map to trigger React re-render
        const newMap = new Map(this.remoteStreams)
        this.remoteStreams = newMap
        this.callbacks.onRemoteStreamAdded?.(peerId, remoteStream)
      }

      // Listen for track events on the peer connection to detect track replacements
      if (call.peerConnection) {
        call.peerConnection.ontrack = (event) => {
          console.log('[PeerJSManager] Track event received from:', peerId, event.track.kind, 'readyState:', event.track.readyState)
          
          // The track is automatically added to the stream by WebRTC
          // The onaddtrack event on the stream will handle the update
        }
      }
    })

    call.on('error', (err) => {
      const peerError = createPeerJSError(err)
      logError(peerError, { context: 'call', peerId })
      this.callbacks.onConnectionStateChanged?.(peerId, 'failed')
      this.callbacks.onError?.(peerError)
    })

    call.on('close', () => {
      console.log('[PeerJSManager] Call closed with:', peerId)

      // No event listeners to clean up - we use polling instead
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
   * Simple: if stream has video track, video is enabled. Otherwise, it's disabled.
   */
  private updateTrackState(peerId: string, stream: MediaStream): void {
    const videoTrack = stream.getVideoTracks()[0]
    const audioTrack = stream.getAudioTracks()[0]

    // A track is considered enabled if:
    // 1. It exists
    // 2. It's in 'live' state
    // 3. It's enabled (not disabled via track.enabled = false)
    // 4. It's not muted (muted means no data is flowing, e.g., after replaceTrack(null))
    const newState: PeerTrackState = {
      videoEnabled: !!videoTrack && videoTrack.readyState === 'live' && videoTrack.enabled && !videoTrack.muted,
      audioEnabled: audioTrack?.enabled ?? false,
    }

    // Only notify if state actually changed
    const currentState = this.trackStates.get(peerId)
    if (
      !currentState ||
      currentState.videoEnabled !== newState.videoEnabled ||
      currentState.audioEnabled !== newState.audioEnabled
    ) {
      console.log('[PeerJSManager] 🔄 Track state changed for:', peerId, {
        old: currentState,
        new: newState,
        videoTrack: videoTrack ? {
          id: videoTrack.id,
          kind: videoTrack.kind,
          readyState: videoTrack.readyState,
          enabled: videoTrack.enabled,
          muted: videoTrack.muted,
        } : null,
        totalTracks: stream.getTracks().length,
      })
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

    console.log('[PeerJSManager] 🔄 Starting track state polling')

    // Poll every 500ms to detect enabled/disabled state changes
    this.trackStatePollInterval = window.setInterval(() => {
      console.log('[PeerJSManager] 📊 Polling', this.remoteStreams.size, 'remote streams')
      for (const [peerId, stream] of this.remoteStreams) {
        const videoTrack = stream.getVideoTracks()[0]
        console.log('[PeerJSManager] 📹 Checking peer:', peerId, {
          hasVideoTrack: !!videoTrack,
          readyState: videoTrack?.readyState,
          enabled: videoTrack?.enabled,
          muted: videoTrack?.muted,
        })
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
      console.log(
        '[PeerJSManager] No local stream yet, stored remote player IDs for later connection:',
        remotePlayerIds,
      )
      return
    }

    console.log('[PeerJSManager] Connecting to remote peers:', remotePlayerIds)

    // Create calls for new peers in parallel
    const connectionPromises = remotePlayerIds
      .filter(
        (remotePlayerId) =>
          !this.calls.has(remotePlayerId) &&
          !this.calledPeers.has(remotePlayerId),
      )
      .map((remotePlayerId) => this.createOutgoingCall(remotePlayerId))

    // Wait for all connections, but don't fail if one fails
    await Promise.allSettled(connectionPromises)

    // Close calls for removed peers
    for (const [peerId] of this.calls) {
      if (!remotePlayerIds.includes(peerId)) {
        console.log('[PeerJSManager] Closing call with removed peer:', peerId)
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
    if (
      this.calledPeers.has(remotePlayerId) ||
      this.calls.has(remotePlayerId)
    ) {
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
      logError(peerError, {
        context: 'createOutgoingCall',
        peerId: remotePlayerId,
      })
      this.callbacks.onConnectionStateChanged?.(remotePlayerId, 'failed')
      this.callbacks.onError?.(peerError)
      this.calledPeers.delete(remotePlayerId)
    }
  }

  /**
   * Toggle video track
   * When disabling, stops the track completely (camera turns off)
   * When enabling, gets a new track from getUserMedia and replaces it in all connections
   */
  async toggleVideo(enabled: boolean): Promise<void> {
    if (enabled) {
      // Re-enable: Get a new video track from the camera
      try {
        // Try to use the last device ID if available, otherwise use any video device
        let videoConstraints: MediaTrackConstraints = this.lastVideoDeviceId
          ? {
              deviceId: { ideal: this.lastVideoDeviceId }, // Use ideal instead of exact
              width: { ideal: 3840 },
              height: { ideal: 2160 },
            }
          : {
              width: { ideal: 3840 },
              height: { ideal: 2160 },
            }

        // Get a new video track from the camera with fallback
        let videoStream: MediaStream
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          })
        } catch (err) {
          // If 4K fails, try with 1080p
          console.warn('[PeerJSManager] 4K failed in toggleVideo, falling back to 1080p:', err)
          videoConstraints = this.lastVideoDeviceId
            ? {
                deviceId: { ideal: this.lastVideoDeviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              }
            : {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              }
          
          try {
            videoStream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraints,
              audio: false,
            })
          } catch (err2) {
            // If 1080p fails, use basic constraints
            console.warn('[PeerJSManager] 1080p failed in toggleVideo, using basic constraints:', err2)
            videoStream = await navigator.mediaDevices.getUserMedia({
              video: this.lastVideoDeviceId ? { deviceId: { ideal: this.lastVideoDeviceId } } : true,
              audio: false,
            })
          }
        }

        const newVideoTrack = videoStream.getVideoTracks()[0]
        if (!newVideoTrack) {
          // Stop all tracks from the temporary stream
          videoStream.getTracks().forEach((track) => track.stop())
          throw new Error('No video track in new stream')
        }

        // Store the device ID for future use
        const settings = newVideoTrack.getSettings()
        if (settings.deviceId) {
          this.lastVideoDeviceId = settings.deviceId
        }

        // Stop any other tracks from the temporary stream (shouldn't be any, but be safe)
        videoStream.getTracks().forEach((track) => {
          if (track !== newVideoTrack) {
            track.stop()
          }
        })

        // If we have an existing stream, create a new MediaStream with the new track
        // This ensures React detects the reference change and updates video elements
        if (this.localStream?.stream) {
          // Remove old track if it exists
          if (this.localStream.videoTrack) {
            this.localStream.videoTrack.stop()
          }

          // Create a new MediaStream with audio (if exists) and new video track
          const newStream = new MediaStream()
          if (this.localStream.audioTrack) {
            newStream.addTrack(this.localStream.audioTrack)
          }
          newStream.addTrack(newVideoTrack)

          this.localStream = {
            stream: newStream,
            videoTrack: newVideoTrack,
            audioTrack: this.localStream.audioTrack,
          }
          
          // Notify about stream change so UI updates
          this.callbacks.onLocalStreamChanged?.(newStream)
        } else {
          // No existing stream, create new one
          const audioTrack = this.localStream?.audioTrack || null
          const stream = new MediaStream()
          if (audioTrack) {
            stream.addTrack(audioTrack)
          }
          stream.addTrack(newVideoTrack)

          this.localStream = {
            stream,
            videoTrack: newVideoTrack,
            audioTrack: audioTrack,
          }
          this.callbacks.onLocalStreamChanged?.(stream)
        }

        // Replace track in all active calls
        for (const [peerId, call] of this.calls) {
          if (!call.open) {
            continue
          }

          const peerConnection = call.peerConnection
          if (!peerConnection) {
            continue
          }

          const sender = peerConnection
            .getSenders()
            .find((s) => s.track?.kind === 'video')
          if (sender) {
            try {
              await sender.replaceTrack(newVideoTrack)
              console.log('[PeerJSManager] Video track replaced for:', peerId)
            } catch (err) {
              console.error(
                `[PeerJSManager] Failed to replace video track for ${peerId}:`,
                err,
              )
            }
          } else {
            // No video sender exists, add track to connection
            // This can happen if the call was created while video was off
            try {
              peerConnection.addTrack(newVideoTrack, this.localStream!.stream)
              console.log(
                '[PeerJSManager] Video track added to connection for:',
                peerId,
              )
            } catch (err) {
              console.error(
                `[PeerJSManager] Failed to add video track to connection for ${peerId}:`,
                err,
              )
            }
          }
        }

        console.log('[PeerJSManager] Video enabled, camera turned on')
      } catch (err) {
        const peerError = createPeerJSError(err)
        logError(peerError, { context: 'toggleVideo', action: 'enable' })
        this.callbacks.onError?.(peerError)
        throw peerError
      }
    } else {
      // Disable: Stop the track completely (camera turns off)
      if (!this.localStream?.videoTrack) {
        return
      }

      // Stop the track (this turns off the camera)
      this.localStream.videoTrack.stop()

      // Create a new MediaStream without the video track
      // This ensures React detects the reference change and updates video elements
      if (this.localStream.stream) {
        const newStream = new MediaStream()
        if (this.localStream.audioTrack) {
          newStream.addTrack(this.localStream.audioTrack)
        }
        
        this.localStream.stream = newStream
        
        // Notify about stream change so UI updates
        this.callbacks.onLocalStreamChanged?.(newStream)
      }

      // Remove track from all active calls using replaceTrack(null)
      for (const [peerId, call] of this.calls) {
        if (!call.open) {
          continue
        }

        const sender = call.peerConnection
          ?.getSenders()
          .find((s) => s.track?.kind === 'video')
        if (sender) {
          try {
            await sender.replaceTrack(null)
            console.log('[PeerJSManager] Video track removed for:', peerId)
          } catch (err) {
            console.error(
              `[PeerJSManager] Failed to remove video track for ${peerId}:`,
              err,
            )
          }
        }
      }

      // Clear the video track reference
      this.localStream.videoTrack = null

      console.log('[PeerJSManager] Video disabled, camera turned off')
    }

    // Notify about local track state change
    this.callbacks.onTrackStateChanged?.(this.localPlayerId, {
      videoEnabled: enabled,
      audioEnabled: this.localStream?.audioTrack?.enabled ?? false,
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

      // Update stored device ID for future reinitialization
      this.lastVideoDeviceId = deviceId

      // Replace track in all active calls
      for (const [peerId, call] of this.calls) {
        // Only replace track if call is open
        if (!call.open) {
          console.log(
            '[PeerJSManager] Call not open, skipping track replacement for:',
            peerId,
          )
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
