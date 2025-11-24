/**
 * Channel Manager - Manages shared Supabase Realtime channels
 *
 * Ensures that presence and signaling use the same channel instance.
 */

import { supabase } from './client'
import type { RealtimeChannel } from '@supabase/supabase-js'

class ChannelManager {
  private channels: Map<string, RealtimeChannel> = new Map()

  /**
   * Get or create a channel for a room
   */
  getChannel(roomId: string, config?: { presence?: { key?: string } }): RealtimeChannel {
    const channelName = `game:${roomId}`

    let channel = this.channels.get(channelName)

    if (!channel) {
      console.log('[WebRTC:ChannelManager] Creating new channel:', channelName)
      channel = supabase.channel(channelName, {
        config: config || {},
      })
      this.channels.set(channelName, channel)
    } else {
      console.log('[WebRTC:ChannelManager] Reusing existing channel:', channelName)
    }

    return channel
  }

  /**
   * Remove a channel reference
   */
  removeChannel(roomId: string): void {
    const channelName = `game:${roomId}`
    const channel = this.channels.get(channelName)

    if (channel) {
      console.log('[WebRTC:ChannelManager] Removing channel:', channelName)
      supabase.removeChannel(channel)
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
}

export const channelManager = new ChannelManager()

