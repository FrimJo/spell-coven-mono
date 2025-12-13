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

    // Only clean up if switching to a different room
    if (this.roomId && this.roomId !== roomId) {
      await this.cleanup()
    }

    this.roomId = roomId
    this.localPeerId = localPeerId

    console.log('[WebRTC:Signaling] Initializing for room:', roomId)

    // Get the channel (may be shared with presence)
    // We don't pass presence config here - let presence handle that
    this.channel = channelManager.getChannel(roomId)

    // Register broadcast listener using channel manager
    // This ensures the listener survives if the channel is recreated by presence
    channelManager.addBroadcastListener(
      roomId,
      'webrtc:signal',
      (payload: { payload: unknown }) => {
        console.log(
          '[WebRTC:Signaling] Received broadcast signal:',
          payload.payload,
        )
        this.handleSignal(payload.payload)
      },
    )

    // Subscribe if not already subscribed
    await this.ensureSubscribed(roomId)

    console.log('[WebRTC:Signaling] Initialization complete')
  }

  /**
   * Ensure channel is subscribed
   */
  private async ensureSubscribed(roomId: string): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized')
    }

    const channelState = this.channel.state

    // Already subscribed
    if (channelState === 'joined') {
      console.log('[WebRTC:Signaling] Channel already joined')
      channelManager.markSubscribed(roomId)
      return
    }

    // Another manager already subscribing
    if (channelManager.getSubscriptionCount(roomId) > 0) {
      console.log('[WebRTC:Signaling] Waiting for existing subscription...')
      await this.waitForChannelReady()
      channelManager.markSubscribed(roomId)
      return
    }

    // We need to subscribe
    console.log('[WebRTC:Signaling] Subscribing to channel...')
    return new Promise<void>((resolve, reject) => {
      if (!this.channel) {
        reject(new Error('Channel became null'))
        return
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Signaling channel subscription timeout (10s)'))
      }, 10000)

      this.channel.subscribe((status, err) => {
        console.log(
          `[WebRTC:Signaling] Subscription status: ${status}`,
          err ? `error: ${err.message}` : '',
        )

        if (status === 'SUBSCRIBED') {
          clearTimeout(timeoutId)
          console.log('[WebRTC:Signaling] Channel subscribed successfully')
          channelManager.markSubscribed(roomId)
          resolve()
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          clearTimeout(timeoutId)
          reject(
            new Error(
              `Signaling subscription failed: ${status}${err ? ` - ${err.message}` : ''}`,
            ),
          )
        }
      })
    })
  }

  /**
   * Wait for channel to be ready
   */
  private async waitForChannelReady(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized')
    }

    if (this.channel.state === 'joined') {
      return
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Signaling channel timeout - state: ${this.channel?.state ?? 'null'}`,
          ),
        )
      }, 5000)

      const checkState = () => {
        if (!this.channel) {
          clearTimeout(timeout)
          reject(new Error('Channel became null'))
          return
        }

        if (this.channel.state === 'joined') {
          clearTimeout(timeout)
          resolve()
        } else if (
          this.channel.state === 'errored' ||
          this.channel.state === 'closed'
        ) {
          clearTimeout(timeout)
          reject(new Error(`Channel failed - state: ${this.channel.state}`))
        } else {
          setTimeout(checkState, 100)
        }
      }

      checkState()
    })
  }

  /**
   * Send a WebRTC signal
   */
  async send(signal: WebRTCSignal): Promise<void> {
    if (!this.channel) {
      throw new Error('SignalingManager.send: not initialized')
    }

    if (!this.roomId) {
      throw new Error('SignalingManager.send: roomId is not set')
    }

    // Validate signal
    const validation = validateWebRTCSignal(signal)
    if (!validation.success) {
      throw validation.error
    }

    const signalWithRoomId: WebRTCSignal = {
      ...validation.data,
      roomId: this.roomId,
    }

    console.log('[WebRTC:Signaling] Sending signal:', signalWithRoomId)

    // Get the current channel from manager in case it was recreated
    const currentChannel = channelManager.peekChannel(this.roomId)
    if (currentChannel && currentChannel !== this.channel) {
      console.log(
        '[WebRTC:Signaling] Channel was recreated, updating reference',
      )
      this.channel = currentChannel
    }

    const response = await this.channel.send({
      type: 'broadcast',
      event: 'webrtc:signal',
      payload: signalWithRoomId,
    })

    console.log('[WebRTC:Signaling] Send response:', response)
    if (response === 'error') {
      throw new Error('Failed to send signal: channel returned error')
    }
  }

  /**
   * Handle incoming signal
   */
  private handleSignal(data: unknown): void {
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

    // Filter: only process signals intended for this peer
    if (signal.to !== this.localPeerId) {
      return
    }

    // Filter: correct room
    if (signal.roomId !== this.roomId) {
      return
    }

    // Filter: not from self
    if (signal.from === this.localPeerId) {
      return
    }

    console.log('[WebRTC:Signaling] Processing signal from:', signal.from)
    this.callbacks.onSignal?.(signal)
  }

  /**
   * Clean up the manager
   */
  async cleanup(): Promise<void> {
    if (this.channel && this.roomId) {
      console.log('[WebRTC:Signaling] Cleaning up for room:', this.roomId)
      channelManager.markUnsubscribed(this.roomId)

      const subscriptionCount = channelManager.getSubscriptionCount(this.roomId)
      if (subscriptionCount === 0) {
        console.log('[WebRTC:Signaling] Last subscription - unsubscribing')
        try {
          await this.channel.unsubscribe()
        } catch (err) {
          console.warn('[WebRTC:Signaling] Error unsubscribing:', err)
        }
        channelManager.removeChannel(this.roomId)
      } else {
        console.log(
          `[WebRTC:Signaling] ${subscriptionCount} subscription(s) remaining`,
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
