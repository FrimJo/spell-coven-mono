/**
 * Channel Manager - Manages shared Supabase Realtime channels
 *
 * Ensures that presence and signaling use the same channel instance.
 * A single channel can support both broadcast (signaling) and presence features.
 *
 * Key design decisions:
 * - Channels are created lazily on first request
 * - Presence key is set at channel creation and persisted
 * - Broadcast listeners are tracked and survive channel recreation
 * - Simple get-or-create pattern with minimal complexity
 */

import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabase } from './client'

export type { RealtimeChannel }

interface ChannelConfig {
  presence?: { key: string }
}

interface BroadcastListener {
  event: string
  callback: (payload: { payload: unknown }) => void
}

interface ChannelMetadata {
  channel: RealtimeChannel
  subscriptionCount: number
  isSubscribed: boolean
  presenceKey: string
  broadcastListeners: BroadcastListener[]
}

class ChannelManager {
  private channels: Map<string, ChannelMetadata> = new Map()

  /**
   * Get or create a channel for a room.
   *
   * If the channel doesn't exist, it's created with the provided presence config.
   * If the channel exists but with a different presence key, it's recreated
   * and all broadcast listeners are automatically re-registered.
   */
  getChannel(roomId: string, config?: ChannelConfig): RealtimeChannel {
    if (!roomId) {
      throw new Error('ChannelManager.getChannel: roomId is required')
    }

    const channelName = `game:${roomId}`
    const requestedKey = config?.presence?.key ?? `default-${roomId}`
    const existingMetadata = this.channels.get(channelName)

    // Case 1: No existing channel - create new one
    if (!existingMetadata) {
      return this.createChannel(channelName, roomId, requestedKey)
    }

    // Case 2: Channel exists with same presence key - reuse it
    if (existingMetadata.presenceKey === requestedKey) {
      console.log(
        `[ChannelManager] Reusing channel: ${channelName} (key: ${requestedKey}, state: ${existingMetadata.channel.state})`,
      )
      return existingMetadata.channel
    }

    // Case 3: Channel exists with default key, and a specific key is requested
    // This happens when signaling creates channel first, then presence needs its session key
    const isDefaultKey = existingMetadata.presenceKey === `default-${roomId}`
    const isSpecificKeyRequested = requestedKey !== `default-${roomId}`

    if (isDefaultKey && isSpecificKeyRequested) {
      // Only recreate if channel is not yet subscribed (safe to recreate)
      if (!existingMetadata.isSubscribed) {
        console.log(
          `[ChannelManager] Upgrading channel ${channelName} from default key to: ${requestedKey}`,
        )
        return this.recreateChannel(
          channelName,
          roomId,
          requestedKey,
          existingMetadata,
        )
      } else {
        // Channel is already subscribed - too late to change key
        // This is a timing issue that should be fixed at the application level
        console.warn(
          `[ChannelManager] Cannot upgrade presence key for ${channelName} - channel already subscribed. ` +
            `Using existing key: ${existingMetadata.presenceKey}`,
        )
        return existingMetadata.channel
      }
    }

    // Case 4: Channel exists with a specific key, but different key requested
    // This shouldn't happen in normal flow - log warning and reuse existing
    console.warn(
      `[ChannelManager] Channel ${channelName} exists with key ${existingMetadata.presenceKey}, ` +
        `but key ${requestedKey} was requested. Using existing channel.`,
    )
    return existingMetadata.channel
  }

  /**
   * Create a new channel with the specified presence key
   */
  private createChannel(
    channelName: string,
    roomId: string,
    presenceKey: string,
  ): RealtimeChannel {
    console.log(
      `[ChannelManager] Creating channel: ${channelName} (key: ${presenceKey})`,
    )

    const channel = supabase.channel(channelName, {
      config: { presence: { key: presenceKey } },
    })

    const metadata: ChannelMetadata = {
      channel,
      subscriptionCount: 0,
      isSubscribed: false,
      presenceKey,
      broadcastListeners: [],
    }

    this.channels.set(channelName, metadata)
    return channel
  }

  /**
   * Recreate a channel with a new presence key, preserving broadcast listeners
   */
  private recreateChannel(
    channelName: string,
    roomId: string,
    newPresenceKey: string,
    oldMetadata: ChannelMetadata,
  ): RealtimeChannel {
    // Store listeners before destroying old channel
    const listenersToRestore = [...oldMetadata.broadcastListeners]

    // Remove old channel
    console.log(
      `[ChannelManager] Removing old channel: ${channelName} (had ${listenersToRestore.length} broadcast listeners)`,
    )
    supabase.removeChannel(oldMetadata.channel)
    this.channels.delete(channelName)

    // Create new channel
    const newChannel = this.createChannel(channelName, roomId, newPresenceKey)

    // Restore broadcast listeners on new channel
    if (listenersToRestore.length > 0) {
      console.log(
        `[ChannelManager] Restoring ${listenersToRestore.length} broadcast listeners`,
      )
      const newMetadata = this.channels.get(channelName)
      if (newMetadata) {
        for (const listener of listenersToRestore) {
          newChannel.on(
            'broadcast',
            { event: listener.event },
            listener.callback,
          )
          newMetadata.broadcastListeners.push(listener)
        }
      }
    }

    return newChannel
  }

  /**
   * Register a broadcast listener on a channel.
   * The listener will be automatically re-registered if the channel is recreated.
   */
  addBroadcastListener(
    roomId: string,
    event: string,
    callback: (payload: { payload: unknown }) => void,
  ): void {
    const channelName = `game:${roomId}`
    const metadata = this.channels.get(channelName)

    if (!metadata) {
      console.warn(
        `[ChannelManager] Cannot add broadcast listener - channel ${channelName} doesn't exist`,
      )
      return
    }

    // Check if this exact listener is already registered
    const alreadyRegistered = metadata.broadcastListeners.some(
      (l) => l.event === event && l.callback === callback,
    )

    if (!alreadyRegistered) {
      metadata.channel.on('broadcast', { event }, callback)
      metadata.broadcastListeners.push({ event, callback })
      console.log(
        `[ChannelManager] Added broadcast listener for event: ${event}`,
      )
    }
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
        `[ChannelManager] Channel ${channelName} subscribed (count: ${metadata.subscriptionCount})`,
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
        `[ChannelManager] Channel ${channelName} unsubscribed (count: ${metadata.subscriptionCount})`,
      )
    }
  }

  /**
   * Remove a channel (only if no active subscriptions)
   */
  removeChannel(roomId: string): void {
    const channelName = `game:${roomId}`
    const metadata = this.channels.get(channelName)

    if (!metadata) {
      return
    }

    if (metadata.subscriptionCount > 0) {
      console.log(
        `[ChannelManager] Not removing ${channelName} - ${metadata.subscriptionCount} active subscription(s)`,
      )
      return
    }

    console.log(`[ChannelManager] Removing channel: ${channelName}`)
    supabase.removeChannel(metadata.channel)
    this.channels.delete(channelName)
  }

  /**
   * Check if a channel exists
   */
  hasChannel(roomId: string): boolean {
    return this.channels.has(`game:${roomId}`)
  }

  /**
   * Get subscription count for a channel
   */
  getSubscriptionCount(roomId: string): number {
    return this.channels.get(`game:${roomId}`)?.subscriptionCount ?? 0
  }

  /**
   * Check if channel is subscribed
   */
  isSubscribed(roomId: string): boolean {
    return this.channels.get(`game:${roomId}`)?.isSubscribed ?? false
  }

  /**
   * Get the current channel for a room (if exists)
   * This is useful for checking channel state without triggering creation
   */
  peekChannel(roomId: string): RealtimeChannel | null {
    return this.channels.get(`game:${roomId}`)?.channel ?? null
  }
}

export const channelManager = new ChannelManager()
