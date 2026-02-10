import { v } from 'convex/values'

import { internalQuery } from './_generated/server'

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
