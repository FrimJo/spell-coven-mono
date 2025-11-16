/**
 * Rate Limiter
 * 
 * Implements sliding window rate limiting to prevent abuse
 * Maximum 100 messages per second per peer
 */

export interface RateLimitConfig {
  maxMessages: number;      // Maximum messages per window
  windowDuration: number;   // Window duration in milliseconds
}

export interface RateLimitState {
  peerId: string;
  windowStart: number;      // Unix timestamp (ms)
  messageCount: number;
}

/**
 * Rate limiter using sliding window algorithm
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private states: Map<string, RateLimitState>;

  constructor(config: RateLimitConfig = { maxMessages: 100, windowDuration: 1000 }) {
    this.config = config;
    this.states = new Map();
  }

  /**
   * Check if a peer is allowed to send a message
   * Returns true if allowed, false if rate limit exceeded
   */
  checkLimit(peerId: string): boolean {
    const now = Date.now();
    const state = this.states.get(peerId);

    // First message from this peer
    if (!state) {
      this.states.set(peerId, {
        peerId,
        windowStart: now,
        messageCount: 1,
      });
      return true;
    }

    // Check if window has expired
    const windowElapsed = now - state.windowStart;
    if (windowElapsed >= this.config.windowDuration) {
      // Reset window
      state.windowStart = now;
      state.messageCount = 1;
      return true;
    }

    // Within current window
    if (state.messageCount < this.config.maxMessages) {
      state.messageCount++;
      return true;
    }

    // Rate limit exceeded
    return false;
  }

  /**
   * Get current rate limit state for a peer
   */
  getState(peerId: string): RateLimitState | undefined {
    return this.states.get(peerId);
  }

  /**
   * Reset rate limit state for a peer (called on disconnect)
   */
  reset(peerId: string): void {
    this.states.delete(peerId);
  }

  /**
   * Get number of messages remaining in current window
   */
  getRemainingMessages(peerId: string): number {
    const state = this.states.get(peerId);
    if (!state) {
      return this.config.maxMessages;
    }

    const now = Date.now();
    const windowElapsed = now - state.windowStart;

    // Window expired, full quota available
    if (windowElapsed >= this.config.windowDuration) {
      return this.config.maxMessages;
    }

    // Within window, return remaining quota
    return Math.max(0, this.config.maxMessages - state.messageCount);
  }

  /**
   * Clean up expired states (optional, for memory management)
   */
  cleanup(): void {
    const now = Date.now();
    const expiredPeers: string[] = [];

    for (const [peerId, state] of this.states.entries()) {
      const windowElapsed = now - state.windowStart;
      if (windowElapsed >= this.config.windowDuration * 2) {
        // State is expired (2x window duration with no activity)
        expiredPeers.push(peerId);
      }
    }

    for (const peerId of expiredPeers) {
      this.states.delete(peerId);
    }
  }

  /**
   * Get total number of tracked peers
   */
  getTrackedPeerCount(): number {
    return this.states.size;
  }
}
