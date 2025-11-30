/**
 * Presence Manager - Manages Supabase Presence API for game room participants
 *
 * Isolated from React hooks for testability and reusability.
 * Uses shared ChannelManager to reuse channels across presence and signaling.
 */

import type { Participant } from '@/types/participant'
import type {
  RealtimeChannel,
  RealtimePresenceState,
} from '@supabase/supabase-js'

import type { SupabasePresenceState } from './types'
import { channelManager } from './channel-manager'
import { validatePresenceState } from './types'

export interface PresenceManagerCallbacks {
  onParticipantsUpdate?: (participants: Participant[]) => void
  onError?: (error: Error) => void
}

export class PresenceManager {
  private channel: RealtimeChannel | null = null
  private roomId: string | null = null
  private callbacks: PresenceManagerCallbacks = {}

  constructor(callbacks: PresenceManagerCallbacks = {}) {
    this.callbacks = callbacks
  }

  /**
   * Join a room with presence
   */
  async join(
    roomId: string,
    userId: string,
    username: string,
    avatar?: string | null,
  ): Promise<void> {
    await this.leave()

    this.roomId = roomId
    this.channel = channelManager.getChannel(roomId, {
      presence: { key: userId },
    })

    // Subscribe to presence changes
    this.channel.on('presence', { event: 'sync' }, () => {
      this.handlePresenceSync()
    })

    this.channel.on('presence', { event: 'join' }, () => {
      this.handlePresenceSync()
    })

    this.channel.on('presence', { event: 'leave' }, () => {
      this.handlePresenceSync()
    })

    // Subscribe to channel (required before tracking presence)
    const subscriptionCount = channelManager.getSubscriptionCount(roomId)

    if (subscriptionCount === 0) {
      await this.subscribeToChannel(roomId)
    } else {
      channelManager.markSubscribed(roomId)
      await this.waitForChannelReady()
    }

    // Track presence state
    await this.trackPresence({ userId, username, avatar, joinedAt: Date.now() })
    this.handlePresenceSync()
  }

  /**
   * Subscribe to the channel
   */
  private async subscribeToChannel(roomId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.channel!.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          channelManager.markSubscribed(roomId)
          resolve()
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          reject(
            new Error(
              `Failed to subscribe to presence channel: ${status}${err ? ` - ${err.message}` : ''}`,
            ),
          )
        }
      })
    })
  }

  /**
   * Wait for channel to be in 'joined' state
   */
  private async waitForChannelReady(): Promise<void> {
    if (this.channel!.state === 'joined') return

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Channel subscription timeout - state: ${this.channel!.state}`,
          ),
        )
      }, 5000)

      const checkState = () => {
        if (this.channel!.state === 'joined') {
          clearTimeout(timeout)
          resolve()
        } else if (
          this.channel!.state === 'errored' ||
          this.channel!.state === 'closed'
        ) {
          clearTimeout(timeout)
          reject(
            new Error(
              `Channel subscription failed - state: ${this.channel!.state}`,
            ),
          )
        } else {
          setTimeout(checkState, 100)
        }
      }

      checkState()
    })
  }

  /**
   * Track presence state with timeout
   */
  private async trackPresence(state: SupabasePresenceState): Promise<void> {
    const trackPromise = this.channel!.track(state)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Presence track timeout after 10s')),
        10000,
      )
    })

    const result = await Promise.race([trackPromise, timeoutPromise])

    if (result === 'error') {
      throw new Error('Failed to track presence: channel returned error')
    }
  }

  /**
   * Leave the current room
   */
  async leave(): Promise<void> {
    if (this.channel && this.roomId) {
      await this.channel.untrack()

      channelManager.markUnsubscribed(this.roomId)

      const subscriptionCount = channelManager.getSubscriptionCount(this.roomId)
      if (subscriptionCount === 0) {
        await this.channel.unsubscribe()
        channelManager.removeChannel(this.roomId)
      }

      this.channel = null
    }
    this.roomId = null
  }

  /**
   * Parse presence state into participants array
   */
  private parsePresenceState(
    presence: RealtimePresenceState<Record<string, unknown>>,
  ): Participant[] {
    const participants: Participant[] = []

    for (const [_presenceKey, presences] of Object.entries(presence)) {
      const rawState = presences[0]

      if (!rawState) continue

      const validation = validatePresenceState(rawState)
      if (!validation.success) {
        this.callbacks.onError?.(validation.error)
        continue
      }

      const state = validation.data
      participants.push({
        id: state.userId,
        username: state.username,
        avatar: state.avatar,
        joinedAt: state.joinedAt,
      })
    }

    return participants.sort((a, b) => a.joinedAt - b.joinedAt)
  }

  /**
   * Handle presence sync event
   */
  private handlePresenceSync(): void {
    if (!this.channel) return

    const presence = this.channel.presenceState()
    const participants = this.parsePresenceState(presence)
    this.callbacks.onParticipantsUpdate?.(participants)
  }

  /**
   * Get current participants
   */
  getParticipants(): Participant[] {
    if (!this.channel) return []

    const presence = this.channel.presenceState()
    return this.parsePresenceState(presence)
  }

  /**
   * Destroy the manager
   */
  async destroy(): Promise<void> {
    await this.leave()
    this.callbacks = {}
  }
}
