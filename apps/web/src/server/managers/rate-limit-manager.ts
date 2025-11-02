/**
 * Rate Limit Manager
 * Implements request queue with exponential backoff for Discord API rate limits
 * Follows spec: max 5 retries, exponential backoff (1s → 2s → 4s → 8s → 16s)
 */

import type {
  RateLimitConfig,
  RateLimitMetrics,
  RateLimitQueueItem,
  RateLimitState,
} from '../types/rate-limit.js'

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRetries: 5,
  initialBackoffMs: 1000,
  maxBackoffMs: 16000,
  backoffMultiplier: 2,
}

export class RateLimitManager {
  private queue: RateLimitQueueItem[] = []
  private isProcessing = false
  private state: RateLimitState = {
    isRateLimited: false,
    resetTime: 0,
    retryAfterMs: 0,
    remainingRequests: 0,
    totalRequests: 0,
  }
  private metrics: RateLimitMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retriedRequests: 0,
    averageRetries: 0,
  }
  private config: RateLimitConfig

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Queue a request with automatic retry on rate limit
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: RateLimitQueueItem = {
        id: `${Date.now()}-${Math.random()}`,
        fn: fn as () => Promise<unknown>,
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        backoffMs: this.config.initialBackoffMs,
        createdAt: Date.now(),
        resolve: resolve as (value: unknown) => void,
        reject,
      }

      this.queue.push(item)
      this.metrics.totalRequests++
      this.processQueue()
    })
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      while (this.queue.length > 0) {
        // Check if rate limited
        if (this.state.isRateLimited && Date.now() < this.state.resetTime) {
          const waitTime = this.state.resetTime - Date.now()
          console.log(
            `[RateLimit] Rate limited, waiting ${waitTime}ms before retry`,
          )
          await this.sleep(waitTime)
        }

        const item = this.queue.shift()
        if (!item) break

        try {
          const result = await item.fn()
          item.resolve(result)
          this.metrics.successfulRequests++
        } catch (error) {
          // Check if error is rate limit related
          const isRateLimitError = this.isRateLimitError(error)

          if (isRateLimitError && item.retryCount < item.maxRetries) {
            // Parse retry-after header if available
            const retryAfter = this.parseRetryAfter(error)
            item.backoffMs = retryAfter || item.backoffMs

            // Update rate limit state
            this.state.isRateLimited = true
            this.state.resetTime = Date.now() + item.backoffMs
            this.state.retryAfterMs = item.backoffMs

            item.retryCount++
            this.metrics.retriedRequests++

            console.log(
              `[RateLimit] Request ${item.id} rate limited, retry ${item.retryCount}/${item.maxRetries} after ${item.backoffMs}ms`,
            )

            // Re-queue with backoff
            this.queue.unshift(item)
            await this.sleep(item.backoffMs)

            // Exponential backoff for next retry
            item.backoffMs = Math.min(
              item.backoffMs * this.config.backoffMultiplier,
              this.config.maxBackoffMs,
            )
          } else {
            // Max retries exceeded or non-rate-limit error
            item.reject(error)
            this.metrics.failedRequests++

            if (isRateLimitError) {
              console.error(
                `[RateLimit] Request ${item.id} failed after ${item.retryCount} retries`,
              )
            }
          }
        }
      }
    } finally {
      this.isProcessing = false
      this.updateMetrics()
    }
  }

  /**
   * Check if error is rate limit related
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      // Check for Discord API rate limit error (429)
      if ('status' in error && error.status === 429) {
        return true
      }
      // Check for common rate limit error messages
      const message = error.message.toLowerCase()
      return (
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('429')
      )
    }
    return false
  }

  /**
   * Parse retry-after header from error
   */
  private parseRetryAfter(error: unknown): number | null {
    if (
      error instanceof Error &&
      'headers' in error &&
      typeof error.headers === 'object' &&
      error.headers !== null
    ) {
      const headers = error.headers as Record<string, string>
      const retryAfter = headers['retry-after']
      if (retryAfter) {
        const ms = parseInt(retryAfter, 10) * 1000
        return isNaN(ms) ? null : ms
      }
    }
    return null
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    if (this.metrics.totalRequests > 0) {
      const totalRetries = this.metrics.retriedRequests
      this.metrics.averageRetries = totalRetries / this.metrics.totalRequests
    }
  }

  /**
   * Get current state
   */
  getState(): RateLimitState {
    return { ...this.state }
  }

  /**
   * Get metrics
   */
  getMetrics(): RateLimitMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset state
   */
  reset(): void {
    this.queue = []
    this.isProcessing = false
    this.state = {
      isRateLimited: false,
      resetTime: 0,
      retryAfterMs: 0,
      remainingRequests: 0,
      totalRequests: 0,
    }
  }
}

// Singleton instance
let instance: RateLimitManager | null = null

export function getRateLimitManager(): RateLimitManager {
  if (!instance) {
    instance = new RateLimitManager()
  }
  return instance
}
