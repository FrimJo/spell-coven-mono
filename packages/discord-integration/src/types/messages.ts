import { z } from 'zod';

/**
 * Discord Channel Schema (v1.0)
 * Text or voice channel information
 */
export const DiscordChannelSchema = z.object({
  version: z.literal('1.0'),
  id: z.string().regex(/^\d+$/), // Snowflake ID
  type: z.enum(['text', 'voice', 'category', 'dm', 'group_dm']),
  guildId: z.string().regex(/^\d+$/).optional(), // Null for DMs
  name: z.string().min(1).max(100),
  topic: z.string().max(1024).optional(), // Channel topic (for metadata storage)
  position: z.number().int().nonnegative().optional(),
  permissions: z.number().int().optional(), // Bitfield of user permissions
  occupancy: z.number().int().nonnegative().optional(), // Voice channel only
});

export type DiscordChannel = z.infer<typeof DiscordChannelSchema>;

/**
 * Discord Message Schema (v1.0)
 * Text message in Discord channel
 */
export const DiscordMessageSchema = z.object({
  version: z.literal('1.0'),
  id: z.string().regex(/^\d+$/), // Snowflake ID
  channelId: z.string().regex(/^\d+$/),
  authorId: z.string().regex(/^\d+$/),
  content: z.string().max(2000), // Discord limit
  timestamp: z.string().datetime(), // ISO 8601
  editedTimestamp: z.string().datetime().optional(),
  embeds: z.array(z.lazy(() => GameEventEmbedSchema)).optional(),
  type: z.enum(['default', 'reply', 'system']).default('default'),
});

export type DiscordMessage = z.infer<typeof DiscordMessageSchema>;

/**
 * Game Event Embed Schema (v1.0)
 * Rich embed for game events
 */
export const GameEventEmbedSchema = z.object({
  version: z.literal('1.0'),
  type: z.enum(['card_lookup', 'life_total', 'turn_change']),
  timestamp: z.string().datetime(), // ISO 8601
  color: z.number().int().min(0).max(0xffffff).optional(), // Hex color
  data: z.union([
    // Card lookup data
    z.object({
      cardName: z.string(),
      manaCost: z.string().optional(),
      oracleText: z.string().optional(),
      imageUrl: z.string().url().optional(),
    }),
    // Life total data
    z.object({
      playerName: z.string(),
      oldLife: z.number().int(),
      newLife: z.number().int(),
    }),
    // Turn change data
    z.object({
      turnNumber: z.number().int().positive(),
      activePlayer: z.string(),
    }),
  ]),
});

export type GameEventEmbed = z.infer<typeof GameEventEmbedSchema>;

/**
 * Embed Color Constants
 */
export const EmbedColors = {
  CARD_LOOKUP: 0x5865f2, // Discord blue
  LIFE_GAIN: 0x57f287, // Green
  LIFE_LOSS: 0xed4245, // Red
  TURN_CHANGE: 0xfee75c, // Yellow
} as const;
