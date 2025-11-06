/**
 * WebRTC Types
 * Type definitions for peer connection states and signaling message types
 */

/**
 * Peer connection state enum
 * Maps to RTCPeerConnection.iceConnectionState with application-level states
 */
export type PeerConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'reconnecting'

/**
 * Signaling message type
 */
export type SignalingMessageType = 'offer' | 'answer' | 'ice-candidate'

/**
 * Peer connection configuration
 */
export interface PeerConnectionConfig {
  localPlayerId: string
  remotePlayerId: string
  roomId: string
}

/**
 * Peer connection metadata
 */
export interface PeerConnectionMetadata {
  id: string
  localPlayerId: string
  remotePlayerId: string
  roomId: string
  state: PeerConnectionState
  createdAt: number
  lastStateChange: number
}

