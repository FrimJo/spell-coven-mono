/**
 * WebRTC Utility Functions
 * Shared utilities for ID normalization, self-connection checks, and peer connection creation
 */

import { PeerConnectionManager } from './peer-connection'
import type { PeerConnectionState } from './types'

/**
 * Normalize player ID to string for consistent comparison
 * Discord IDs can be strings or numbers, so we normalize them to strings
 */
export function normalizePlayerId(id: string | number | undefined): string {
  if (id === undefined) {
    throw new Error('Player ID cannot be undefined')
  }
  return String(id)
}

/**
 * Check if two player IDs represent the same player (self-connection)
 * Normalizes both IDs before comparison to handle string/number differences
 */
export function isSelfConnection(
  localId: string | number,
  remoteId: string | number,
): boolean {
  return normalizePlayerId(localId) === normalizePlayerId(remoteId)
}

/**
 * Configuration for creating a peer connection with callbacks
 */
export interface CreatePeerConnectionConfig {
  localPlayerId: string
  remotePlayerId: string
  roomId: string
  localStream?: MediaStream | null
  onStateChange: (state: PeerConnectionState) => void
  onRemoteStream: (stream: MediaStream | null) => void
  onIceCandidate: (candidate: RTCIceCandidateInit) => void
}

/**
 * Create a peer connection manager with all callbacks configured
 * Consolidates duplicate connection setup logic from useWebRTC.ts
 */
export function createPeerConnectionWithCallbacks(
  config: CreatePeerConnectionConfig,
): PeerConnectionManager {
  const { localPlayerId, remotePlayerId, roomId, localStream, onStateChange, onRemoteStream, onIceCandidate } = config

  // Validate not connecting to self
  if (isSelfConnection(localPlayerId, remotePlayerId)) {
    throw new Error(`Cannot create peer connection to self: ${localPlayerId}`)
  }

  // Create peer connection manager
  const manager = new PeerConnectionManager({
    localPlayerId,
    remotePlayerId,
    roomId,
  })

  // Add local stream if provided
  if (localStream) {
    manager.addLocalStream(localStream)
  }

  // Setup callbacks
  manager.onStateChange(onStateChange)
  manager.onRemoteStream(onRemoteStream)
  manager.onIceCandidate((candidate) => {
    // Filter out null candidates - user callback only receives non-null candidates
    if (candidate) {
      onIceCandidate(candidate)
    }
  })

  return manager
}

