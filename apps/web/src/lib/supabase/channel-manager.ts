/**
 * Channel Manager - Manages shared Supabase Realtime channels
 *
 * Ensures that presence and signaling use the same channel instance.
 * A single channel can support both broadcast (signaling) and presence features.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabase } from './client'

export type { RealtimeChannel }

interface ChannelConfig {
  presence?: { key: string }
}

interface ChannelMetadata {
  channel: RealtimeChannel
  subscriptionCount: number
  isSubscribed: boolean
}

class ChannelManager {
  private channels: Map<string, ChannelMetadata> = new Map()

  /**
   * Get or create a channel for a room
   * Multiple managers can share the same channel
   */
  getChannel(roomId: string, config?: ChannelConfig): RealtimeChannel {
    if (!roomId) {
      throw new Error('ChannelManager.getChannel: roomId is required')
    }

    const channelName = `game:${roomId}`
    let metadata = this.channels.get(channelName)

    if (!metadata) {
      console.log('[WebRTC:ChannelManager] Creating new channel:', channelName)
      const channel = supabase.channel(channelName, {
        config: config || {},
      })
      metadata = {
        channel,
        subscriptionCount: 0,
        isSubscribed: false,
      }
      this.channels.set(channelName, metadata)
    } else {
      console.log(
        `[WebRTC:ChannelManager] Reusing existing channel: ${channelName} (subscriptions: ${metadata.subscriptionCount})`,
      )
    }

    return metadata.channel
  }

  /**
   * Mark channel as subscribed
   */
  markSubscribed(roomId: string): void {
    const channelName = `game:${roomId}`
    const metadata = this.channels.get(channelName)
    if (metadata) {
      metadata.subscriptionCount++
      metadata.isSubscribed = true
      console.log(
        `[WebRTC:ChannelManager] Channel ${channelName} subscription count: ${metadata.subscriptionCount}`,
      )
    }
  }

  /**
   * Mark channel as unsubscribed (decrement counter)
   */
  markUnsubscribed(roomId: string): void {
    const channelName = `game:${roomId}`
    const metadata = this.channels.get(channelName)
    if (metadata && metadata.subscriptionCount > 0) {
      metadata.subscriptionCount--
      console.log(
        `[WebRTC:ChannelManager] Channel ${channelName} subscription count: ${metadata.subscriptionCount}`,
      )
    }
  }

  /**
   * Remove a channel reference (only if no active subscriptions)
   */
  removeChannel(roomId: string): void {
    const channelName = `game:${roomId}`
    const metadata = this.channels.get(channelName)

    if (metadata) {
      if (metadata.subscriptionCount > 0) {
        console.log(
          `[WebRTC:ChannelManager] Not removing channel ${channelName} - still has ${metadata.subscriptionCount} active subscription(s)`,
        )
        return
      }

      console.log('[WebRTC:ChannelManager] Removing channel:', channelName)
      supabase.removeChannel(metadata.channel)
      this.channels.delete(channelName)
    }
  }

  /**
   * Check if a channel exists
   */
  hasChannel(roomId: string): boolean {
    const channelName = `game:${roomId}`
    return this.channels.has(channelName)
  }

  /**
   * Get subscription count for a channel
   */
  getSubscriptionCount(roomId: string): number {
    const channelName = `game:${roomId}`
    return this.channels.get(channelName)?.subscriptionCount ?? 0
  }
}

export const channelManager = new ChannelManager()
