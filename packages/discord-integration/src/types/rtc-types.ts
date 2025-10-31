/**
 * Types for Discord RTC (Real-Time Communication) - Voice and Video
 * Based on Discord Voice API specification
 */

import { z } from 'zod'

// ============================================================================
// Connection State
// ============================================================================

export type RtcConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'

export type RtcIceConnectionState =
  | 'new'
  | 'checking'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'disconnected'
  | 'closed'

// ============================================================================
// Media Stream Types
// ============================================================================

export interface AudioStreamConfig {
  codec: 'opus'
  sampleRate: 48000 | 24000 | 16000
  channels: 1 | 2 // mono or stereo
  frameSize: 20 | 40 | 60 // milliseconds
  bitrate?: number // bits per second
}

export interface VideoStreamConfig {
  codec: 'VP8' | 'VP9' | 'H264'
  width: number
  height: number
  framerate: number
  bitrate?: number // bits per second
}

export interface MediaStreamInfo {
  id: string
  type: 'audio' | 'video'
  userId: string
  ssrc: number // Synchronization source identifier
}

// ============================================================================
// Voice Server Info (from Discord Gateway)
// ============================================================================

export const VoiceServerUpdateSchema = z.object({
  token: z.string(),
  guild_id: z.string(),
  endpoint: z.string().nullable(),
})

export type VoiceServerUpdate = z.infer<typeof VoiceServerUpdateSchema>

export const VoiceStateUpdateSchema = z.object({
  guild_id: z.string().optional(),
  channel_id: z.string().nullable(),
  user_id: z.string(),
  member: z.unknown().optional(),
  session_id: z.string(),
  deaf: z.boolean(),
  mute: z.boolean(),
  self_deaf: z.boolean(),
  self_mute: z.boolean(),
  self_stream: z.boolean().optional(),
  self_video: z.boolean(),
  suppress: z.boolean(),
  request_to_speak_timestamp: z.string().nullable(),
})

export type VoiceStateUpdate = z.infer<typeof VoiceStateUpdateSchema>

// ============================================================================
// Voice Gateway Opcodes
// ============================================================================

export enum VoiceOpcode {
  Identify = 0,
  SelectProtocol = 1,
  Ready = 2,
  Heartbeat = 3,
  SessionDescription = 4,
  Speaking = 5,
  HeartbeatAck = 6,
  Resume = 7,
  Hello = 8,
  Resumed = 9,
  ClientDisconnect = 13,
}

// ============================================================================
// Voice Gateway Payloads
// ============================================================================

export interface VoiceIdentifyPayload {
  server_id: string
  user_id: string
  session_id: string
  token: string
}

export interface VoiceSelectProtocolPayload {
  protocol: 'udp'
  data: {
    address: string
    port: number
    mode: string // encryption mode
  }
}

export interface VoiceReadyPayload {
  ssrc: number
  ip: string
  port: number
  modes: string[]
  heartbeat_interval: number
}

export interface VoiceSessionDescriptionPayload {
  mode: string
  secret_key: number[]
}

export interface VoiceSpeakingPayload {
  speaking: number // bitfield: 1 = microphone, 2 = soundshare, 4 = priority
  delay: number
  ssrc: number
  user_id?: string
}

export interface VoiceHelloPayload {
  heartbeat_interval: number
}

// ============================================================================
// RTP (Real-time Transport Protocol) Types
// ============================================================================

export interface RtpHeader {
  version: number
  padding: boolean
  extension: boolean
  csrcCount: number
  marker: boolean
  payloadType: number
  sequenceNumber: number
  timestamp: number
  ssrc: number
}

export interface RtpPacket {
  header: RtpHeader
  payload: Uint8Array
}

// ============================================================================
// Encryption
// ============================================================================

export type EncryptionMode =
  | 'xsalsa20_poly1305'
  | 'xsalsa20_poly1305_suffix'
  | 'xsalsa20_poly1305_lite'

export interface EncryptionConfig {
  mode: EncryptionMode
  secretKey: Uint8Array
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface DiscordRtcClientConfig {
  guildId: string
  userId: string
  sessionId: string
  token: string
  endpoint: string

  // Optional configurations
  audioConfig?: Partial<AudioStreamConfig>
  videoConfig?: Partial<VideoStreamConfig>
  encryptionMode?: EncryptionMode

  // Callbacks
  onConnectionStateChange?: (state: RtcConnectionState) => void
  onAudioReceived?: (userId: string, audioData: Uint8Array) => void
  onVideoReceived?: (userId: string, videoFrame: VideoFrame) => void
  onUserJoined?: (userId: string) => void
  onUserLeft?: (userId: string) => void
  onError?: (error: Error) => void
}

// ============================================================================
// Speaking State
// ============================================================================

export enum SpeakingFlags {
  None = 0,
  Microphone = 1 << 0,
  Soundshare = 1 << 1,
  Priority = 1 << 2,
}
