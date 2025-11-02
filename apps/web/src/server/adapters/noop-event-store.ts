import type { DiscordEvent, IEventStore } from '../interfaces/event-store'

/**
 * No-Op Event Store
 *
 * Null implementation that doesn't persist events.
 * For event persistence, use SupabaseEventStore or PostgresEventStore.
 */
export class NoOpEventStore implements IEventStore {
  async append(_event: DiscordEvent): Promise<void> {
    // No-op: events are not persisted
  }

  async getEventsSince(_timestamp: number): Promise<DiscordEvent[]> {
    return []
  }

  async getEventsForGuild(
    _guildId: string,
    _limit: number,
  ): Promise<DiscordEvent[]> {
    return []
  }
}
