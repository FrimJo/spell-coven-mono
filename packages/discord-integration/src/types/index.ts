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

// Gateway types (from discord-api-types)
export type {
  GatewayReceivePayload,
  GatewayDispatchEvents,
} from 'discord-api-types/v10'

// Gateway types (local)
export type {
  VoiceState,
  GatewayConnection,
  RtcConnection,
  StreamQuality,
  VideoStream,
} from './gateway'
export {
  VoiceStateSchema,
  GatewayConnectionSchema,
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

// REST API schemas
export type {
  CreateVoiceChannelRequest,
  SendMessageRequest,
  DiscordErrorResponse,
  RateLimitResponse,
} from './rest-schemas'
export {
  CreateVoiceChannelRequestSchema,
  DiscordErrorResponseSchema,
  RateLimitResponseSchema,
} from './rest-schemas'

// RTC types
export type {
  RtcConnectionState,
  RtcIceConnectionState,
  AudioStreamConfig,
  VideoStreamConfig,
  MediaStreamInfo,
  VoiceServerUpdate,
  VoiceStateUpdate,
  VoiceIdentifyPayload,
  VoiceSelectProtocolPayload,
  VoiceReadyPayload,
  VoiceSessionDescriptionPayload,
  VoiceSpeakingPayload,
  VoiceHelloPayload,
  RtpHeader,
  RtpPacket,
  EncryptionMode,
  EncryptionConfig,
  DiscordRtcClientConfig,
} from './rtc-types'
export {
  VoiceServerUpdateSchema,
  VoiceStateUpdateSchema,
  VoiceOpcode,
  SpeakingFlags,
} from './rtc-types'

// Event types
export type {
  DiscordSnowflake,
  VoiceEventName,
  BaseEventPayload,
  MessageEnvelope,
  RoomCreatedPayload,
  RoomDeletedPayload,
  VoiceJoinedPayload,
  VoiceLeftPayload,
  InternalEventPayload,
  InternalEvent,
} from './events'
export { isMessageEnvelope, isInternalEvent } from './events'

// Gateway Service WebSocket Protocol types
export type {
  GatewayServiceMessage,
  GatewayServiceEventMessage,
  GatewayServiceCommandMessage,
  GatewayServiceAckMessage,
  GatewayServiceErrorMessage,
} from './gateway-service'
export {
  GatewayServiceMessageSchema,
  GatewayServiceEventMessageSchema,
  GatewayServiceCommandMessageSchema,
  GatewayServiceAckMessageSchema,
  GatewayServiceErrorMessageSchema,
  isEventMessage,
  isCommandMessage,
  isAckMessage,
  isErrorMessage,
} from './gateway-service'

// Discord API types (from discord-api-types)
export type {
  APIVoiceState,
  APIGuildMember,
  APIUser,
  APIChannel,
  APIMessage,
  APIRole,
  APIGuild,
} from './discord-api'
