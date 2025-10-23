// Type exports for @repo/discord-integration

// Auth types
export type {
  DiscordToken,
  DiscordUser,
  PKCEChallenge,
  OAuthErrorResponse,
  DiscordTokenResponse,
  DiscordUserResponse,
} from './auth'
export {
  DiscordTokenSchema,
  DiscordUserSchema,
  PKCEChallengeSchema,
  OAuthErrorResponseSchema,
  DiscordTokenResponseSchema,
  DiscordUserResponseSchema,
} from './auth'

// Gateway types
export type {
  GatewayEvent,
  VoiceState,
  GatewayConnection,
  GatewayEventType,
  RtcConnection,
  StreamQuality,
  VideoStream,
} from './gateway'
export {
  GatewayEventSchema,
  VoiceStateSchema,
  GatewayConnectionSchema,
  GatewayEventTypeSchema,
  RtcConnectionSchema,
  StreamQualitySchema,
  VideoStreamSchema,
} from './gateway'

// Message types
export type { DiscordChannel, DiscordMessage, GameEventEmbed } from './messages'
export {
  DiscordChannelSchema,
  DiscordMessageSchema,
  GameEventEmbedSchema,
  EmbedColors,
} from './messages'

// Room types
export type { RoomMetadata, GameRoom } from './rooms'
export { RoomMetadataSchema, GameRoomSchema } from './rooms'
