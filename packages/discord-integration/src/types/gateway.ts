import { z } from 'zod'

/**
 * Gateway Connection State Schema (v1.0)
 * Tracks WebSocket connection to Discord Gateway
 */
export const GatewayConnectionSchema = z.object({
  version: z.literal('1.0'),
  state: z.enum([
    'disconnected',
    'connecting',
    'connected',
    'reconnecting',
    'error',
  ]),
  sessionId: z.string().optional(),
  sequence: z.number().int().nonnegative().optional(), // Last event sequence number
  heartbeatInterval: z.number().int().positive().optional(), // Milliseconds
  lastHeartbeatAck: z.number().int().optional(), // Timestamp
  reconnectAttempts: z.number().int().nonnegative().default(0),
  url: z.string().url().optional(), // Gateway URL from Discord
})

export type GatewayConnection = z.infer<typeof GatewayConnectionSchema>

/**
 * Voice State Schema (v1.0)
 * User's state in voice channel
 */
export const VoiceStateSchema = z.object({
  version: z.literal('1.0'),
  userId: z.string().regex(/^\d+$/),
  channelId: z.string().regex(/^\d+$/).optional(), // Null if not in voice
  guildId: z.string().regex(/^\d+$/).optional(),
  selfMute: z.boolean(),
  selfDeaf: z.boolean(),
  serverMute: z.boolean(),
  serverDeaf: z.boolean(),
  speaking: z.boolean().optional(), // Computed from audio activity
  videoStreaming: z.boolean().optional(), // True if streaming video
  sessionId: z.string(),
})

export type VoiceState = z.infer<typeof VoiceStateSchema>

/**
 * Video Stream Schema (v1.0)
 * Video feed metadata
 */
export const VideoStreamSchema = z.object({
  version: z.literal('1.0'),
  streamId: z.string(),
  userId: z.string().regex(/^\d+$/), // Source user
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  framerate: z.number().int().positive(),
  bitrate: z.number().int().positive(), // bits per second
  codec: z.string(), // "VP8", "VP9", "H264"
  health: z.object({
    packetLoss: z.number().min(0).max(1), // 0-1 (percentage)
    latency: z.number().int().nonnegative(), // milliseconds
    jitter: z.number().int().nonnegative(), // milliseconds
  }),
})

export type VideoStream = z.infer<typeof VideoStreamSchema>

/**
 * RTC Connection Schema (v1.0)
 * Discord RTC connection state
 */
export const RtcConnectionSchema = z.object({
  version: z.literal('1.0'),
  state: z.enum([
    'disconnected',
    'connecting',
    'connected',
    'reconnecting',
    'error',
  ]),
  channelId: z.string().regex(/^\d+$/),
  udpEndpoint: z
    .object({
      host: z.string(),
      port: z.number().int().positive(),
    })
    .optional(),
  encryptionKey: z.string().optional(), // Base64 encoded
  supportedCodecs: z.array(z.string()),
  qualitySettings: z.object({
    resolution: z.enum(['480p', '720p', '1080p']),
    framerate: z.number().int().positive(),
    bitrate: z.number().int().positive(),
  }),
})

export type RtcConnection = z.infer<typeof RtcConnectionSchema>

/**
 * Stream Quality Type
 */
export const StreamQualitySchema = z.enum(['480p', '720p', '1080p'])
export type StreamQuality = z.infer<typeof StreamQualitySchema>
