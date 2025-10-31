/**
 * WebSocket token cryptography - PURE SERVER-ONLY
 * This file MUST NEVER be imported on the client
 * Contains all Node.js crypto operations
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

// ============================================================================
// Utilities
// ============================================================================

function base64UrlEncode(data: string | Uint8Array): string {
  const buffer =
    typeof data === 'string' ? Buffer.from(data) : Buffer.from(data)
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  const padded =
    padding === 0 ? normalized : normalized + '='.repeat((4 - padding) % 4)
  return Buffer.from(padded, 'base64')
}

// ============================================================================
// Token Creation
// ============================================================================

/**
 * Create a WebSocket authentication token (HS256 signed JWT)
 *
 * @param userId - Discord user ID
 * @param expiresInSeconds - Token expiration time in seconds (default: 1 hour)
 * @returns JWT token string with 3 parts: header.payload.signature
 */
export function createWebSocketAuthToken(
  userId: string,
  expiresInSeconds: number = 3600,
): string {
  const secret = process.env.WS_AUTH_SECRET
  if (!secret) {
    throw new Error('WS_AUTH_SECRET environment variable is required')
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: userId,
    iat: now,
    exp: now + expiresInSeconds,
  }

  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const signature = createHmac('sha256', secret).update(signingInput).digest()

  const encodedSignature = base64UrlEncode(signature)

  return `${signingInput}.${encodedSignature}`
}

// ============================================================================
// Token Verification
// ============================================================================

/**
 * Verify a WebSocket authentication token (HS256 signed JWT)
 *
 * @param token - JWT token string
 * @returns Decoded claims with userId (sub), issued at (iat), and expiration (exp)
 * @throws Error if token is invalid, expired, or signature doesn't match
 */
export function verifyWebSocketAuthToken(token: string): {
  sub: string
  iat: number
  exp: number
} {
  const secret = process.env.WS_AUTH_SECRET
  if (!secret) {
    throw new Error('WS_AUTH_SECRET environment variable is required')
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token format')
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts

  // Verify signature
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const expectedSignature = createHmac('sha256', secret)
    .update(signingInput)
    .digest()

  const actualSignature = base64UrlDecode(encodedSignature)

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error('Invalid token signature')
  }

  // Decode and validate payload
  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf-8'))

  if (typeof payload.sub !== 'string') {
    throw new Error('Invalid token: missing sub claim')
  }

  if (typeof payload.exp !== 'number') {
    throw new Error('Invalid token: missing exp claim')
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp <= now) {
    throw new Error('Token has expired')
  }

  return {
    sub: payload.sub,
    iat: payload.iat,
    exp: payload.exp,
  }
}
