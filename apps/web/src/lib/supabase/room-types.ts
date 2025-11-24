/**
 * Game Room Types
 *
 * Simple types for room metadata (no database required).
 *
 * Important: With Supabase Realtime, channels are created automatically
 * when the first person subscribes. There's no concept of a channel
 * "existing" or "not existing" - any room ID is valid!
 */

/**
 * Room metadata (stored in session/memory only)
 */
export interface RoomMetadata {
  id: string
  maxPlayers: number
  createdAt: number
}
