/**
 * Error handling utilities for PeerJS connections
 * Maps PeerJS error types to user-friendly messages
 */

import { PeerJSError, type PeerErrorType } from '@/types/peerjs'

/**
 * Maps PeerJS error types to user-friendly error messages
 */
const ERROR_MESSAGES: Record<PeerErrorType, string> = {
  'browser-incompatible':
    'Your browser does not support WebRTC. Please use Chrome, Firefox, Safari, or Edge.',
  'invalid-id': 'Invalid peer ID. Please refresh and try again.',
  'invalid-key': 'Invalid API key. Please contact support.',
  'network': 'Network error. Please check your internet connection.',
  'peer-unavailable': 'The other player is no longer available.',
  'ssl-unavailable': 'SSL is required but not available.',
  'server-error': 'Server error. Please try again later.',
  'socket-closed': 'Connection closed. Please refresh and try again.',
  'socket-error': 'Connection error. Please check your internet.',
  'unavailable-id': 'Peer ID is already in use. Please refresh.',
  'webrtc': 'WebRTC error. Please check your camera and microphone permissions.',
  'unknown': 'An unknown error occurred. Please try again.',
}

/**
 * Maps PeerJS error codes to error types
 */
const ERROR_CODE_MAP: Record<string, PeerErrorType> = {
  'ERR_BROWSER_INCOMPATIBLE': 'browser-incompatible',
  'ERR_INVALID_ID': 'invalid-id',
  'ERR_INVALID_KEY': 'invalid-key',
  'ERR_NETWORK': 'network',
  'ERR_PEER_UNAVAILABLE': 'peer-unavailable',
  'ERR_SSL_UNAVAILABLE': 'ssl-unavailable',
  'ERR_SERVER_ERROR': 'server-error',
  'ERR_SOCKET_CLOSED': 'socket-closed',
  'ERR_SOCKET_ERROR': 'socket-error',
  'ERR_UNAVAILABLE_ID': 'unavailable-id',
  'ERR_WEBRTC': 'webrtc',
}

/**
 * Converts a PeerJS error code to a PeerErrorType
 *
 * @param code - PeerJS error code
 * @returns Corresponding PeerErrorType
 */
export function mapErrorCode(code: string): PeerErrorType {
  return ERROR_CODE_MAP[code] || 'unknown'
}

/**
 * Gets a user-friendly error message for a PeerErrorType
 *
 * @param errorType - PeerErrorType
 * @returns User-friendly error message
 */
export function getErrorMessage(errorType: PeerErrorType): string {
  return ERROR_MESSAGES[errorType]
}

/**
 * Creates a PeerJSError from a PeerJS error object
 *
 * @param error - Error from PeerJS
 * @returns PeerJSError with type information
 */
export function createPeerJSError(error: unknown): PeerJSError {
  if (error instanceof PeerJSError) {
    return error
  }

  let errorType: PeerErrorType = 'unknown'
  let originalError: Error | string = 'Unknown error'

  if (error instanceof Error) {
    originalError = error
    // Try to extract error type from error message or code
    if ('code' in error && typeof error.code === 'string') {
      errorType = mapErrorCode(error.code)
    } else if (error.message) {
      // Try to infer from message
      const lowerMessage = error.message.toLowerCase()
      if (lowerMessage.includes('network')) {
        errorType = 'network'
      } else if (lowerMessage.includes('timeout')) {
        errorType = 'network'
      } else if (lowerMessage.includes('taken') || lowerMessage.includes('unavailable')) {
        errorType = 'unavailable-id'
      } else if (lowerMessage.includes('webrtc')) {
        errorType = 'webrtc'
      }
    }
  } else if (typeof error === 'string') {
    originalError = error
  }

  const userMessage = getErrorMessage(errorType)

  return new PeerJSError(errorType, originalError, userMessage)
}

/**
 * Checks if an error is a permanent failure (should not retry)
 *
 * @param error - Error to check
 * @returns true if error is permanent
 */
export function isPermanentError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  // Permanent errors that should not be retried
  const permanentPatterns = [
    'browser-incompatible',
    'invalid-id',
    'invalid-key',
    'unavailable-id',
    'peer-unavailable',
  ]

  return permanentPatterns.some((pattern) => message.includes(pattern))
}

/**
 * Logs an error with context
 *
 * @param error - Error to log
 * @param context - Additional context
 */
export function logError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const peerError = createPeerJSError(error)
  console.error('[PeerJS Error]', {
    type: peerError.type,
    message: peerError.message,
    original: peerError.originalError,
    ...context,
  })
}
