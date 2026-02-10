import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { internalQuery } from './_generated/server'

export const getUserById = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId as Id<'users'>)
  },
})

export const getUserByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), email))
      .first()
  },
})
