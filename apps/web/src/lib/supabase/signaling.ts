/**
 * Signaling Manager - Manages WebRTC signal broadcast/receive via Supabase Realtime
 *
 * Isolated from React hooks for testability and reusability.
 */

import type { WebRTCSignal } from '@/types/webrtc-signal'
import { validateWebRTCSignal } from '@/types/webrtc-signal'
import { supabase } from './client'

export interface SignalingManagerCallbacks {
  onSignal?: (signal: WebRTCSignal) => void
  onError?: (error: Error) => void
}

export class SignalingManager {
  private channel: ReturnType<typeof supabase.channel> | null = null
  private localPeerId: string | null = null
  private roomId: string | null = null
  private callbacks: SignalingManagerCallbacks = {}

  constructor(callbacks: SignalingManagerCallbacks = {}) {
    this.callbacks = callbacks
  }

  /**
   * Initialize signaling for a room
   */
  async initialize(roomId: string, localPeerId: string): Promise<void> {
    if (!roomId) {
      throw new Error('SignalingManager.initialize: roomId is required')
    }
    if (!localPeerId) {
      throw new Error('SignalingManager.initialize: localPeerId is required')
    }

    // Clean up previous channel
    await this.cleanup()

    this.roomId = roomId
    this.localPeerId = localPeerId

    const channelName = `game:${roomId}`
    this.channel = supabase.channel(channelName)

    // Subscribe to broadcast events
    this.channel.on(
      'broadcast',
      { event: 'webrtc:signal' },
      (payload) => {
        this.handleSignal(payload.payload)
      },
    )

    // Subscribe to channel
    const status = await this.channel.subscribe()
    if (status === 'SUBSCRIBED') {
      // Channel subscribed successfully
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      throw new Error(`Failed to subscribe to signaling channel: ${status}`)
    }
  }

  /**
   * Send a WebRTC signal
   */
  async send(signal: WebRTCSignal): Promise<void> {
    if (!this.channel) {
      throw new Error('SignalingManager.send: not initialized')
    }

    // Validate signal
    const validation = validateWebRTCSignal(signal)
    if (!validation.success) {
      throw validation.error
    }

    // Ensure signal has correct roomId
    const signalWithRoomId: WebRTCSignal = {
      ...validation.data,
      roomId: this.roomId!,
    }

    const response = await this.channel.send({
      type: 'broadcast',
      event: 'webrtc:signal',
      payload: signalWithRoomId,
    })

    if (response === 'error') {
      throw new Error('Failed to send signal: channel send returned error')
    }
  }

  /**
   * Handle incoming signal
   */
  private handleSignal(data: unknown): void {
    const validation = validateWebRTCSignal(data)
    if (!validation.success) {
      this.callbacks.onError?.(validation.error)
      return
    }

    const signal = validation.data

    // Filter signals: only process signals intended for this peer
    if (signal.to !== this.localPeerId) {
      return
    }

    // Filter by roomId
    if (signal.roomId !== this.roomId) {
      return
    }

    // Ignore signals from self
    if (signal.from === this.localPeerId) {
      return
    }

    this.callbacks.onSignal?.(signal)
  }

  /**
   * Clean up the manager
   */
  async cleanup(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe()
      supabase.removeChannel(this.channel)
      this.channel = null
    }
    this.localPeerId = null
    this.roomId = null
  }

  /**
   * Destroy the manager
   */
  async destroy(): Promise<void> {
    await this.cleanup()
    this.callbacks = {}
  }
}

