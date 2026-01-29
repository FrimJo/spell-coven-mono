/**
 * Custom Error Classes for Convex Backend
 *
 * These errors are thrown by mutations/queries and can be identified
 * by the frontend using error.message matching or error codes.
 *
 * Usage on frontend:
 *   import { ErrorCode } from '@/convex/errors'
 *   if (error.message.includes(ErrorCode.AUTH_REQUIRED)) { ... }
 */

/**
 * Error codes for frontend identification
 */
export const ErrorCode = {
  // Authentication & Authorization
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_MISMATCH: 'AUTH_MISMATCH',
  NOT_ROOM_OWNER: 'NOT_ROOM_OWNER',
  NOT_CURRENT_TURN: 'NOT_CURRENT_TURN',
  BANNED_FROM_ROOM: 'BANNED_FROM_ROOM',
  CANNOT_TARGET_SELF: 'CANNOT_TARGET_SELF',

  // Not Found
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_STATE_NOT_FOUND: 'ROOM_STATE_NOT_FOUND',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  NO_ACTIVE_PLAYERS: 'NO_ACTIVE_PLAYERS',

  // Validation
  MISSING_USER_ID: 'MISSING_USER_ID',

  // Server/Internal
  TURN_ADVANCE_FAILED: 'TURN_ADVANCE_FAILED',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * Base class for all application errors
 */
export class AppError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(`[${code}] ${message}`)
    this.code = code
    this.name = 'AppError'
  }
}

// ============================================================================
// Authentication & Authorization Errors
// ============================================================================

export class AuthRequiredError extends AppError {
  constructor(message = 'Authentication required') {
    super(ErrorCode.AUTH_REQUIRED, message)
    this.name = 'AuthRequiredError'
  }
}

export class AuthMismatchError extends AppError {
  constructor(message = 'User ID does not match authenticated user') {
    super(ErrorCode.AUTH_MISMATCH, message)
    this.name = 'AuthMismatchError'
  }
}

export class NotRoomOwnerError extends AppError {
  constructor(action = 'perform this action') {
    super(ErrorCode.NOT_ROOM_OWNER, `Only the room owner can ${action}`)
    this.name = 'NotRoomOwnerError'
  }
}

export class NotCurrentTurnError extends AppError {
  constructor(message = 'Only the current turn player can advance turn') {
    super(ErrorCode.NOT_CURRENT_TURN, message)
    this.name = 'NotCurrentTurnError'
  }
}

export class BannedFromRoomError extends AppError {
  constructor(message = 'You are banned from this room') {
    super(ErrorCode.BANNED_FROM_ROOM, message)
    this.name = 'BannedFromRoomError'
  }
}

export class CannotTargetSelfError extends AppError {
  constructor(action = 'target') {
    super(ErrorCode.CANNOT_TARGET_SELF, `Cannot ${action} yourself`)
    this.name = 'CannotTargetSelfError'
  }
}

// ============================================================================
// Not Found Errors
// ============================================================================

export class RoomNotFoundError extends AppError {
  constructor(message = 'Room not found') {
    super(ErrorCode.ROOM_NOT_FOUND, message)
    this.name = 'RoomNotFoundError'
  }
}

export class RoomStateNotFoundError extends AppError {
  constructor(message = 'Room state not found') {
    super(ErrorCode.ROOM_STATE_NOT_FOUND, message)
    this.name = 'RoomStateNotFoundError'
  }
}

export class PlayerNotFoundError extends AppError {
  constructor(message = 'Player not found in room') {
    super(ErrorCode.PLAYER_NOT_FOUND, message)
    this.name = 'PlayerNotFoundError'
  }
}

export class NoActivePlayersError extends AppError {
  constructor(message = 'No active players in room') {
    super(ErrorCode.NO_ACTIVE_PLAYERS, message)
    this.name = 'NoActivePlayersError'
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

export class MissingUserIdError extends AppError {
  constructor(message = 'userId is required') {
    super(ErrorCode.MISSING_USER_ID, message)
    this.name = 'MissingUserIdError'
  }
}

// ============================================================================
// Server/Internal Errors
// ============================================================================

export class TurnAdvanceFailedError extends AppError {
  constructor(message = 'Failed to determine next player') {
    super(ErrorCode.TURN_ADVANCE_FAILED, message)
    this.name = 'TurnAdvanceFailedError'
  }
}

// ============================================================================
// Frontend Helper
// ============================================================================

/**
 * Check if an error matches a specific error code
 *
 * @example
 * try {
 *   await createRoom({ ownerId })
 * } catch (error) {
 *   if (hasErrorCode(error, ErrorCode.AUTH_REQUIRED)) {
 *     // Redirect to login
 *   }
 * }
 */
export function hasErrorCode(
  error: unknown,
  code: ErrorCode,
): error is AppError {
  if (error instanceof Error) {
    return error.message.includes(`[${code}]`)
  }
  return false
}

/**
 * Extract error code from an error message
 */
export function getErrorCode(error: unknown): ErrorCode | null {
  if (error instanceof Error) {
    const match = error.message.match(/\[([A-Z_]+)\]/)
    if (match && match[1] && match[1] in ErrorCode) {
      return match[1] as ErrorCode
    }
  }
  return null
}
