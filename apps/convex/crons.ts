/**
 * Scheduled Cron Jobs
 *
 * Handles periodic cleanup tasks for the database.
 */

import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

/**
 * Clean up old WebRTC signals every minute.
 *
 * Signals older than 60 seconds are removed to prevent table growth.
 * This runs at the start of every minute.
 */
crons.interval(
  'cleanup old signals',
  { minutes: 1 },
  internal.signals.cleanupAllSignals,
)

export default crons
