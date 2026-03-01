import { v } from 'convex/values'

import type { MutationCtx } from './_generated/server'
import { internalMutation } from './_generated/server'
import { RateLimitedError } from './errors'

/**
 * Best-effort persistent rate limiter.
 *
 * Limits calls per key inside a fixed time window.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  {
    key,
    maxCalls,
    windowMs,
    label,
  }: {
    key: string
    maxCalls: number
    windowMs: number
    label: string
  },
): Promise<void> {
  const now = Date.now()
  const windowStart = now - windowMs

  const existing = await ctx.db
    .query('abuseRateLimits')
    .withIndex('by_key', (q) => q.eq('key', key))
    .first()

  if (!existing) {
    await ctx.db.insert('abuseRateLimits', {
      key,
      count: 1,
      windowStartedAt: now,
      updatedAt: now,
    })
    return
  }

  if (existing.windowStartedAt <= windowStart) {
    await ctx.db.patch(existing._id, {
      count: 1,
      windowStartedAt: now,
      updatedAt: now,
    })
    return
  }

  if (existing.count >= maxCalls) {
    console.warn('[AbuseGuard] Rate limit exceeded', { label, key, maxCalls })
    throw new RateLimitedError(`${label} is rate-limited`)
  }

  await ctx.db.patch(existing._id, {
    count: existing.count + 1,
    updatedAt: now,
  })
}

/**
 * Periodic maintenance for limiter state to prevent table growth.
 */
export const cleanupRateLimits = internalMutation({
  args: {
    olderThanMs: v.optional(v.number()),
  },
  handler: async (ctx, { olderThanMs }) => {
    const retentionMs = olderThanMs ?? 24 * 60 * 60 * 1000
    const threshold = Date.now() - retentionMs

    const all = await ctx.db.query('abuseRateLimits').collect()
    const stale = all.filter((entry) => entry.updatedAt < threshold)

    for (const entry of stale) {
      await ctx.db.delete(entry._id)
    }

    return { deleted: stale.length }
  },
})
