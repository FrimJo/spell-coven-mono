/**
 * Room Service - Manages game room operations via Supabase Realtime
 *
 * Note: With Supabase Realtime, channels are created automatically when
 * the first person subscribes. There's no need to "check if room exists"
 * before joining - any room ID is valid!
 *
 * This file is kept for potential future use (e.g., getting participant counts),
 * but room validation is NOT needed for the basic flow.
 * Uses shared ChannelManager for channel reuse.
 */

import { channelManager } from './channel-manager'

/**
 * Get current participant count for a room
 *
 * Note: This creates a temporary subscription to check the count.
 * Returns 0 if no one is in the room yet (room will be created when first person joins).
 */
export async function getRoomParticipantCount(roomId: string): Promise<number> {
  try {
    console.log('[RoomService] Getting participant count for room:', roomId)

    // Use shared channel manager
    const channel = channelManager.getChannel(roomId)

    // Check if already subscribed
    const subscriptionCount = channelManager.getSubscriptionCount(roomId)
    console.log(
      `[RoomService] Current subscriptions for room ${roomId}: ${subscriptionCount}`,
    )

    let needsCleanup = false

    // Only subscribe if not already subscribed
    if (subscriptionCount === 0) {
      console.log('[RoomService] Subscribing to channel to get presence...')
      needsCleanup = true

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Channel subscription timeout'))
        }, 5000)

        channel.subscribe((status, err) => {
          clearTimeout(timeout)
          if (status === 'SUBSCRIBED') {
            channelManager.markSubscribed(roomId)
            resolve()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(err || new Error(`Channel subscription failed: ${status}`))
          }
        })
      })
    } else {
      console.log('[RoomService] Channel already subscribed, using existing')
    }

    // Get presence state
    const presenceState = channel.presenceState()
    const participantCount = Object.keys(presenceState).length

    // Clean up only if we subscribed in this function
    if (needsCleanup) {
      console.log('[RoomService] Cleaning up temporary subscription')
      channelManager.markUnsubscribed(roomId)

      // Only unsubscribe if no other subscriptions remain
      const remainingCount = channelManager.getSubscriptionCount(roomId)
      if (remainingCount === 0) {
        await channel.unsubscribe()
        channelManager.removeChannel(roomId)
      }
    }

    console.log(
      `[RoomService] Room ${roomId} has ${participantCount} participant(s)`,
    )

    return participantCount
  } catch (error) {
    console.error('[RoomService] Error getting participant count:', error)
    // Return 0 if we can't check (room will be created when someone joins)
    return 0
  }
}
