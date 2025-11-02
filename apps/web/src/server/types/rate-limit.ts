/**
 * Rate Limit Types
 * Types for request queuing and exponential backoff
 */

export interface RateLimitQueueItem {
  id: string
  fn: () => Promise<unknown>
  retryCount: number
  maxRetries: number
  backoffMs: number
  createdAt: number
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

export interface RateLimitState {
  isRateLimited: boolean
  resetTime: number
  retryAfterMs: number
  remainingRequests: number
  totalRequests: number
}

export interface RateLimitConfig {
  maxRetries: number
  initialBackoffMs: number
  maxBackoffMs: number
  backoffMultiplier: number
}

export interface RateLimitMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  retriedRequests: number
  averageRetries: number
  lastRateLimitTime?: number
}
