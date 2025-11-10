/**
 * TypeScript types for PeerJS WebRTC integration
 * Defines types for connection state, peer track state, and error handling
 */

/**
 * Connection state for a peer connection
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed' | 'reconnecting'

/**
 * Track state for audio/video tracks
 */
export interface PeerTrackState {
  videoEnabled: boolean
  audioEnabled: boolean
}

/**
 * Represents a remote peer's media stream and connection state
 */
export interface RemotePeer {
  peerId: string
  stream: MediaStream | null
  trackState: PeerTrackState
  connectionState: ConnectionState
  error: PeerJSError | null
}

/**
 * PeerJS error with type information
 */
export class PeerJSError extends Error {
  constructor(
    public type: PeerErrorType,
    public originalError: Error | string,
    message?: string,
  ) {
    super(message || `PeerJS Error [${type}]: ${originalError}`)
    this.name = 'PeerJSError'
  }
}

/**
 * Types of errors that can occur in PeerJS connections
 */
export type PeerErrorType =
  | 'browser-incompatible'
  | 'invalid-id'
  | 'invalid-key'
  | 'network'
  | 'peer-unavailable'
  | 'ssl-unavailable'
  | 'server-error'
  | 'socket-closed'
  | 'socket-error'
  | 'unavailable-id'
  | 'webrtc'
  | 'unknown'

/**
 * Configuration for PeerJS connection retry logic
 */
export interface RetryConfig {
  maxAttempts: number
  backoffMs: number[]
}

/**
 * Configuration for PeerJS connection timeout
 */
export interface TimeoutConfig {
  connectionTimeoutMs: number
}

/**
 * Local media stream with track references
 */
export interface LocalMediaStream {
  stream: MediaStream
  videoTrack: MediaStreamTrack | null
  audioTrack: MediaStreamTrack | null
}
