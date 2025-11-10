/**
 * Timeout handling utilities for PeerJS connections
 * Implements 10-second connection timeout
 */

import type { TimeoutConfig } from '@/types/peerjs'

/**
 * Default timeout configuration
 * Connection timeout: 10 seconds
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  connectionTimeoutMs: 10000,
}

/**
 * Wraps a promise with a timeout
 *
 * @param promise - Promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Custom timeout error message
 * @returns Promise that rejects if timeout is exceeded
 *
 * @example
 * ```ts
 * const result = await withTimeout(
 *   peer.call(remoteId, stream),
 *   10000,
 *   'Connection timeout'
 * )
 * ```
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out',
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(timeoutMessage))
      }, timeoutMs)

      // Ensure timer is cleared if promise resolves
      promise.finally(() => clearTimeout(timer))
    }),
  ])
}

/**
 * Creates a timeout promise that rejects after specified delay
 *
 * @param timeoutMs - Timeout in milliseconds
 * @param message - Error message
 * @returns Promise that rejects after timeout
 *
 * @example
 * ```ts
 * const result = await Promise.race([
 *   someOperation(),
 *   createTimeout(5000, 'Operation timed out')
 * ])
 * ```
 */
export function createTimeout(
  timeoutMs: number,
  message: string = 'Timeout',
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)
  })
}

/**
 * Executes a function with timeout
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Custom timeout error message
 * @returns Result of the function if completed within timeout
 * @throws Error if timeout is exceeded
 *
 * @example
 * ```ts
 * const result = await executeWithTimeout(
 *   async () => peer.call(remoteId, stream),
 *   10000,
 *   'Connection failed: timeout'
 * )
 * ```
 */
export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out',
): Promise<T> {
  return withTimeout(fn(), timeoutMs, timeoutMessage)
}
