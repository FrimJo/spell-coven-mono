import { createHmac } from 'node:crypto';

/**
 * Generate HMAC signature for internal webhook requests
 * 
 * Format: sha256=<hex-digest>
 * Payload: "<timestamp>.<body>"
 * 
 * @param secret - Shared secret between worker and backend
 * @param timestamp - Unix timestamp in seconds
 * @param body - JSON stringified request body
 * @returns HMAC signature in format "sha256=<hex>"
 */
export function generateHmacSignature(
  secret: string,
  timestamp: number,
  body: string
): string {
  const message = `${timestamp}.${body}`;
  const signature = createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  return `sha256=${signature}`;
}

/**
 * Get current Unix timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
