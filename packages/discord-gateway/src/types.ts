const DISCORD_ID_REGEX = /^\d+$/

const GATEWAY_EVENT_TYPES = [
  'ready',
  'messageCreate',
  'messageUpdate',
  'messageDelete',
  'voice.joined',
  'voice.left',
  'error',
] as const

const GATEWAY_COMMAND_TYPES = [
  'sendMessage',
  'addReaction',
  'typingStart',
] as const

export const GATEWAY_SCHEMA_VERSION = '1.0' as const

export type DiscordSnowflake = string

export type GatewayEventType = (typeof GATEWAY_EVENT_TYPES)[number]

export type GatewayCommandType = (typeof GATEWAY_COMMAND_TYPES)[number]

export interface TraceMeta {
  traceId: string
  sentAt: string
  requestId?: string
  spanId?: string
  source?: string
}

export type GatewayEvent<TData = Record<string, unknown>> = {
  version: string
  type: GatewayEventType
  data: TData
  meta: TraceMeta
}

export type GatewayCommand<TData = Record<string, unknown>> = {
  version: string
  type: GatewayCommandType
  data: TData
  meta: TraceMeta
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function coerceIsoTimestamp(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString()
  }

  return new Date().toISOString()
}

function generateFallbackId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return Math.random().toString(16).slice(2)
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return undefined
}

export function sanitizeTraceMeta(value: unknown): TraceMeta {
  const meta = isPlainObject(value) ? value : {}

  const traceId = sanitizeString(meta.traceId) ?? generateFallbackId()
  const sentAt = coerceIsoTimestamp(meta.sentAt)

  const sanitized: TraceMeta = {
    traceId,
    sentAt,
  }

  const requestId = sanitizeString(meta.requestId)
  if (requestId) {
    sanitized.requestId = requestId
  }

  const spanId = sanitizeString(meta.spanId)
  if (spanId) {
    sanitized.spanId = spanId
  }

  const source = sanitizeString(meta.source)
  if (source) {
    sanitized.source = source
  }

  return sanitized
}

function isGatewayEventType(value: unknown): value is GatewayEventType {
  return typeof value === 'string' && GATEWAY_EVENT_TYPES.includes(value as never)
}

function isGatewayCommandType(value: unknown): value is GatewayCommandType {
  return (
    typeof value === 'string' && GATEWAY_COMMAND_TYPES.includes(value as never)
  )
}

export function sanitizeGatewayEvent(
  value: unknown,
): GatewayEvent | null {
  if (!isPlainObject(value)) {
    return null
  }

  if (!isGatewayEventType(value.type)) {
    return null
  }

  const data = isPlainObject(value.data) ? value.data : {}

  return {
    version: typeof value.version === 'string' ? value.version : GATEWAY_SCHEMA_VERSION,
    type: value.type,
    data,
    meta: sanitizeTraceMeta(value.meta),
  }
}

export function sanitizeGatewayCommand(
  value: unknown,
): GatewayCommand | null {
  if (!isPlainObject(value)) {
    return null
  }

  if (!isGatewayCommandType(value.type)) {
    return null
  }

  const data = isPlainObject(value.data) ? value.data : {}

  return {
    version: typeof value.version === 'string' ? value.version : GATEWAY_SCHEMA_VERSION,
    type: value.type,
    data,
    meta: sanitizeTraceMeta(value.meta),
  }
}

export type VoiceEventName =
  | 'room.created'
  | 'room.deleted'
  | 'voice.joined'
  | 'voice.left'

export type BaseEventPayload = {
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

function isDiscordSnowflake(value: unknown): value is DiscordSnowflake {
  return typeof value === 'string' && DISCORD_ID_REGEX.test(value)
}

export function isMessageEnvelope(value: unknown): value is MessageEnvelope {
  if (!isPlainObject(value)) {
    return false
  }

  return (
    value.v === 1 &&
    (value.type === 'event' ||
      value.type === 'ack' ||
      value.type === 'error') &&
    (value.event === undefined || typeof value.event === 'string') &&
    typeof value.ts === 'number'
  )
}

export function isInternalEvent(value: unknown): value is InternalEvent {
  if (!isPlainObject(value)) {
    return false
  }

  const payload = value.payload as Record<string, unknown> | undefined

  if (!payload) {
    return false
  }

  switch (value.event) {
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

    default:
      return false
  }
}

export interface VoiceChannel {
  id: string
  name: string
  type: number
  guild_id: string
  parent_id?: string
  user_limit?: number
}

export interface GatewayConfig {
  port: number
  botToken: string
  primaryGuildId: string
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
