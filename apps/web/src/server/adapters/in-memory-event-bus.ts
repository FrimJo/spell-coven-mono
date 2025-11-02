import type { IEventBus } from '../interfaces/event-bus'

/**
 * In-Memory Event Bus
 *
 * Simple in-memory implementation for single-instance deployments.
 * For horizontal scaling, use RedisEventBus instead.
 */
export class InMemoryEventBus<T> implements IEventBus<T> {
  private handlers: Set<(event: T) => void> = new Set()

  on(handler: (event: T) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(event: T): void {
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch (error) {
        console.error('[EventBus] Handler error:', error)
      }
    }
  }

  /**
   * Get number of registered handlers
   */
  getHandlerCount(): number {
    return this.handlers.size
  }
}
