/**
 * Request/Response schemas for Discord REST API
 * Uses discord-api-types for canonical type definitions
 */

import { z } from 'zod'

const SnowflakeSchema = z.string().regex(/^\d+$/)

// ============================================================================
// Channel Schemas
// ============================================================================

export const PermissionOverwriteSchema = z.object({
  id: SnowflakeSchema,
  type: z.union([z.literal(0), z.literal(1)]),
  allow: z.string().regex(/^\d+$/),
  deny: z.string().regex(/^\d+$/),
})

export const CreateVoiceChannelRequestSchema = z.object({
  name: z.string().min(1).max(100),
  parent_id: SnowflakeSchema.optional(),
  user_limit: z.number().int().min(0).max(99).optional(),
  position: z.number().int().optional(),
  permission_overwrites: z.array(PermissionOverwriteSchema).optional(),
  rtc_region: z.string().optional(),
  video_quality_mode: z.number().int().min(1).max(2).optional(),
  bitrate: z.number().int().min(8000).max(96000).optional(),
})

export type CreateVoiceChannelRequest = z.infer<
  typeof CreateVoiceChannelRequestSchema
>

// ============================================================================
// Message Schemas
// ============================================================================

export const SendMessageRequestSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  nonce: z.union([z.string(), z.number()]).optional(),
  tts: z.boolean().optional(),
  embeds: z.array(z.unknown()).optional(),
  allowed_mentions: z.unknown().optional(),
  message_reference: z.unknown().optional(),
  components: z.array(z.unknown()).optional(),
  sticker_ids: z.array(z.string()).optional(),
  files: z.array(z.unknown()).optional(),
  attachments: z.array(z.unknown()).optional(),
  flags: z.number().optional(),
})

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>

export const CreateRoleRequestSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.string().regex(/^\d+$/).optional(),
  color: z.number().int().min(0).max(0xffffff).optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  icon: z.string().nullable().optional(),
  unicode_emoji: z.string().nullable().optional(),
})

export type CreateRoleRequest = z.infer<typeof CreateRoleRequestSchema>

export const AddGuildMemberRequestSchema = z.object({
  access_token: z.string(),
  nick: z.string().max(32).optional(),
  roles: z.array(SnowflakeSchema).optional(),
  mute: z.boolean().optional(),
  deaf: z.boolean().optional(),
  channel_id: SnowflakeSchema.optional(),
})

export type AddGuildMemberRequest = z.infer<typeof AddGuildMemberRequestSchema>

// ============================================================================
// Error Schemas
// ============================================================================

export const DiscordErrorResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  errors: z.unknown().optional(),
})

export type DiscordErrorResponse = z.infer<typeof DiscordErrorResponseSchema>

// ============================================================================
// Rate Limit Schemas
// ============================================================================

export const RateLimitResponseSchema = z.object({
  message: z.string(),
  retry_after: z.number(),
  global: z.boolean(),
  code: z.number().optional(),
})

export type RateLimitResponse = z.infer<typeof RateLimitResponseSchema>
