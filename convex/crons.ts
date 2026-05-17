/**
 * Scheduled Cron Jobs
 *
 * Handles periodic cleanup tasks for the database.
 */

import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

/**
 * Check for room owner presence timeouts every 30 seconds.
 *
 * If a room owner disconnects (stops sending heartbeats) for longer than
 * the presence threshold (30s), ownership is transferred to the next
 * active player in join order.
 */
crons.interval(
  'check room owner presence',
  { seconds: 30 },
  internal.rooms.checkAllRoomOwners,
)

/**
 * Clean up inactive rooms every 10 minutes.
 *
 * Deletes rooms that have been inactive for more than 1 hour and have
 * no active players. Also cleans up all related data (roomPlayers, roomBans,
 * userActiveRooms).
 */
crons.interval(
  'cleanup inactive rooms',
  { minutes: 10 },
  internal.rooms.cleanupInactiveRooms,
)

export default crons
