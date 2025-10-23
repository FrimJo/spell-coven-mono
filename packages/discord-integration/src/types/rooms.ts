import { z } from 'zod'

/**
 * Room Metadata Schema (v1.0)
 * Game configuration stored in Discord channel
 */
export const RoomMetadataSchema = z.object({
  version: z.literal('1.0'),
  format: z.string().min(1).max(50), // "Commander", "Standard", etc.
  powerLevel: z.number().int().min(1).max(10), // 1-10 scale
  maxPlayers: z.number().int().min(2).max(4),
  createdAt: z.string().datetime(), // ISO 8601
  customSettings: z.record(z.unknown()).optional(), // Extensible
})

export type RoomMetadata = z.infer<typeof RoomMetadataSchema>

/**
 * Game Room Schema (v1.0)
 * Game session mapped to Discord voice channel
 */
export const GameRoomSchema = z.object({
  version: z.literal('1.0'),
  id: z.string().regex(/^\d+$/), // Maps to Discord channel ID
  channelId: z.string().regex(/^\d+$/), // Voice channel ID
  textChannelId: z.string().regex(/^\d+$/).optional(), // Paired text channel
  state: z.enum(['lobby', 'in_game', 'completed']),
  metadata: z.lazy(() => RoomMetadataSchema), // Embedded metadata
  participants: z.array(z.string().regex(/^\d+$/)), // Discord user IDs
  createdAt: z.string().datetime(), // ISO 8601
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
})

export type GameRoom = z.infer<typeof GameRoomSchema>
