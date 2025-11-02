/**
 * Event Store Abstraction
 *
 * Interface for event persistence and replay.
 * Enables future integration with Supabase, PostgreSQL, etc.
 */

export interface DiscordEvent {
  event: string
  payload: unknown
}

export interface IEventStore {
  /**
   * Append event to store
   */
  append(event: DiscordEvent): Promise<void>

  /**
   * Get events since timestamp
   */
  getEventsSince(timestamp: number): Promise<DiscordEvent[]>

  /**
   * Get events for specific guild
   */
  getEventsForGuild(guildId: string, limit: number): Promise<DiscordEvent[]>
}
