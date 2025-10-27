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

// REST API schemas
export type {
  CreateVoiceChannelRequest,
  ChannelResponse,
  SendMessageRequest,
  MessageResponse,
  GuildChannelListResponse,
  DiscordErrorResponse,
  RateLimitResponse,
  GuildMember,
} from './rest-schemas'
export {
  CreateVoiceChannelRequestSchema,
  ChannelResponseSchema,
  SendMessageRequestSchema,
  MessageResponseSchema,
  GuildChannelListResponseSchema,
  DiscordErrorResponseSchema,
  RateLimitResponseSchema,
  GuildMemberSchema,
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
