/**
 * Supabase-specific types for Realtime channels and presence
 */

import { z } from 'zod'

export interface SupabaseChannelConfig {
  channelName: string
  roomId: string
}

// Zod schema for presence state validation
export const supabasePresenceStateSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  username: z.string().min(1, 'username is required'),
  avatar: z.string().nullable().optional(),
  joinedAt: z.number().positive('joinedAt must be a positive timestamp'),
})

export type SupabasePresenceState = z.infer<typeof supabasePresenceStateSchema>

/**
 * Validate presence state data
 */
export function validatePresenceState(data: unknown):
  | {
      success: true
      data: SupabasePresenceState
    }
  | {
      success: false
      error: Error
    } {
  try {
    const validated = supabasePresenceStateSchema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: new Error(
          `Presence state validation failed: ${error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`,
        ),
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}
