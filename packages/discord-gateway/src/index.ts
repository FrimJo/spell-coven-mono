/**
 * Discord Gateway - Supporting package for TanStack Start
 *
 * Exports the DiscordGatewayClient and HubClient for use in the web app server.
 * The gateway is initialized in the web app's server startup, not as a standalone service.
 */

import type { InternalEvent } from './types.ts'

export { DiscordGatewayClient } from './gateway.ts'
export type { GatewayConfig, InternalEvent } from './types.ts'

/**
 * Create Discord Gateway event handler
 *
 * This function creates an event handler that processes Discord Gateway events
 * and posts them to the hub endpoint.
 *
 * @param config - Gateway configuration
 * @param hub - Hub client instance
 * @returns Event handler function
 */
export function createDiscordGatewayEventHandler(
  config: { primaryGuildId: string },
  hub: {
    postEvent: (
      event: InternalEvent['event'],
      payload: unknown,
    ) => Promise<void>
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (event: string, data: any) => {
    console.log(`[Gateway] Received Discord event: ${event}`)

    // Filter to primary guild only
    if (data.guild_id && data.guild_id !== config.primaryGuildId) {
      console.log(
        `[Gateway] Ignoring event from different guild: ${data.guild_id}`,
      )
      return
    }

    // Handle specific events
    switch (event) {
      case 'CHANNEL_CREATE':
        if (data.type === 2) {
          // Voice channel
          await hub.postEvent('room.created', {
            channelId: data.id,
            name: data.name,
            guildId: data.guild_id,
            parentId: data.parent_id,
            userLimit: data.user_limit ?? 0,
          })
        }
        break

      case 'CHANNEL_DELETE':
        if (data.type === 2) {
          // Voice channel
          await hub.postEvent('room.deleted', {
            channelId: data.id,
            guildId: data.guild_id,
          })
        }
        break

      case 'VOICE_STATE_UPDATE':
        // User joined voice channel
        if (data.channel_id && !data.before?.channel_id) {
          // Extract user info from the event
          // Discord includes user object in VOICE_STATE_UPDATE
          const username = data.user?.username || 'Unknown User'
          const avatar = data.user?.avatar || null

          await hub.postEvent('voice.joined', {
            guildId: data.guild_id,
            channelId: data.channel_id,
            userId: data.user_id,
            username,
            avatar,
          })
        }
        // User left voice channel
        else if (!data.channel_id && data.before?.channel_id) {
          await hub.postEvent('voice.left', {
            guildId: data.guild_id,
            channelId: null,
            userId: data.user_id,
          })
        }
        break
    }
  }
}
