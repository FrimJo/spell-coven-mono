/**
 * Signaling Manager - Manages WebRTC signal broadcast/receive via Supabase Realtime
 *
 * Isolated from React hooks for testability and reusability.
 * Uses shared ChannelManager to reuse channels across presence and signaling.
 */

import type { WebRTCSignal } from '@/types/webrtc-signal'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { validateWebRTCSignal } from '@/types/webrtc-signal'

import { channelManager } from './channel-manager'

export interface SignalingManagerCallbacks {
  onSignal?: (signal: WebRTCSignal) => void
  onError?: (error: Error) => void
}

export class SignalingManager {
  private channel: RealtimeChannel | null = null
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

    console.log('[WebRTC:Signaling] Getting shared channel for room:', roomId)
    this.channel = channelManager.getChannel(roomId)

    // Subscribe to broadcast events
    this.channel.on('broadcast', { event: 'webrtc:signal' }, (payload) => {
      console.log(
        '[WebRTC:Signaling] Received broadcast signal:',
        payload.payload,
      )
      this.handleSignal(payload.payload)
    })

    // Subscribe to channel (only if not already subscribed by another manager)
    const subscriptionCount = channelManager.getSubscriptionCount(roomId)
    console.log(
      `[WebRTC:Signaling] Current subscriptions for room ${roomId}: ${subscriptionCount}`,
    )

    if (subscriptionCount === 0) {
      if (!this.channel) {
        throw new Error(
          'SignalingManager.initialize: channel is not initialized',
        )
      }
      const channel = this.channel
      console.log('[WebRTC:Signaling] Subscribing to channel...')
      await new Promise<void>((resolve, reject) => {
        channel.subscribe((subscribeStatus, err) => {
          console.log(
            `[WebRTC:Signaling] Subscription status: ${subscribeStatus}`,
            err ? `error: ${err.message}` : '',
          )
          if (subscribeStatus === 'SUBSCRIBED') {
            console.log('[WebRTC:Signaling] Channel subscribed successfully')
            channelManager.markSubscribed(roomId)
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
    } else {
      console.log(
        '[WebRTC:Signaling] Channel already subscribed, marking subscription',
      )
      channelManager.markSubscribed(roomId)
    }

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
    if (!this.roomId) {
      throw new Error('SignalingManager.send: roomId is not set')
    }
    const signalWithRoomId: WebRTCSignal = {
      ...validation.data,
      roomId: this.roomId,
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
      console.error(
        '[WebRTC:Signaling] Signal validation failed:',
        validation.error,
      )
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
    if (this.channel && this.roomId) {
      console.log(
        '[WebRTC:Signaling] Cleaning up channel for room:',
        this.roomId,
      )
      channelManager.markUnsubscribed(this.roomId)

      // Only unsubscribe if this was the last subscription
      const subscriptionCount = channelManager.getSubscriptionCount(this.roomId)
      if (subscriptionCount === 0) {
        console.log('[WebRTC:Signaling] Last subscription - unsubscribing')
        await this.channel.unsubscribe()
        channelManager.removeChannel(this.roomId)
      } else {
        console.log(
          `[WebRTC:Signaling] Not unsubscribing - ${subscriptionCount} subscription(s) remaining`,
        )
      }

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
