import { createHmac } from 'node:crypto'

/**
 * Generate HMAC signature for hub communication
 */
export function generateHmacSignature(
  secret: string,
  timestamp: number,
  body: string,
): string {
  const message = `${timestamp}.${body}`
  return createHmac('sha256', secret).update(message).digest('hex')
}

/**
 * Get current timestamp in milliseconds
 */
export function getCurrentTimestamp(): number {
  return Date.now()
}
