/**
 * Participant types for game room presence
 */

export interface Participant {
  id: string
  username: string
  avatar?: string | null
  joinedAt: number
  /** Unique session ID per browser tab - used for duplicate detection */
  sessionId: string
}
