/**
 * WebRTC Signaling Mutations & Queries
 *
 * Handles SDP offers/answers and ICE candidates for peer connections.
 *
 * NOTE: These functions accept userId as parameter for Phase 3.
 * Phase 5 will use getAuthUserId for proper authorization.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Signal TTL in milliseconds (60 seconds)
 */
const SIGNAL_TTL_MS = 60_000;

/**
 * Send a signaling message
 *
 * @param toUserId - Target user ID, or null for broadcast to all peers
 * @param payload - Signal payload (SDP, ICE candidate, etc.)
 *
 * NOTE: fromUserId is passed as parameter for Phase 3. Phase 5 will use getAuthUserId.
 */
export const sendSignal = mutation({
  args: {
    roomId: v.string(),
    fromUserId: v.string(),
    toUserId: v.union(v.string(), v.null()),
    payload: v.any(),
  },
  handler: async (ctx, { roomId, fromUserId, toUserId, payload }) => {
    await ctx.db.insert("roomSignals", {
      roomId,
      fromUserId,
      toUserId,
      payload,
      createdAt: Date.now(),
    });
  },
});

/**
 * List signals for a user since a given timestamp
 *
 * Returns signals where:
 * - toUserId matches the requesting user, OR
 * - toUserId is null (broadcast)
 *
 * Filters out signals from the requesting user.
 *
 * NOTE: userId is passed as parameter for Phase 3. Phase 5 will use getAuthUserId.
 */
export const listSignals = query({
  args: {
    roomId: v.string(),
    userId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, { roomId, userId, since = 0 }) => {
    if (!userId) {
      return [];
    }

    const signals = await ctx.db
      .query("roomSignals")
      .withIndex("by_roomId_createdAt", (q) =>
        q.eq("roomId", roomId).gt("createdAt", since),
      )
      .collect();

    // Filter to signals intended for this user or broadcast
    return signals.filter(
      (s) =>
        s.fromUserId !== userId &&
        (s.toUserId === null || s.toUserId === userId),
    );
  },
});

/**
 * Clean up old signals
 *
 * Removes signals older than SIGNAL_TTL_MS.
 * Should be called periodically (e.g., via scheduled function).
 */
export const cleanupSignals = mutation({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const threshold = Date.now() - SIGNAL_TTL_MS;

    const oldSignals = await ctx.db
      .query("roomSignals")
      .withIndex("by_roomId_createdAt", (q) =>
        q.eq("roomId", roomId).lt("createdAt", threshold),
      )
      .collect();

    for (const signal of oldSignals) {
      await ctx.db.delete(signal._id);
    }

    return { deleted: oldSignals.length };
  },
});
