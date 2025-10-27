import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify HMAC signature from internal webhook requests
 *
 * @param secret - Shared secret between worker and backend
 * @param signature - Signature from X-Hub-Signature header (format: "sha256=<hex>")
 * @param timestamp - Timestamp from X-Hub-Timestamp header (Unix seconds)
 * @param body - Raw request body string
 * @returns true if signature is valid and timestamp is fresh
 */
export function verifyHmacSignature(
  secret: string,
  signature: string,
  timestamp: number,
  body: string,
): { valid: boolean; error?: string } {
  // Check timestamp freshness (reject if >60s old)
  const now = Math.floor(Date.now() / 1000)
  const age = now - timestamp

  if (age > 60) {
    return { valid: false, error: 'Timestamp too old (>60s)' }
  }

  if (age < -60) {
    return { valid: false, error: 'Timestamp too far in future (>60s)' }
  }

  // Verify signature format
  if (!signature.startsWith('sha256=')) {
    return {
      valid: false,
      error: 'Invalid signature format (must start with "sha256=")',
    }
  }

  // Calculate expected signature
  const message = `${timestamp}.${body}`
  const expectedSignature = createHmac('sha256', secret)
    .update(message)
    .digest('hex')

  const providedSignature = signature.slice(7) // Remove "sha256=" prefix

  // Timing-safe comparison to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    const providedBuffer = Buffer.from(providedSignature, 'hex')

    if (expectedBuffer.length !== providedBuffer.length) {
      return { valid: false, error: 'Signature length mismatch' }
    }

    const isValid = timingSafeEqual(expectedBuffer, providedBuffer)

    if (!isValid) {
      return { valid: false, error: 'Signature mismatch' }
    }

    return { valid: true }
  } catch (_error) {
    return { valid: false, error: 'Invalid signature encoding' }
  }
}
