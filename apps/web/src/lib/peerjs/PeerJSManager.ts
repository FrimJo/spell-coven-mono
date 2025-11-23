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
  private localStream: MediaStream | null = null
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
  private static websocketPatched = false
  private static originalWebSocket: typeof WebSocket | null = null
  private static currentToken: string | null = null
  private static currentLocalPeerId: string | null = null

  constructor(
    private localPlayerId: string,
    private roomId: string,
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
      `[PeerJSManager] Connecting to PeerJS server at ${protocol}://${peerConfig.host}:${peerConfig.port}${peerConfig.path} with roomId: ${this.roomId}`,
    )

    // Patch WebSocket constructor to add token parameter and transform messages
    // This needs to be active for both initial connection and reconnections
    // We patch it once and keep it patched, but only modify PeerJS URLs and messages
    // Update the current token and local peer ID for this instance
    PeerJSManager.currentToken = this.roomId
    PeerJSManager.currentLocalPeerId = this.localPlayerId

    if (!PeerJSManager.websocketPatched) {
      PeerJSManager.originalWebSocket = window.WebSocket

      window.WebSocket = class PatchedWebSocket extends (
        (PeerJSManager.originalWebSocket!)
      ) {
        private originalSend: typeof WebSocket.prototype.send
        private originalOnMessage: ((event: MessageEvent) => void) | null = null
        private messageListeners = new Set<(event: MessageEvent) => void>()

        constructor(url: string | URL, protocols?: string | string[]) {
          // Parse URL and add token parameter if it's a PeerJS connection URL
          let finalUrl: string | URL
          if (typeof url === 'string') {
            const urlObj = new URL(url)
            // Only add token if this looks like a PeerJS connection (has key and id params)
            // and doesn't already have a token (to avoid duplicates)
            if (
              urlObj.searchParams.has('key') &&
              urlObj.searchParams.has('id') &&
              !urlObj.searchParams.has('token') &&
              PeerJSManager.currentToken
            ) {
              urlObj.searchParams.set('token', PeerJSManager.currentToken)
            }
            finalUrl = urlObj.toString()
          } else {
            // URL object
            if (
              url.searchParams.has('key') &&
              url.searchParams.has('id') &&
              !url.searchParams.has('token') &&
              PeerJSManager.currentToken
            ) {
              url.searchParams.set('token', PeerJSManager.currentToken)
            }
            finalUrl = url
          }
          super(finalUrl, protocols)

          // Store original send method
          this.originalSend = super.send.bind(this)

          // Intercept onmessage to transform incoming messages
          Object.defineProperty(this, 'onmessage', {
            get: () => this.originalOnMessage,
            set: (handler: ((event: MessageEvent) => void) | null) => {
              this.originalOnMessage = handler
              if (handler) {
                super.onmessage = (event: MessageEvent) => {
                  const transformedEvent = this.transformIncomingMessage(event)
                  handler(transformedEvent)
                }
              } else {
                super.onmessage = null
              }
            },
            configurable: true,
            enumerable: true,
          })

          // Intercept addEventListener to transform incoming messages
          const originalAddEventListener = super.addEventListener.bind(this)
          this.addEventListener = (
            type: string,
            listener: EventListener | EventListenerObject | null,
            options?: boolean | AddEventListenerOptions,
          ) => {
            // Handle null listener - just pass through to original
            if (listener === null) {
              // Call original addEventListener directly without type assertion
              return (
                super.addEventListener as (
                  type: string,
                  listener: EventListener | EventListenerObject | null,
                  options?: boolean | AddEventListenerOptions,
                ) => void
              )(type, listener, options)
            }

            // Transform message events
            if (type === 'message') {
              const transformedListener = (event: Event) => {
                if (event instanceof MessageEvent) {
                  const transformedEvent = this.transformIncomingMessage(event)
                  if (
                    'handleEvent' in listener &&
                    typeof listener.handleEvent === 'function'
                  ) {
                    listener.handleEvent(transformedEvent)
                  } else if (typeof listener === 'function') {
                    listener(transformedEvent)
                  }
                } else {
                  if (
                    'handleEvent' in listener &&
                    typeof listener.handleEvent === 'function'
                  ) {
                    listener.handleEvent(event)
                  } else if (typeof listener === 'function') {
                    listener(event)
                  }
                }
              }
              this.messageListeners.add(
                transformedListener as (event: MessageEvent) => void,
              )
              return originalAddEventListener(
                type as keyof WebSocketEventMap,
                transformedListener,
                options,
              )
            }

            // For other event types, pass through
            return originalAddEventListener(
              type as keyof WebSocketEventMap,
              listener as EventListenerOrEventListenerObject,
              options,
            )
          }
        }

        /**
         * Transform outgoing message from PeerJS format to Cloudflare server format
         */
        private transformOutgoingMessage(
          data: string | ArrayBuffer | Blob,
        ): string | ArrayBuffer | Blob {
          try {
            // Only transform if it's a string (JSON message)
            if (typeof data !== 'string') {
              return data
            }

            let message: unknown
            try {
              message = JSON.parse(data)
            } catch {
              // Not JSON, pass through
              return data
            }

            // Check if this is a PeerJS message that needs transformation
            if (
              typeof message === 'object' &&
              message !== null &&
              'type' in message
            ) {
              const msg = message as Record<string, unknown>
              const msgType = String(msg.type).toUpperCase()

              // Check if message already has src/dst but needs payload.candidate fix
              if (
                msgType === 'CANDIDATE' &&
                'src' in msg &&
                'dst' in msg &&
                'payload' in msg
              ) {
                const payload = msg.payload as Record<string, unknown>
                // If payload.candidate is an object, convert it to string
                if (
                  payload.candidate &&
                  typeof payload.candidate === 'object' &&
                  'candidate' in payload.candidate
                ) {
                  const candidateObj = payload.candidate as Record<
                    string,
                    unknown
                  >
                  const transformed = {
                    ...msg,
                    payload: {
                      candidate: String(candidateObj.candidate || ''),
                      sdpMid: candidateObj.sdpMid ?? payload.sdpMid ?? null,
                      sdpMLineIndex:
                        candidateObj.sdpMLineIndex ??
                        payload.sdpMLineIndex ??
                        null,
                      usernameFragment:
                        candidateObj.usernameFragment ??
                        payload.usernameFragment ??
                        null,
                    },
                  }
                  if (process.env.NODE_ENV === 'development') {
                    console.debug(
                      '[PeerJSManager] Fixed candidate payload format',
                      {
                        original: msg,
                        transformed,
                      },
                    )
                  }
                  return JSON.stringify(transformed)
                }
              }

              // Transform OFFER, ANSWER, CANDIDATE messages
              if (msgType === 'OFFER' || msgType === 'ANSWER') {
                // PeerJS sends: { type: 'OFFER'/'ANSWER', sdp: string, dst: string } or similar
                // Cloudflare expects: { type: 'OFFER'/'ANSWER', src: string, dst: string, payload: { type: 'offer'/'answer', sdp: string } }
                const dst = msg.dst || msg.destination || msg.to
                if (dst && PeerJSManager.currentLocalPeerId) {
                  const transformed = {
                    type: msgType,
                    src: PeerJSManager.currentLocalPeerId,
                    dst: String(dst),
                    payload: {
                      type: msgType.toLowerCase(),
                      sdp: msg.sdp || '',
                    },
                  }
                  if (process.env.NODE_ENV === 'development') {
                    console.debug(
                      '[PeerJSManager] Transformed outgoing',
                      msgType,
                      {
                        original: msg,
                        transformed,
                      },
                    )
                  }
                  return JSON.stringify(transformed)
                }
              } else if (msgType === 'CANDIDATE') {
                // PeerJS sends: { type: 'CANDIDATE', candidate: RTCIceCandidateInit, dst: string } or similar
                // Cloudflare expects: { type: 'CANDIDATE', src: string, dst: string, payload: { candidate: string, sdpMid?, sdpMLineIndex?, usernameFragment? } }
                const dst = msg.dst || msg.destination || msg.to
                const candidate = msg.candidate || msg.payload
                if (dst && candidate && PeerJSManager.currentLocalPeerId) {
                  // Handle candidate - it might be an object or already a string
                  let candidateString: string
                  if (typeof candidate === 'string') {
                    candidateString = candidate
                  } else if (
                    typeof candidate === 'object' &&
                    candidate !== null &&
                    'candidate' in candidate
                  ) {
                    candidateString = String(candidate.candidate)
                  } else {
                    // Try to stringify the candidate object
                    candidateString = JSON.stringify(candidate)
                  }

                  const transformed = {
                    type: 'CANDIDATE',
                    src: PeerJSManager.currentLocalPeerId,
                    dst: String(dst),
                    payload: {
                      candidate: candidateString,
                      sdpMid:
                        typeof candidate === 'object' &&
                        candidate !== null &&
                        'sdpMid' in candidate
                          ? candidate.sdpMid
                          : null,
                      sdpMLineIndex:
                        typeof candidate === 'object' &&
                        candidate !== null &&
                        'sdpMLineIndex' in candidate
                          ? candidate.sdpMLineIndex
                          : null,
                      usernameFragment:
                        typeof candidate === 'object' &&
                        candidate !== null &&
                        'usernameFragment' in candidate
                          ? candidate.usernameFragment
                          : null,
                    },
                  }
                  if (process.env.NODE_ENV === 'development') {
                    console.debug(
                      '[PeerJSManager] Transformed outgoing CANDIDATE',
                      {
                        original: msg,
                        transformed,
                      },
                    )
                  }
                  return JSON.stringify(transformed)
                }
              } else if (msgType === 'HEARTBEAT') {
                // Heartbeat messages are already in the correct format
                return data
              }
            }

            // Not a message we need to transform, pass through
            return data
          } catch (error) {
            console.warn(
              '[PeerJSManager] Failed to transform outgoing message:',
              error,
            )
            return data
          }
        }

        /**
         * Transform incoming message from Cloudflare server format to PeerJS format
         */
        private transformIncomingMessage(event: MessageEvent): MessageEvent {
          try {
            // Only transform if it's a string (JSON message)
            if (typeof event.data !== 'string') {
              return event
            }

            let message: unknown
            try {
              message = JSON.parse(event.data)
            } catch {
              // Not JSON, pass through
              return event
            }

            // Check if this is a Cloudflare server message that needs transformation
            if (
              typeof message === 'object' &&
              message !== null &&
              'type' in message
            ) {
              const msg = message as Record<string, unknown>
              const msgType = String(msg.type).toUpperCase()

              // Handle ERROR messages - filter out non-fatal "unknown-peer" errors for CANDIDATE
              if (msgType === 'ERROR') {
                const payload = msg.payload as
                  | Record<string, unknown>
                  | undefined
                const errorType = payload?.type as string | undefined
                const errorMessage = payload?.message as string | undefined

                // Suppress "unknown-peer" errors for CANDIDATE messages during connection establishment
                // These are expected when ICE candidates are sent before the peer connects
                if (
                  errorType === 'unknown-peer' &&
                  errorMessage &&
                  (errorMessage.includes('CANDIDATE') ||
                    errorMessage.includes('Destination peer not found'))
                ) {
                  if (process.env.NODE_ENV === 'development') {
                    console.debug(
                      '[PeerJSManager] Suppressing non-fatal unknown-peer error for CANDIDATE:',
                      errorMessage,
                    )
                  }
                  // Return a no-op event that won't trigger PeerJS error handling
                  // Create an empty message that PeerJS will ignore
                  const noopEvent = new MessageEvent('message', {
                    data: JSON.stringify({ type: 'HEARTBEAT' }),
                    origin: event.origin,
                    lastEventId: event.lastEventId,
                    source: event.source,
                    ports: event.ports ? [...event.ports] : [],
                  })
                  return noopEvent
                }
                // For other errors, pass through (they may be legitimate)
              }

              // Transform OFFER, ANSWER, CANDIDATE messages from server
              if (msgType === 'OFFER' || msgType === 'ANSWER') {
                // Cloudflare sends: { type: 'OFFER'/'ANSWER', src: string, payload: { type: 'offer'/'answer', sdp: string } }
                // PeerJS expects: { type: 'OFFER'/'ANSWER', sdp: string, src: string }
                if (
                  'payload' in msg &&
                  typeof msg.payload === 'object' &&
                  msg.payload !== null
                ) {
                  const payload = msg.payload as Record<string, unknown>
                  const transformed = {
                    type: msgType,
                    sdp: payload.sdp || '',
                    src: msg.src || '',
                  }
                  const transformedEvent = new MessageEvent(event.type, {
                    data: JSON.stringify(transformed),
                    origin: event.origin,
                    lastEventId: event.lastEventId,
                    source: event.source,
                    ports: event.ports ? [...event.ports] : [],
                  })
                  return transformedEvent
                }
              } else if (msgType === 'CANDIDATE') {
                // Cloudflare sends: { type: 'CANDIDATE', src: string, payload: { candidate: string, sdpMid?, sdpMLineIndex?, usernameFragment? } }
                // PeerJS expects: { type: 'CANDIDATE', candidate: RTCIceCandidateInit, src: string }
                if (
                  'payload' in msg &&
                  typeof msg.payload === 'object' &&
                  msg.payload !== null
                ) {
                  const payload = msg.payload as Record<string, unknown>
                  const transformed = {
                    type: 'CANDIDATE',
                    candidate: {
                      candidate: payload.candidate || '',
                      sdpMid: payload.sdpMid ?? null,
                      sdpMLineIndex: payload.sdpMLineIndex ?? null,
                      usernameFragment: payload.usernameFragment ?? null,
                    },
                    src: msg.src || '',
                  }
                  const transformedEvent = new MessageEvent(event.type, {
                    data: JSON.stringify(transformed),
                    origin: event.origin,
                    lastEventId: event.lastEventId,
                    source: event.source,
                    ports: event.ports ? [...event.ports] : [],
                  })
                  return transformedEvent
                }
              }
              // OPEN, LEAVE, EXPIRE messages are already compatible
            }

            // Not a message we need to transform, pass through
            return event
          } catch (error) {
            console.warn(
              '[PeerJSManager] Failed to transform incoming message:',
              error,
            )
            return event
          }
        }

        send(data: string | ArrayBuffer | Blob): void {
          const transformed = this.transformOutgoingMessage(data)
          // TypeScript doesn't know that transformed is the same type as data
          // but we know it is (either string or unchanged ArrayBuffer/Blob)
          this.originalSend(transformed as string | ArrayBuffer | Blob)
        }
      }

      PeerJSManager.websocketPatched = true
    }

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

        // Always log raw error details for unknown errors to help debugging
        if (peerError.type === 'unknown') {
          console.error(
            '[PeerJSManager] Unknown error from PeerJS - raw details:',
            {
              error: err,
              type: typeof err,
              isError: err instanceof Error,
              constructor: err?.constructor?.name,
              keys: err && typeof err === 'object' ? Object.keys(err) : [],
              stringified: String(err),
              // Try to extract any enumerable properties
              ...(err && typeof err === 'object'
                ? Object.fromEntries(
                    Object.entries(
                      err as unknown as Record<string, unknown>,
                    ).slice(0, 10), // Limit to first 10 properties
                  )
                : {}),
            },
          )
        }

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
        } else if (peerError.type === 'server-error') {
          // Server errors might indicate authentication, protocol mismatch, or server configuration issues
          const protocol = peerConfig.secure ? 'wss' : 'ws'
          const serverUrl = `${protocol}://${peerConfig.host}:${peerConfig.port}${peerConfig.path}`
          console.error(
            '[PeerJSManager] PeerJS server error:',
            peerError.message,
          )
          console.error(
            `[PeerJSManager] Server at ${serverUrl} returned an error. This might indicate:`,
          )
          console.error(
            '  - Protocol mismatch: PeerJS client (v1.5.4) may not be compatible with the server',
          )
          console.error(
            '  - Authentication token validation failed (check roomId/token)',
          )
          console.error(
            '  - Message format mismatch: Server expects messages with src/dst fields',
          )
          console.error('  - Server is experiencing internal errors')
          console.error(
            '[PeerJSManager] Check server logs for detailed validation errors',
          )
          logError(err, {
            context: 'peer initialization',
            peerId: this.localPlayerId,
            roomId: this.roomId,
            serverUrl,
          })
        } else if (
          peerError.type !== 'network' &&
          peerError.type !== 'socket-error' &&
          peerError.type !== 'socket-closed'
        ) {
          // Log other errors normally, including the raw error for unknown types
          logError(err, {
            context: 'peer initialization',
            peerId: this.localPlayerId,
            roomId: this.roomId,
          })
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
   * Update the local media stream
   * This method is called whenever the external source (e.g., useMediaDevice) changes the stream.
   */
  async updateLocalStream(stream: MediaStream | null): Promise<void> {
    if (this.isDestroyed) {
      return
    }

    console.log('[PeerJSManager] Updating local stream:', {
      hasStream: !!stream,
      tracks: stream ? stream.getTracks().length : 0,
    })

    this.localStream = stream
    this.callbacks.onLocalStreamChanged?.(stream)

    // Broadcast local track state immediately
    this.broadcastLocalTrackState()

    // If we have a new stream, update all active calls
    if (stream) {
      // Answer any pending incoming calls
      this.answerPendingCalls(stream)

      // Replace tracks in active calls
      for (const [peerId, call] of this.calls) {
        if (!call.open || !call.peerConnection) continue

        const senders = call.peerConnection.getSenders()

        // Replace video track
        const videoSender = senders.find((s) => s.track?.kind === 'video')
        const videoTrack = stream.getVideoTracks()[0] || null
        if (videoSender) {
          try {
            await videoSender.replaceTrack(videoTrack)
            console.log('[PeerJSManager] Replaced video track for:', peerId)
          } catch (err) {
            console.error(
              `[PeerJSManager] Failed to replace video track for ${peerId}:`,
              err,
            )
          }
        } else if (videoTrack) {
          // If no sender exists but we have a track, we might need to add it
          // Note: Standard WebRTC replaceTrack doesn't support adding new tracks easily
          // without renegotiation, which PeerJS abstracts away.
          // For now, we primarily support replacing existing tracks.
          console.warn(
            `[PeerJSManager] No video sender found for ${peerId}, cannot add new track`,
          )
        }

        // Replace audio track
        const audioSender = senders.find((s) => s.track?.kind === 'audio')
        const audioTrack = stream.getAudioTracks()[0] || null
        if (audioSender) {
          try {
            await audioSender.replaceTrack(audioTrack)
            console.log('[PeerJSManager] Replaced audio track for:', peerId)
          } catch (err) {
            console.error(
              `[PeerJSManager] Failed to replace audio track for ${peerId}:`,
              err,
            )
          }
        }
      }
    } else {
      // If stream is null, we should probably stop sending
      for (const [peerId, call] of this.calls) {
        if (!call.open || !call.peerConnection) continue
        const senders = call.peerConnection.getSenders()
        for (const sender of senders) {
          try {
            await sender.replaceTrack(null)
          } catch (err) {
            console.error(
              `[PeerJSManager] Failed to clear track for ${peerId}:`,
              err,
            )
          }
        }
      }
    }

    // Automatically connect to stored remote peers if we now have a stream
    if (stream && this.currentRemotePlayerIds.length > 0) {
      this.connectToPeers(this.currentRemotePlayerIds).catch((err) => {
        console.error(
          '[PeerJSManager] Failed to connect to peers after stream update:',
          err,
        )
      })
    }
  }

  /**
   * Broadcast local track state to listeners
   */
  private broadcastLocalTrackState(): void {
    const stream = this.localStream
    const videoTrack = stream?.getVideoTracks()[0]
    const audioTrack = stream?.getAudioTracks()[0]

    const state: PeerTrackState = {
      videoEnabled:
        !!videoTrack &&
        videoTrack.readyState === 'live' &&
        videoTrack.enabled &&
        !videoTrack.muted,
      audioEnabled: audioTrack?.enabled ?? false,
    }

    this.callbacks.onTrackStateChanged?.(this.localPlayerId, state)
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

    if (!this.localStream) {
      console.log(
        '[PeerJSManager] No local stream, deferring call from:',
        peerId,
      )
      this.pendingIncomingCalls.set(peerId, call)
      this.callbacks.onConnectionStateChanged?.(peerId, 'connecting')
      return
    }

    console.log('[PeerJSManager] Answering incoming call from:', peerId)
    call.answer(this.localStream)
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
        console.log(
          '[PeerJSManager] ❌ Track removed from stream from:',
          peerId,
          {
            kind: event.track.kind,
            totalTracks: remoteStream.getTracks().length,
            videoTracks: remoteStream.getVideoTracks().length,
          },
        )

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
          console.log(
            '[PeerJSManager] Track event received from:',
            peerId,
            event.track.kind,
            'readyState:',
            event.track.readyState,
          )

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
      videoEnabled:
        !!videoTrack &&
        videoTrack.readyState === 'live' &&
        videoTrack.enabled &&
        !videoTrack.muted,
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
        videoTrack: videoTrack
          ? {
              id: videoTrack.id,
              kind: videoTrack.kind,
              readyState: videoTrack.readyState,
              enabled: videoTrack.enabled,
              muted: videoTrack.muted,
            }
          : null,
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
      // console.log('[PeerJSManager] 📊 Polling', this.remoteStreams.size, 'remote streams')
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

    if (!this.localStream) {
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
    if (!this.peer || !this.localStream) {
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
                this.peer!.call(remotePlayerId, this.localStream!, {
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
   * Get current local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream
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

    // Drop reference to stream (ownership is external)
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
