/**
 * Message Validation with Zod Schemas
 * 
 * Validates incoming PeerJS protocol messages to ensure they conform to the expected format
 * and prevent malformed messages from crashing the server or corrupting state.
 */

import { z } from 'zod';
import type { ClientMessage, ServerMessage } from './messages';

// ============================================================================
// WebRTC Type Schemas
// ============================================================================

const RTCSessionDescriptionInitSchema = z.object({
  type: z.enum(['offer', 'answer', 'pranswer', 'rollback']),
  sdp: z.string(),
});

const RTCIceCandidateInitSchema = z.object({
  candidate: z.string(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

// ============================================================================
// Client Message Schemas
// ============================================================================

const HeartbeatMessageSchema = z.object({
  type: z.literal('HEARTBEAT'),
});

const OfferMessageSchema = z.object({
  type: z.literal('OFFER'),
  src: z.string().min(1).max(64),
  dst: z.string().min(1).max(64),
  payload: RTCSessionDescriptionInitSchema,
});

const AnswerMessageSchema = z.object({
  type: z.literal('ANSWER'),
  src: z.string().min(1).max(64),
  dst: z.string().min(1).max(64),
  payload: RTCSessionDescriptionInitSchema,
});

const CandidateMessageSchema = z.object({
  type: z.literal('CANDIDATE'),
  src: z.string().min(1).max(64),
  dst: z.string().min(1).max(64),
  payload: RTCIceCandidateInitSchema,
});

const LeaveMessageSchema = z.object({
  type: z.literal('LEAVE'),
  src: z.string().min(1).max(64),
});

const ClientMessageSchema = z.discriminatedUnion('type', [
  HeartbeatMessageSchema,
  OfferMessageSchema,
  AnswerMessageSchema,
  CandidateMessageSchema,
  LeaveMessageSchema,
]);

// ============================================================================
// Server Message Schemas
// ============================================================================

const OpenMessageSchema = z.object({
  type: z.literal('OPEN'),
  peerId: z.string(),
});

const ServerOfferMessageSchema = z.object({
  type: z.literal('OFFER'),
  src: z.string(),
  payload: RTCSessionDescriptionInitSchema,
});

const ServerAnswerMessageSchema = z.object({
  type: z.literal('ANSWER'),
  src: z.string(),
  payload: RTCSessionDescriptionInitSchema,
});

const ServerCandidateMessageSchema = z.object({
  type: z.literal('CANDIDATE'),
  src: z.string(),
  payload: RTCIceCandidateInitSchema,
});

const ServerLeaveMessageSchema = z.object({
  type: z.literal('LEAVE'),
  peerId: z.string(),
});

const ExpireMessageSchema = z.object({
  type: z.literal('EXPIRE'),
  peerId: z.string(),
});

const ErrorPayloadSchema = z.object({
  type: z.enum(['invalid-message', 'unknown-peer', 'rate-limit-exceeded', 'room-full', 'internal-error']),
  message: z.string(),
});

const ServerErrorMessageSchema = z.object({
  type: z.literal('ERROR'),
  payload: ErrorPayloadSchema,
});

const ServerMessageSchema = z.discriminatedUnion('type', [
  OpenMessageSchema,
  ServerOfferMessageSchema,
  ServerAnswerMessageSchema,
  ServerCandidateMessageSchema,
  ServerLeaveMessageSchema,
  ExpireMessageSchema,
  ServerErrorMessageSchema,
]);

// ============================================================================
// Validation Functions
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validates a client message against the PeerJS protocol schema
 */
export function validateClientMessage(message: unknown): ValidationResult<ClientMessage> {
  try {
    const result = ClientMessageSchema.safeParse(message);
    
    if (result.success) {
      return {
        success: true,
        data: result.data as ClientMessage,
      };
    }
    
    return {
      success: false,
      error: `Invalid message format: ${result.error.message}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validates a server message against the PeerJS protocol schema
 */
export function validateServerMessage(message: unknown): ValidationResult<ServerMessage> {
  try {
    const result = ServerMessageSchema.safeParse(message);
    
    if (result.success) {
      return {
        success: true,
        data: result.data as ServerMessage,
      };
    }
    
    return {
      success: false,
      error: `Invalid message format: ${result.error.message}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validates peer ID format (alphanumeric + hyphens, 1-64 characters)
 */
export function validatePeerId(peerId: string): boolean {
  return /^[a-zA-Z0-9-]{1,64}$/.test(peerId);
}

/**
 * Validates message size (must be < 1MB per Cloudflare limit)
 */
export function validateMessageSize(message: string): boolean {
  const sizeInBytes = new TextEncoder().encode(message).length;
  const maxSizeInBytes = 1024 * 1024; // 1MB
  return sizeInBytes < maxSizeInBytes;
}
