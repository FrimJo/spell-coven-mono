/**
 * PeerJS Protocol Message Type Definitions
 * 
 * Implements PeerJS Server Protocol v0.3.x compatible with PeerJS client v1.x
 * Message format is JSON-based over WebSocket
 */

// ============================================================================
// Client → Server Messages
// ============================================================================

export interface HeartbeatMessage {
  type: 'HEARTBEAT';
}

export interface OfferMessage {
  type: 'OFFER';
  src: string;  // Source peer ID
  dst: string;  // Destination peer ID
  payload: RTCSessionDescriptionInit;
}

export interface AnswerMessage {
  type: 'ANSWER';
  src: string;  // Source peer ID
  dst: string;  // Destination peer ID
  payload: RTCSessionDescriptionInit;
}

export interface CandidateMessage {
  type: 'CANDIDATE';
  src: string;  // Source peer ID
  dst: string;  // Destination peer ID
  payload: RTCIceCandidateInit;
}

export interface LeaveMessage {
  type: 'LEAVE';
  src: string;  // Peer ID leaving
}

export type ClientMessage =
  | HeartbeatMessage
  | OfferMessage
  | AnswerMessage
  | CandidateMessage
  | LeaveMessage;

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface OpenMessage {
  type: 'OPEN';
  peerId: string;  // Confirmed peer ID for this connection
}

export interface ServerOfferMessage {
  type: 'OFFER';
  src: string;  // Source peer ID
  payload: RTCSessionDescriptionInit;
}

export interface ServerAnswerMessage {
  type: 'ANSWER';
  src: string;  // Source peer ID
  payload: RTCSessionDescriptionInit;
}

export interface ServerCandidateMessage {
  type: 'CANDIDATE';
  src: string;  // Source peer ID
  payload: RTCIceCandidateInit;
}

export interface ServerLeaveMessage {
  type: 'LEAVE';
  peerId: string;  // Peer ID that left
}

export interface ExpireMessage {
  type: 'EXPIRE';
  peerId: string;  // Peer ID that timed out
}

export interface ErrorPayload {
  type: 'invalid-message' | 'unknown-peer' | 'rate-limit-exceeded' | 'room-full' | 'internal-error';
  message: string;
}

export interface ServerErrorMessage {
  type: 'ERROR';
  payload: ErrorPayload;
}

export type ServerMessage =
  | OpenMessage
  | ServerOfferMessage
  | ServerAnswerMessage
  | ServerCandidateMessage
  | ServerLeaveMessage
  | ExpireMessage
  | ServerErrorMessage;

// ============================================================================
// WebRTC Type Definitions (for reference)
// ============================================================================

export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp: string;
}

export interface RTCIceCandidateInit {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

// ============================================================================
// Message Type Guards
// ============================================================================

export function isHeartbeatMessage(msg: unknown): msg is HeartbeatMessage {
  return typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'HEARTBEAT';
}

export function isOfferMessage(msg: unknown): msg is OfferMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    msg.type === 'OFFER' &&
    'src' in msg &&
    'dst' in msg &&
    'payload' in msg
  );
}

export function isAnswerMessage(msg: unknown): msg is AnswerMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    msg.type === 'ANSWER' &&
    'src' in msg &&
    'dst' in msg &&
    'payload' in msg
  );
}

export function isCandidateMessage(msg: unknown): msg is CandidateMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    msg.type === 'CANDIDATE' &&
    'src' in msg &&
    'dst' in msg &&
    'payload' in msg
  );
}

export function isLeaveMessage(msg: unknown): msg is LeaveMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    msg.type === 'LEAVE' &&
    'src' in msg
  );
}

export function isClientMessage(msg: unknown): msg is ClientMessage {
  return (
    isHeartbeatMessage(msg) ||
    isOfferMessage(msg) ||
    isAnswerMessage(msg) ||
    isCandidateMessage(msg) ||
    isLeaveMessage(msg)
  );
}
