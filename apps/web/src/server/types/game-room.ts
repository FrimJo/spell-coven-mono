/**
 * Game Room Types
 * Types for room cleanup and management
 */

export interface RoomCleanupTimer {
  roomId: string
  channelId: string
  guildId: string
  lastActivityTime: number
  inactivityTimeoutMs: number
  warningNotificationSent: boolean
  warningNotificationTime?: number
}

export interface RoomRegistry {
  roomId: string
  channelId: string
  roleId: string
  guildId: string
  createdAt: number
  lastActivityTime: number
  playerCount: number
  maxPlayers: number
}

export interface RoomCleanupJob {
  id: string
  intervalMs: number
  lastRunTime: number
  isRunning: boolean
}
