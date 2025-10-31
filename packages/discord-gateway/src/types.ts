const DISCORD_ID_REGEX = /^\d+$/

type DiscordSnowflake = string

type VoiceEventName =
  | 'room.created'
  | 'room.deleted'
  | 'voice.joined'
  | 'voice.left'

type BaseEventPayload = {
  guildId: DiscordSnowflake
}

export interface MessageEnvelope {
  v: 1
  type: 'event' | 'ack' | 'error'
  event?: string
  payload: unknown
  ts: number
}

export interface RoomCreatedPayload extends BaseEventPayload {
  channelId: DiscordSnowflake
  name: string
  parentId?: DiscordSnowflake
  userLimit: number
}

export interface RoomDeletedPayload extends BaseEventPayload {
  channelId: DiscordSnowflake
}

export interface VoiceJoinedPayload extends BaseEventPayload {
  channelId: DiscordSnowflake
  userId: DiscordSnowflake
  username: string
  avatar: string | null
}

export interface VoiceLeftPayload extends BaseEventPayload {
  channelId: DiscordSnowflake | null
  userId: DiscordSnowflake
}

export type InternalEventPayload =
  | RoomCreatedPayload
  | RoomDeletedPayload
  | VoiceJoinedPayload
  | VoiceLeftPayload

export interface InternalEvent {
  event: VoiceEventName
  payload: InternalEventPayload
}

export interface VoiceChannel {
  id: DiscordSnowflake
  name: string
  type: number
  guild_id: DiscordSnowflake
  parent_id?: DiscordSnowflake
  user_limit?: number
}

export interface GatewayConfig {
  port: number
  botToken: string
  primaryGuildId: DiscordSnowflake
  hubEndpoint: string
  hubSecret: string
}

export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'IDENTIFYING'
  | 'CONNECTED'
  | 'RECONNECTING'

export interface GatewaySession {
  sessionId: string | null
  sequenceNumber: number | null
  resumeUrl: string | null
}

function isDiscordSnowflake(value: unknown): value is DiscordSnowflake {
  return typeof value === 'string' && DISCORD_ID_REGEX.test(value)
}

export function isMessageEnvelope(value: unknown): value is MessageEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const envelope = value as Record<string, unknown>

  return (
    envelope.v === 1 &&
    (envelope.type === 'event' ||
      envelope.type === 'ack' ||
      envelope.type === 'error') &&
    (envelope.event === undefined || typeof envelope.event === 'string') &&
    typeof envelope.ts === 'number'
  )
}

export function isInternalEvent(value: unknown): value is InternalEvent {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const event = value as { event?: unknown; payload?: unknown }
  const payload = event.payload as Record<string, unknown> | undefined

  if (
    event.event !== 'room.created' &&
    event.event !== 'room.deleted' &&
    event.event !== 'voice.joined' &&
    event.event !== 'voice.left'
  ) {
    return false
  }

  if (!payload) {
    return false
  }

  switch (event.event) {
    case 'room.created':
      return (
        isDiscordSnowflake(payload.channelId) &&
        typeof payload.name === 'string' &&
        isDiscordSnowflake(payload.guildId) &&
        (payload.parentId === undefined ||
          isDiscordSnowflake(payload.parentId)) &&
        typeof payload.userLimit === 'number'
      )

    case 'room.deleted':
      return (
        isDiscordSnowflake(payload.channelId) &&
        isDiscordSnowflake(payload.guildId)
      )

    case 'voice.joined':
      return (
        isDiscordSnowflake(payload.guildId) &&
        isDiscordSnowflake(payload.channelId) &&
        isDiscordSnowflake(payload.userId) &&
        typeof payload.username === 'string' &&
        (payload.avatar === null || typeof payload.avatar === 'string')
      )

    case 'voice.left':
      return (
        isDiscordSnowflake(payload.guildId) &&
        (payload.channelId === null || isDiscordSnowflake(payload.channelId)) &&
        isDiscordSnowflake(payload.userId)
      )
  }

  return false
}
