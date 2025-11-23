/**
 * Presence Manager - Manages Supabase Presence API for game room participants
 *
 * Isolated from React hooks for testability and reusability.
 */

import type { Participant } from '@/types/participant'
import type { SupabasePresenceState } from './types'
import { supabase } from './client'

export interface PresenceManagerCallbacks {
  onParticipantsUpdate?: (participants: Participant[]) => void
  onError?: (error: Error) => void
}

export class PresenceManager {
  private channel: ReturnType<typeof supabase.channel> | null = null
  private currentUserId: string | null = null
  private currentUsername: string | null = null
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
    if (!roomId) {
      throw new Error('PresenceManager.join: roomId is required')
    }
    if (!userId) {
      throw new Error('PresenceManager.join: userId is required')
    }
    if (!username) {
      throw new Error('PresenceManager.join: username is required')
    }

    // Leave previous room if any
    await this.leave()

    this.currentUserId = userId
    this.currentUsername = username

    const channelName = `game:${roomId}`
    this.channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
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

    // Subscribe to channel first (required before tracking presence)
    const status = await this.channel.subscribe()
    if (status === 'SUBSCRIBED') {
      // Channel subscribed successfully
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      throw new Error(`Failed to subscribe to presence channel: ${status}`)
    }

    // Set presence state (must be after subscription)
    const presenceState: SupabasePresenceState = {
      userId,
      username,
      avatar,
      joinedAt: Date.now(),
    }

    await this.channel.track(presenceState)
  }

  /**
   * Leave the current room
   */
  async leave(): Promise<void> {
    if (this.channel) {
      await this.channel.untrack()
      await this.channel.unsubscribe()
      supabase.removeChannel(this.channel)
      this.channel = null
    }
    this.currentUserId = null
    this.currentUsername = null
  }

  /**
   * Handle presence sync event
   */
  private handlePresenceSync(): void {
    if (!this.channel) {
      return
    }

    const presence = this.channel.presenceState()
    const participants: Participant[] = []

    for (const [_userId, presences] of Object.entries(presence)) {
      // presences is an array, but we only track one per user
      const state = presences[0] as SupabasePresenceState | undefined
      if (state) {
        participants.push({
          id: state.userId,
          username: state.username,
          avatar: state.avatar,
          joinedAt: state.joinedAt,
        })
      }
    }

    // Sort by joinedAt
    participants.sort((a, b) => a.joinedAt - b.joinedAt)

    this.callbacks.onParticipantsUpdate?.(participants)
  }

  /**
   * Get current participants
   */
  getParticipants(): Participant[] {
    if (!this.channel) {
      return []
    }

    const presence = this.channel.presenceState()
    const participants: Participant[] = []

    for (const [_userId, presences] of Object.entries(presence)) {
      const state = presences[0] as SupabasePresenceState | undefined
      if (state) {
        participants.push({
          id: state.userId,
          username: state.username,
          avatar: state.avatar,
          joinedAt: state.joinedAt,
        })
      }
    }

    return participants.sort((a, b) => a.joinedAt - b.joinedAt)
  }

  /**
   * Destroy the manager
   */
  async destroy(): Promise<void> {
    await this.leave()
    this.callbacks = {}
  }
}

