/**
 * Convex Schema - Database table definitions
 *
 * Defines the data model for room state, players, signaling, and bans.
 * @see SUPABASE_TO_CONVEX_PLAN.md Section 2.3 for constraints and indexes.
 */

import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Room status enum values
 */
export const roomStatusValues = v.union(
  v.literal('waiting'),
  v.literal('playing'),
  v.literal('finished'),
)

/**
 * Player status enum values
 */
export const playerStatusValues = v.union(
  v.literal('active'),
  v.literal('inactive'),
  v.literal('left'),
)

export default defineSchema({
  // Include Convex Auth tables (users, sessions, etc.)
  ...authTables,

  /**
   * rooms - Room metadata
   *
   * Each room has a unique roomId (short shareable code), an owner, and a status.
   */
  rooms: defineTable({
    /** Short shareable room code (e.g., "ABC123") */
    roomId: v.string(),
    /** Discord user ID of the room owner */
    ownerId: v.string(),
    /** Room lifecycle status */
    status: roomStatusValues,
    /** When the room was created */
    createdAt: v.number(),
  })
    .index('by_roomId', ['roomId'])
    .index('by_ownerId', ['ownerId']),

  /**
   * roomState - Game state for a room
   *
   * One-to-one with rooms. Tracks whose turn it is and turn number.
   */
  roomState: defineTable({
    /** Reference to room */
    roomId: v.string(),
    /** Discord user ID of current turn player */
    currentTurnUserId: v.string(),
    /** Current turn number (starts at 1) */
    turnNumber: v.number(),
    /** Last update timestamp */
    lastUpdatedAt: v.number(),
  }).index('by_roomId', ['roomId']),

  /**
   * roomPlayers - Players in a room (also used for presence)
   *
   * Supports multi-tab sessions via sessionId.
   * lastSeenAt is used for heartbeat-based presence.
   */
  roomPlayers: defineTable({
    /** Reference to room */
    roomId: v.string(),
    /** Discord user ID */
    userId: v.string(),
    /** Session ID for multi-tab support */
    sessionId: v.string(),
    /** Player's display name */
    username: v.string(),
    /** Player's avatar URL */
    avatar: v.optional(v.string()),
    /** Player's current life total */
    health: v.number(),
    /** Player's current poison counters */
    poison: v.number(),
    /** Player's commander list (1-2 entries, owned by the player) */
    commanders: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
      }),
    ),
    /** Per-commander damage taken, keyed by ownerUserId:commanderId */
    commanderDamage: v.record(v.string(), v.number()),
    /** Player status */
    status: playerStatusValues,
    /** When player joined */
    joinedAt: v.number(),
    /** Last heartbeat timestamp (for presence) */
    lastSeenAt: v.number(),
  })
    .index('by_roomId', ['roomId'])
    .index('by_roomId_sessionId', ['roomId', 'sessionId'])
    .index('by_roomId_userId', ['roomId', 'userId'])
    .index('by_roomId_lastSeenAt', ['roomId', 'lastSeenAt']),

  /**
   * roomSignals - WebRTC signaling messages
   *
   * Short-lived records for SDP offers/answers and ICE candidates.
   * Should be cleaned up after ~60s via scheduled cleanup.
   */
  roomSignals: defineTable({
    /** Reference to room */
    roomId: v.string(),
    /** Sender's Discord user ID */
    fromUserId: v.string(),
    /** Target user ID (null = broadcast to all peers) */
    toUserId: v.union(v.string(), v.null()),
    /** Signal payload (SDP, ICE candidate, etc.) */
    payload: v.any(),
    /** When signal was created */
    createdAt: v.number(),
  })
    .index('by_roomId', ['roomId'])
    .index('by_roomId_createdAt', ['roomId', 'createdAt'])
    .index('by_roomId_toUserId', ['roomId', 'toUserId']),

  /**
   * roomBans - Persistent ban records
   *
   * Prevents banned users from rejoining a room.
   */
  roomBans: defineTable({
    /** Reference to room */
    roomId: v.string(),
    /** Banned user's Discord user ID */
    userId: v.string(),
    /** Discord user ID of who issued the ban */
    bannedBy: v.string(),
    /** Reason for the ban */
    reason: v.string(),
    /** When the ban was created */
    createdAt: v.number(),
  })
    .index('by_roomId', ['roomId'])
    .index('by_roomId_userId', ['roomId', 'userId']),
})
