/**
 * Connection state types for WebRTC peer connections
 */

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'reconnecting'

export interface TrackState {
  videoEnabled: boolean
  audioEnabled: boolean
}
