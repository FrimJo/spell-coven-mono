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
    console.log('[WebRTC:Presence] Creating channel:', channelName)

    // Generate a unique channel name for presence to avoid conflicts with signaling
    const presenceChannelName = `${channelName}:presence`
    console.log(
      '[WebRTC:Presence] Using presence channel name:',
      presenceChannelName,
    )

    this.channel = supabase.channel(presenceChannelName, {
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
    await new Promise<void>((resolve, reject) => {
      this.channel!.subscribe((subscribeStatus, err) => {
        if (subscribeStatus === 'SUBSCRIBED') {
          resolve()
        } else if (
          subscribeStatus === 'CHANNEL_ERROR' ||
          subscribeStatus === 'TIMED_OUT' ||
          subscribeStatus === 'CLOSED'
        ) {
          reject(
            new Error(
              `Failed to subscribe to presence channel: ${subscribeStatus}${err ? ` - ${err.message}` : ''}`,
            ),
          )
        }
      })
    })

    // Set presence state (must be after subscription)
    const presenceState: SupabasePresenceState = {
      userId,
      username,
      avatar,
      joinedAt: Date.now(),
    }

    console.log(
      '[WebRTC:Presence] Tracking presence state:',
      presenceState,
      'with key:',
      userId,
    )
    console.log(
      '[WebRTC:Presence] Channel state before track:',
      this.channel.state,
    )

    try {
      // Add timeout to track operation
      const trackPromise = this.channel.track(presenceState)
      console.log(
        '[WebRTC:Presence] Track promise created, waiting for response...',
      )

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.log('[WebRTC:Presence] Track operation timed out!')
          reject(new Error('Presence track timeout after 10s'))
        }, 10000)
      })

      const result = await Promise.race([trackPromise, timeoutPromise])
      console.log('[WebRTC:Presence] Track result:', result)

      if (result === 'error') {
        throw new Error('Failed to track presence: channel returned error')
      }

      console.log('[WebRTC:Presence] Presence tracked successfully')

      // Trigger an immediate sync to check current state
      const immediatePresence = this.channel.presenceState()
      console.log(
        '[WebRTC:Presence] Immediate presence state after track:',
        immediatePresence,
      )

      // Manually trigger sync callback with current state
      this.handlePresenceSync()
    } catch (error) {
      console.error('[WebRTC:Presence] Error tracking presence:', error)
      throw error
    }
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
    console.log(
      '[WebRTC:Presence] Presence sync - raw presence state:',
      presence,
    )
    const participants: Participant[] = []

    for (const [presenceKey, presences] of Object.entries(presence)) {
      console.log(
        `[WebRTC:Presence] Processing presence key: ${presenceKey}, presences:`,
        presences,
      )
      // presences is an array, but we only track one per user
      const state = presences[0] as SupabasePresenceState | undefined
      if (state) {
        console.log(
          `[WebRTC:Presence] Found valid state for key ${presenceKey}:`,
          state,
        )
        participants.push({
          id: state.userId,
          username: state.username,
          avatar: state.avatar,
          joinedAt: state.joinedAt,
        })
      } else {
        console.warn(
          `[WebRTC:Presence] Invalid or missing state for key ${presenceKey}`,
          presences,
        )
      }
    }

    // Sort by joinedAt
    participants.sort((a, b) => a.joinedAt - b.joinedAt)

    console.log(
      '[WebRTC:Presence] Presence sync complete - participants:',
      participants,
    )
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
