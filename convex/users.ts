/**
 * Convex User Queries
 *
 * Provides queries for user profile data from Convex Auth.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

/**
 * Get the current authenticated user's profile
 *
 * Returns the user document from Convex Auth's users table,
 * or null if not authenticated.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return null;
    }

    // Fetch the user document from the auth users table
    const user = await ctx.db.get(userId);

    return user;
  },
});
