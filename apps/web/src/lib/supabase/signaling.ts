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
    console.log('[WebRTC:Signaling] Creating channel:', channelName)
    this.channel = supabase.channel(channelName)

    // Subscribe to broadcast events
    this.channel.on('broadcast', { event: 'webrtc:signal' }, (payload) => {
      console.log(
        '[WebRTC:Signaling] Received broadcast signal:',
        payload.payload,
      )
      this.handleSignal(payload.payload)
    })

    // Subscribe to channel
    await new Promise<void>((resolve, reject) => {
      this.channel!.subscribe((subscribeStatus, err) => {
        console.log(
          `[WebRTC:Signaling] Subscription status: ${subscribeStatus}`,
          err ? `error: ${err.message}` : '',
        )
        if (subscribeStatus === 'SUBSCRIBED') {
          console.log('[WebRTC:Signaling] Channel subscribed successfully')
          resolve()
        } else if (
          subscribeStatus === 'CHANNEL_ERROR' ||
          subscribeStatus === 'TIMED_OUT' ||
          subscribeStatus === 'CLOSED'
        ) {
          reject(
            new Error(
              `Failed to subscribe to signaling channel: ${subscribeStatus}${err ? ` - ${err.message}` : ''}`,
            ),
          )
        }
      })
    })
    console.log('[WebRTC:Signaling] Initialization complete')
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

    console.log('[WebRTC:Signaling] Sending signal:', signalWithRoomId)
    const response = await this.channel.send({
      type: 'broadcast',
      event: 'webrtc:signal',
      payload: signalWithRoomId,
    })

    console.log('[WebRTC:Signaling] Send response:', response)
    if (response === 'error') {
      throw new Error('Failed to send signal: channel send returned error')
    }
  }

  /**
   * Handle incoming signal
   */
  private handleSignal(data: unknown): void {
    console.log(
      `[WebRTC:Signaling] Handling signal, localPeerId: ${this.localPeerId}, roomId: ${this.roomId}`,
    )
    const validation = validateWebRTCSignal(data)
    if (!validation.success) {
      console.error('[WebRTC:Signaling] Signal validation failed:', validation.error)
      this.callbacks.onError?.(validation.error)
      return
    }

    const signal = validation.data
    console.log('[WebRTC:Signaling] Validated signal:', signal)

    // Filter signals: only process signals intended for this peer
    if (signal.to !== this.localPeerId) {
      console.log(
        `[WebRTC:Signaling] Ignoring signal - not for this peer. Expected: ${this.localPeerId}, Got: ${signal.to}`,
      )
      return
    }

    // Filter by roomId
    if (signal.roomId !== this.roomId) {
      console.log(
        `[WebRTC:Signaling] Ignoring signal - wrong room. Expected: ${this.roomId}, Got: ${signal.roomId}`,
      )
      return
    }

    // Ignore signals from self
    if (signal.from === this.localPeerId) {
      console.log('[WebRTC:Signaling] Ignoring signal - from self')
      return
    }

    console.log('[WebRTC:Signaling] Passing signal to callback:', signal)
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
