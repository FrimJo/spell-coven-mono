/**
 * Event Bus Abstraction
 *
 * Interface for event distribution that enables future integration
 * of third-party services (Redis, Supabase, etc.) without changing business logic.
 */

export interface IEventBus<T> {
  /**
   * Register event handler
   * @returns Unsubscribe function
   */
  on(handler: (event: T) => void): () => void

  /**
   * Emit event to all handlers
   */
  emit(event: T): void
}
