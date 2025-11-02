/**
 * Session Store Abstraction
 *
 * Interface for session management.
 * Enables future integration with Redis, Supabase, etc.
 */

export interface Session {
  userId: string
  guildId?: string
  [key: string]: unknown
}

export interface ISessionStore {
  /**
   * Get session by ID
   */
  get(sessionId: string): Promise<Session | null>

  /**
   * Set session with optional TTL
   */
  set(sessionId: string, session: Session, ttl?: number): Promise<void>

  /**
   * Delete session
   */
  delete(sessionId: string): Promise<void>
}
