/**
 * Room Cleanup Manager
 * Implements automatic room cleanup after 1 hour of inactivity
 * Spec requirements:
 * - 1-hour inactivity timeout
 * - 30-second warning notification before cleanup
 * - Cleanup job runs every 5 minutes
 * - Broadcasts room.deleted event on cleanup
 */

import type { RoomCleanupTimer, RoomRegistry } from '../types/game-room.js'

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000 // 1 hour
const WARNING_NOTIFICATION_DELAY_MS = 30 * 1000 // 30 seconds before cleanup
const CLEANUP_JOB_INTERVAL_MS = 5 * 60 * 1000 // Run every 5 minutes

export interface RoomCleanupConfig {
  inactivityTimeoutMs: number
  warningNotificationDelayMs: number
  cleanupJobIntervalMs: number
}

export interface RoomCleanupListener {
  onWarning(room: RoomCleanupTimer): void
  onCleanup(room: RoomCleanupTimer): void
}

export class RoomCleanupManager {
  private rooms: Map<string, RoomCleanupTimer> = new Map()
  private registry: Map<string, RoomRegistry> = new Map()
  private cleanupJobId: NodeJS.Timeout | null = null
  private listeners: RoomCleanupListener[] = []
  private config: RoomCleanupConfig

  constructor(config: Partial<RoomCleanupConfig> = {}) {
    this.config = {
      inactivityTimeoutMs: config.inactivityTimeoutMs ?? INACTIVITY_TIMEOUT_MS,
      warningNotificationDelayMs:
        config.warningNotificationDelayMs ?? WARNING_NOTIFICATION_DELAY_MS,
      cleanupJobIntervalMs:
        config.cleanupJobIntervalMs ?? CLEANUP_JOB_INTERVAL_MS,
    }
  }

  /**
   * Register a room for cleanup tracking
   */
  registerRoom(
    roomId: string,
    channelId: string,
    guildId: string,
    registry: RoomRegistry,
  ): void {
    const timer: RoomCleanupTimer = {
      roomId,
      channelId,
      guildId,
      lastActivityTime: Date.now(),
      inactivityTimeoutMs: this.config.inactivityTimeoutMs,
      warningNotificationSent: false,
    }

    this.rooms.set(roomId, timer)
    this.registry.set(roomId, registry)

    console.log(
      `[RoomCleanup] Registered room ${roomId} (channel: ${channelId})`,
    )
  }

  /**
   * Update activity time for a room
   */
  updateActivity(roomId: string): void {
    const timer = this.rooms.get(roomId)
    if (timer) {
      timer.lastActivityTime = Date.now()
      timer.warningNotificationSent = false
      console.log(`[RoomCleanup] Updated activity for room ${roomId}`)
    }
  }

  /**
   * Unregister a room (manual cleanup)
   */
  unregisterRoom(roomId: string): void {
    this.rooms.delete(roomId)
    this.registry.delete(roomId)
    console.log(`[RoomCleanup] Unregistered room ${roomId}`)
  }

  /**
   * Start cleanup job scheduler
   */
  startCleanupJob(): void {
    if (this.cleanupJobId) {
      console.warn('[RoomCleanup] Cleanup job already running')
      return
    }

    console.log(
      `[RoomCleanup] Starting cleanup job (interval: ${this.config.cleanupJobIntervalMs}ms)`,
    )

    this.cleanupJobId = setInterval(() => {
      this.runCleanupJob()
    }, this.config.cleanupJobIntervalMs)
  }

  /**
   * Stop cleanup job scheduler
   */
  stopCleanupJob(): void {
    if (this.cleanupJobId) {
      clearInterval(this.cleanupJobId)
      this.cleanupJobId = null
      console.log('[RoomCleanup] Stopped cleanup job')
    }
  }

  /**
   * Run cleanup job (check for inactive rooms)
   */
  private runCleanupJob(): void {
    const now = Date.now()
    const roomsToClean: RoomCleanupTimer[] = []
    const roomsToWarn: RoomCleanupTimer[] = []

    for (const [, timer] of this.rooms) {
      const inactiveTime = now - timer.lastActivityTime
      const timeUntilCleanup = timer.inactivityTimeoutMs - inactiveTime

      // Check if room should be cleaned up
      if (inactiveTime >= timer.inactivityTimeoutMs) {
        roomsToClean.push(timer)
      }
      // Check if warning should be sent (30 seconds before cleanup)
      else if (
        timeUntilCleanup <= this.config.warningNotificationDelayMs &&
        !timer.warningNotificationSent
      ) {
        roomsToWarn.push(timer)
      }
    }

    // Send warnings
    for (const timer of roomsToWarn) {
      timer.warningNotificationSent = true
      timer.warningNotificationTime = now
      this.notifyWarning(timer)
    }

    // Clean up inactive rooms
    for (const timer of roomsToClean) {
      this.cleanupRoom(timer)
    }

    if (roomsToWarn.length > 0 || roomsToClean.length > 0) {
      console.log(
        `[RoomCleanup] Job completed: ${roomsToWarn.length} warnings, ${roomsToClean.length} cleanups`,
      )
    }
  }

  /**
   * Send warning notification
   */
  private notifyWarning(timer: RoomCleanupTimer): void {
    console.log(
      `[RoomCleanup] Sending warning for room ${timer.roomId} (cleanup in ${this.config.warningNotificationDelayMs}ms)`,
    )

    for (const listener of this.listeners) {
      try {
        listener.onWarning(timer)
      } catch (error) {
        console.error('[RoomCleanup] Error in warning listener:', error)
      }
    }
  }

  /**
   * Clean up a room
   */
  private cleanupRoom(timer: RoomCleanupTimer): void {
    console.log(
      `[RoomCleanup] Cleaning up room ${timer.roomId} (inactive for ${timer.inactivityTimeoutMs}ms)`,
    )

    this.rooms.delete(timer.roomId)
    this.registry.delete(timer.roomId)

    for (const listener of this.listeners) {
      try {
        listener.onCleanup(timer)
      } catch (error) {
        console.error('[RoomCleanup] Error in cleanup listener:', error)
      }
    }
  }

  /**
   * Subscribe to cleanup events
   */
  subscribe(listener: RoomCleanupListener): () => void {
    this.listeners.push(listener)

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Get room status
   */
  getRoomStatus(roomId: string): RoomCleanupTimer | null {
    return this.rooms.get(roomId) ?? null
  }

  /**
   * Get all active rooms
   */
  getActiveRooms(): RoomCleanupTimer[] {
    return Array.from(this.rooms.values())
  }

  /**
   * Get room registry
   */
  getRegistry(roomId: string): RoomRegistry | null {
    return this.registry.get(roomId) ?? null
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    this.stopCleanupJob()
    this.rooms.clear()
    this.registry.clear()
    this.listeners = []
    console.log('[RoomCleanup] Manager shut down')
  }
}

// Singleton instance
let instance: RoomCleanupManager | null = null

export function getRoomCleanupManager(): RoomCleanupManager {
  if (!instance) {
    instance = new RoomCleanupManager()
  }
  return instance
}
