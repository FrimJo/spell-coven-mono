/**
 * Retry logic utilities for PeerJS connections
 * Implements exponential backoff: 0s, 2s, 4s
 */

import type { RetryConfig } from '@/types/peerjs'

/**
 * Default retry configuration
 * Attempts: 3 times
 * Backoff: 0ms, 2000ms, 4000ms (exponential)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  backoffMs: [0, 2000, 4000],
}

/**
 * Executes a function with retry logic and exponential backoff
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration (attempts and backoff delays)
 * @returns Result of the function if successful
 * @throws Error if all retry attempts fail
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   async () => peer.call(remoteId, stream),
 *   { maxAttempts: 3, backoffMs: [0, 2000, 4000] }
 * )
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      // Wait for backoff delay before attempting (0ms on first attempt)
      if (attempt > 0 && config.backoffMs[attempt]) {
        await new Promise((resolve) =>
          setTimeout(resolve, config.backoffMs[attempt]),
        )
      }

      console.log(`[Retry] Attempt ${attempt + 1}/${config.maxAttempts}`)
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`[Retry] Attempt ${attempt + 1} failed:`, lastError.message)

      // Don't retry if this is the last attempt
      if (attempt === config.maxAttempts - 1) {
        break
      }
    }
  }

  throw lastError || new Error('Retry failed: Unknown error')
}

/**
 * Checks if an error is retryable
 *
 * @param error - Error to check
 * @returns true if the error is transient and should be retried
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  // Retryable errors
  const retryablePatterns = [
    'network',
    'timeout',
    'econnrefused',
    'econnreset',
    'ehostunreach',
    'enetunreach',
  ]

  return retryablePatterns.some((pattern) => message.includes(pattern))
}
