/**
 * Contract: usePeerJS Hook API
 * 
 * This defines the public interface for the PeerJS React hook that replaces
 * the custom WebRTC implementation.
 */

import type { Peer, MediaConnection } from 'peerjs'

/**
 * Connection state for a peer connection
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'reconnecting'

/**
 * Track state for remote peer's media tracks
 */
export interface PeerTrackState {
  videoEnabled: boolean
  audioEnabled: boolean
}

/**
 * Options for initializing the usePeerJS hook
 */
export interface UsePeerJSOptions {
  /** Discord voice channel ID (used as room identifier) */
  roomId: string
  
  /** Local player's Discord user ID (used as peer ID) */
  localPlayerId: string
  
  /** List of remote player IDs to connect to */
  remotePlayerIds: string[]
  
  /** Whether to automatically start video on mount */
  autoStart?: boolean
}

/**
 * Return value from usePeerJS hook
 */
export interface UsePeerJSReturn {
  // === Peer Instance ===
  
  /** PeerJS peer instance (null until initialized) */
  peer: Peer | null
  
  /** Local peer ID */
  peerId: string
  
  // === Local Media ===
  
  /** Local media stream (camera + microphone) */
  localStream: MediaStream | null
  
  /** Whether local video is currently active */
  isVideoActive: boolean
  
  /** Whether local audio is currently muted */
  isAudioMuted: boolean
  
  /** Whether local video track is enabled (different from active) */
  isVideoEnabled: boolean
  
  /** Currently selected camera device ID */
  selectedCameraId: string | null
  
  // === Remote Connections ===
  
  /** Map of remote peer ID to their media stream */
  remoteStreams: Map<string, MediaStream | null>
  
  /** Map of remote peer ID to connection state */
  connectionStates: Map<string, ConnectionState>
  
  /** Map of remote peer ID to their track states */
  peerTrackStates: Map<string, PeerTrackState>
  
  // === Actions ===
  
  /** Start local video (request camera/mic permissions) */
  startVideo: () => Promise<void>
  
  /** Stop local video (release camera/mic) */
  stopVideo: () => void
  
  /** Toggle local video enabled/disabled */
  toggleVideo: () => void
  
  /** Toggle local audio muted/unmuted */
  toggleAudio: () => void
  
  /** Switch to a different camera device */
  switchCamera: (deviceId: string) => Promise<void>
  
  /** Manually retry connection to a specific peer */
  retryConnection: (peerId: string) => Promise<void>
  
  // === Error State ===
  
  /** Current error (if any) */
  error: Error | null
  
  /** Clear current error */
  clearError: () => void
}

/**
 * Hook for managing PeerJS WebRTC connections
 * 
 * @example
 * ```tsx
 * function GameRoom() {
 *   const { members } = useVoiceChannelMembersFromEvents({ gameId, userId })
 *   const remotePlayerIds = members.map(m => m.id).filter(id => id !== userId)
 *   
 *   const {
 *     localStream,
 *     remoteStreams,
 *     startVideo,
 *     toggleVideo,
 *     toggleAudio
 *   } = usePeerJS({
 *     roomId: gameId,
 *     localPlayerId: userId,
 *     remotePlayerIds,
 *     autoStart: true
 *   })
 *   
 *   return (
 *     <div>
 *       <video srcObject={localStream} />
 *       {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
 *         <video key={peerId} srcObject={stream} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function usePeerJS(options: UsePeerJSOptions): UsePeerJSReturn

/**
 * Error types that can be thrown by usePeerJS
 */
export class PeerJSError extends Error {
  constructor(
    message: string,
    public code: PeerJSErrorCode,
    public originalError?: unknown
  )
}

export type PeerJSErrorCode =
  | 'peer-unavailable'      // Remote peer not found
  | 'network'               // Network connectivity issue
  | 'browser-incompatible'  // Browser doesn't support WebRTC
  | 'unavailable-id'        // Peer ID already in use
  | 'server-error'          // PeerJS server error
  | 'socket-error'          // WebSocket connection error
  | 'socket-closed'         // WebSocket closed unexpectedly
  | 'permission-denied'     // User denied camera/mic permissions
  | 'device-not-found'      // Requested camera device not found
  | 'connection-timeout'    // Connection attempt timed out (10s)
  | 'max-retries-exceeded'  // Failed after 3 retry attempts
