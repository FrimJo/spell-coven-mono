/**
 * Participant types for game room presence
 */

export interface Participant {
  id: string
  username: string
  avatar?: string | null
  /** Whether the participant is intentionally publishing camera video */
  videoEnabled: boolean
  /** Whether the participant is intentionally publishing microphone audio */
  audioEnabled: boolean
  joinedAt: number
  /** Unique session ID per browser tab - used for duplicate detection */
  sessionId: string
  health: number
  poison: number
  commanders: Array<{ id: string; name: string }>
  commanderDamage: Record<string, number>
  /** Timestamp of last heartbeat - used to determine online/offline status */
  lastSeenAt: number
}
