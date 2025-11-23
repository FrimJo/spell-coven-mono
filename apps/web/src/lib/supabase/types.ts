/**
 * Supabase-specific types for Realtime channels and presence
 */

export interface SupabaseChannelConfig {
  channelName: string
  roomId: string
}

export interface SupabasePresenceState {
  userId: string
  username: string
  avatar?: string | null
  joinedAt: number
}

