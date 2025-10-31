/**
 * Discord RTC Client (Real-Time Communication)
 *
 * Handles voice and video streaming to/from Discord voice channels using:
 * - WebRTC for browser-based media handling
 * - Discord Voice Gateway WebSocket for signaling
 * - UDP for media transport
 * - Opus codec for audio (48kHz)
 * - VP8/VP9/H264 codecs for video
 * - xsalsa20_poly1305 encryption
 *
 * Note: This is a browser-compatible implementation using WebRTC APIs.
 * For Node.js, you would need additional libraries like node-opus, sodium-native, etc.
 */

import type {
  AudioStreamConfig,
  DiscordRtcClientConfig,
  EncryptionMode,
  RtcConnectionState,
  VideoStreamConfig,
  VoiceHelloPayload,
  VoiceReadyPayload,
  VoiceSessionDescriptionPayload,
  VoiceSpeakingPayload,
} from '../types/rtc-types.js'
import { SpeakingFlags, VoiceOpcode } from '../types/rtc-types.js'

const DEFAULT_AUDIO_CONFIG: AudioStreamConfig = {
  codec: 'opus',
  sampleRate: 48000,
  channels: 2,
  frameSize: 20,
}

const DEFAULT_VIDEO_CONFIG: VideoStreamConfig = {
  codec: 'VP8',
  width: 1280,
  height: 720,
  framerate: 30,
}

export class DiscordRtcClient {
  private config: DiscordRtcClientConfig
  private connectionState: RtcConnectionState = 'disconnected'

  // WebSocket connection to Discord Voice Gateway
  private ws: WebSocket | null = null
  private heartbeatInterval: number | null = null

  // WebRTC peer connection
  private peerConnection: RTCPeerConnection | null = null

  // Media streams
  private localAudioStream: MediaStream | null = null
  private localVideoStream: MediaStream | null = null
  private remoteStreams: Map<string, MediaStream> = new Map()

  // Voice state
  private ssrc: number | null = null
  private _secretKey: Uint8Array | null = null
  private encryptionMode: EncryptionMode = 'xsalsa20_poly1305'

  // Audio/Video configuration
  private _audioConfig: AudioStreamConfig
  private videoConfig: VideoStreamConfig

  constructor(config: DiscordRtcClientConfig) {
    this.config = config
    this._audioConfig = { ...DEFAULT_AUDIO_CONFIG, ...config.audioConfig }
    this.videoConfig = { ...DEFAULT_VIDEO_CONFIG, ...config.videoConfig }

    if (config.encryptionMode) {
      this.encryptionMode = config.encryptionMode
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Connect to a Discord voice channel
   */
  async connect(_channelId: string): Promise<void> {
    if (this.connectionState !== 'disconnected') {
      throw new Error('Already connected or connecting')
    }

    this.setConnectionState('connecting')

    try {
      // Connect to Discord Voice Gateway WebSocket
      await this.connectVoiceGateway()

      // Initialize WebRTC peer connection
      this.initializePeerConnection()

      this.setConnectionState('connected')
    } catch (error) {
      this.setConnectionState('failed')
      if (this.config.onError) {
        this.config.onError(
          error instanceof Error ? error : new Error('Connection failed'),
        )
      }
      throw error
    }
  }

  /**
   * Disconnect from the voice channel
   */
  disconnect(): void {
    this.cleanup()
    this.setConnectionState('disconnected')
  }

  /**
   * Send audio stream to Discord
   */
  async sendAudio(stream: MediaStream): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Not connected')
    }

    this.localAudioStream = stream

    // Add audio tracks to peer connection
    const audioTracks = stream.getAudioTracks()
    for (const track of audioTracks) {
      this.peerConnection.addTrack(track, stream)
    }

    // Set speaking state
    await this.setSpeaking(SpeakingFlags.Microphone, true)
  }

  /**
   * Send video stream to Discord (webcam for board state)
   */
  async sendVideo(stream: MediaStream): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Not connected')
    }

    this.localVideoStream = stream

    // Add video tracks to peer connection
    const videoTracks = stream.getVideoTracks()
    for (const track of videoTracks) {
      // Configure video encoding parameters
      const sender = this.peerConnection.addTrack(track, stream)
      const parameters = sender.getParameters()

      if (parameters.encodings && parameters.encodings.length > 0) {
        const encoding = parameters.encodings[0]
        if (encoding) {
          if (this.videoConfig.bitrate !== undefined) {
            encoding.maxBitrate = this.videoConfig.bitrate
          }
          if (this.videoConfig.framerate !== undefined) {
            encoding.maxFramerate = this.videoConfig.framerate
          }
          await sender.setParameters(parameters)
        }
      }
    }
  }

  /**
   * Stop sending audio
   */
  stopAudio(): void {
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((track) => track.stop())
      this.localAudioStream = null
    }

    this.setSpeaking(SpeakingFlags.Microphone, false)
  }

  /**
   * Stop sending video
   */
  stopVideo(): void {
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach((track) => track.stop())
      this.localVideoStream = null
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): RtcConnectionState {
    return this.connectionState
  }

  /**
   * Get encryption info (for debugging/monitoring)
   * @internal
   */
  getEncryptionInfo(): { mode: EncryptionMode; hasKey: boolean } {
    return {
      mode: this.encryptionMode,
      hasKey: this._secretKey !== null,
    }
  }

  /**
   * Get audio configuration
   * @internal
   */
  getAudioConfig(): AudioStreamConfig {
    return { ...this._audioConfig }
  }

  // ============================================================================
  // Voice Gateway WebSocket
  // ============================================================================

  private async connectVoiceGateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://${this.config.endpoint}/?v=4`
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('[DiscordRtcClient] Voice Gateway connected')
        this.sendIdentify()
      }

      this.ws.onmessage = (event) => {
        this.handleVoiceGatewayMessage(event.data, resolve, reject)
      }

      this.ws.onerror = (error) => {
        console.error('[DiscordRtcClient] Voice Gateway error:', error)
        reject(new Error('Voice Gateway connection failed'))
      }

      this.ws.onclose = () => {
        console.log('[DiscordRtcClient] Voice Gateway closed')
        this.cleanup()
      }
    })
  }

  private handleVoiceGatewayMessage(
    data: string,
    resolve: () => void,
    reject: (error: Error) => void,
  ): void {
    try {
      const payload = JSON.parse(data)
      const { op, d } = payload

      switch (op) {
        case VoiceOpcode.Hello:
          this.handleHello(d as VoiceHelloPayload)
          break

        case VoiceOpcode.Ready:
          this.handleReady(d as VoiceReadyPayload, resolve)
          break

        case VoiceOpcode.SessionDescription:
          this.handleSessionDescription(d as VoiceSessionDescriptionPayload)
          break

        case VoiceOpcode.Speaking:
          this.handleSpeaking(d as VoiceSpeakingPayload)
          break

        case VoiceOpcode.HeartbeatAck:
          // Heartbeat acknowledged
          break

        case VoiceOpcode.ClientDisconnect:
          this.handleClientDisconnect(d)
          break

        default:
          console.log('[DiscordRtcClient] Unknown opcode:', op)
      }
    } catch (error) {
      console.error('[DiscordRtcClient] Failed to handle message:', error)
      reject(
        error instanceof Error ? error : new Error('Message handling failed'),
      )
    }
  }

  private sendIdentify(): void {
    if (!this.ws) return

    this.ws.send(
      JSON.stringify({
        op: VoiceOpcode.Identify,
        d: {
          server_id: this.config.guildId,
          user_id: this.config.userId,
          session_id: this.config.sessionId,
          token: this.config.token,
        },
      }),
    )
  }

  private handleHello(data: VoiceHelloPayload): void {
    console.log('[DiscordRtcClient] Received HELLO, starting heartbeat')

    // Start heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            op: VoiceOpcode.Heartbeat,
            d: Date.now(),
          }),
        )
      }
    }, data.heartbeat_interval)
  }

  private handleReady(data: VoiceReadyPayload, resolve: () => void): void {
    console.log('[DiscordRtcClient] Received READY')

    this.ssrc = data.ssrc

    // Select protocol (UDP)
    if (this.ws) {
      this.ws.send(
        JSON.stringify({
          op: VoiceOpcode.SelectProtocol,
          d: {
            protocol: 'udp',
            data: {
              address: data.ip,
              port: data.port,
              mode: this.encryptionMode,
            },
          },
        }),
      )
    }

    resolve()
  }

  private handleSessionDescription(data: VoiceSessionDescriptionPayload): void {
    console.log('[DiscordRtcClient] Received SESSION_DESCRIPTION')

    // Store encryption key
    this._secretKey = new Uint8Array(data.secret_key)

    console.log('[DiscordRtcClient] Voice connection established')
  }

  private handleSpeaking(data: VoiceSpeakingPayload): void {
    if (data.user_id && this.config.onUserJoined) {
      const isSpeaking = (data.speaking & SpeakingFlags.Microphone) !== 0
      if (isSpeaking) {
        console.log(`[DiscordRtcClient] User ${data.user_id} started speaking`)
      }
    }
  }

  private handleClientDisconnect(data: { user_id: string }): void {
    console.log(`[DiscordRtcClient] User ${data.user_id} disconnected`)

    this.remoteStreams.delete(data.user_id)

    if (this.config.onUserLeft) {
      this.config.onUserLeft(data.user_id)
    }
  }

  private async setSpeaking(
    flags: SpeakingFlags,
    speaking: boolean,
  ): Promise<void> {
    if (!this.ws || !this.ssrc) return

    this.ws.send(
      JSON.stringify({
        op: VoiceOpcode.Speaking,
        d: {
          speaking: speaking ? flags : 0,
          delay: 0,
          ssrc: this.ssrc,
        },
      }),
    )
  }

  // ============================================================================
  // WebRTC Peer Connection
  // ============================================================================

  private initializePeerConnection(): void {
    // Create peer connection with STUN servers
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    })

    // Handle incoming tracks (audio/video from other users)
    this.peerConnection.ontrack = (event) => {
      console.log('[DiscordRtcClient] Received remote track:', event.track.kind)

      const stream = event.streams[0]
      if (stream) {
        // Store remote stream
        // Note: In a real implementation, you'd need to map this to a Discord user ID
        // This would come from the SSRC in the RTP packets
        this.remoteStreams.set('remote-user', stream)

        if (event.track.kind === 'audio' && this.config.onAudioReceived) {
          // Handle audio data
          // Note: Actual audio data extraction would require MediaRecorder or AudioWorklet
        }

        if (event.track.kind === 'video' && this.config.onVideoReceived) {
          // Handle video frames
          // Note: Actual video frame extraction would require canvas or VideoFrame API
        }
      }
    }

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        console.log(
          '[DiscordRtcClient] ICE connection state:',
          this.peerConnection.iceConnectionState,
        )

        if (this.peerConnection.iceConnectionState === 'failed') {
          this.setConnectionState('failed')
        } else if (this.peerConnection.iceConnectionState === 'disconnected') {
          this.setConnectionState('reconnecting')
        }
      }
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  private cleanup(): void {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    // Stop local streams
    this.stopAudio()
    this.stopVideo()

    // Clear remote streams
    this.remoteStreams.clear()

    // Reset state
    this.ssrc = null
    this._secretKey = null
  }

  private setConnectionState(state: RtcConnectionState): void {
    this.connectionState = state

    if (this.config.onConnectionStateChange) {
      this.config.onConnectionStateChange(state)
    }
  }
}
