import { z } from 'zod'

import {
  DiscordChannelSchema,
  DiscordMessageSchema,
  DiscordTokenSchema,
  DiscordUserSchema,
  GameEventEmbedSchema,
  GameRoomSchema,
  GatewayConnectionSchema,
  RoomMetadataSchema,
  RtcConnectionSchema,
  VideoStreamSchema,
  VoiceStateSchema,
} from '../types/index.js'

/**
 * Validation utilities for Discord data contracts
 */

/**
 * Validate Discord token from localStorage
 * @throws {z.ZodError} if validation fails
 */
export function validateToken(data: unknown) {
  return DiscordTokenSchema.parse(data)
}

/**
 * Validate Discord user from API response
 * @throws {z.ZodError} if validation fails
 */
export function validateUser(data: unknown) {
  return DiscordUserSchema.parse(data)
}

/**
 * Validate Gateway connection state
 * @throws {z.ZodError} if validation fails
 */
export function validateGatewayConnection(data: unknown) {
  return GatewayConnectionSchema.parse(data)
}

/**
 * Validate Discord channel
 * @throws {z.ZodError} if validation fails
 */
export function validateChannel(data: unknown) {
  return DiscordChannelSchema.parse(data)
}

/**
 * Validate Discord message
 * @throws {z.ZodError} if validation fails
 */
export function validateMessage(data: unknown) {
  return DiscordMessageSchema.parse(data)
}

/**
 * Validate game event embed
 * @throws {z.ZodError} if validation fails
 */
export function validateGameEventEmbed(data: unknown) {
  return GameEventEmbedSchema.parse(data)
}

/**
 * Validate room metadata
 * @throws {z.ZodError} if validation fails
 */
export function validateRoomMetadata(data: unknown) {
  return RoomMetadataSchema.parse(data)
}

/**
 * Validate game room
 * @throws {z.ZodError} if validation fails
 */
export function validateGameRoom(data: unknown) {
  return GameRoomSchema.parse(data)
}

/**
 * Validate voice state
 * @throws {z.ZodError} if validation fails
 */
export function validateVoiceState(data: unknown) {
  return VoiceStateSchema.parse(data)
}

/**
 * Validate video stream
 * @throws {z.ZodError} if validation fails
 */
export function validateVideoStream(data: unknown) {
  return VideoStreamSchema.parse(data)
}

/**
 * Validate RTC connection
 * @throws {z.ZodError} if validation fails
 */
export function validateRtcConnection(data: unknown) {
  return RtcConnectionSchema.parse(data)
}

/**
 * Safe parse with error logging
 * Returns null if validation fails
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data)
  if (!result.success) {
    console.error('Validation failed:', result.error.errors)
    return null
  }
  return result.data
}

/**
 * Check if token is expired or about to expire
 * @param token Discord token
 * @param bufferMs Buffer time in milliseconds (default: 5 minutes)
 * @returns true if token needs refresh
 */
export function isTokenExpired(
  token: { expiresAt: number },
  bufferMs = 5 * 60 * 1000,
): boolean {
  return Date.now() + bufferMs >= token.expiresAt
}

/**
 * Validate room metadata size for Discord channel topic
 * @param metadata Room metadata object
 * @returns true if metadata fits in channel topic (< 1024 bytes)
 */
export function isMetadataSizeValid(metadata: unknown): boolean {
  const json = JSON.stringify(metadata)
  const bytes = new TextEncoder().encode(json).length
  return bytes < 1024
}
