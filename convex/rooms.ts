/**
 * Room Mutations & Queries
 *
 * Handles room creation, state management, and ownership.
 *
 * NOTE: These mutations currently accept userId/callerId as parameters for Phase 3.
 * In Phase 5 (auth migration), we'll use getAuthUserId for proper authorization.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Default starting health for Commander format
 * @internal Reserved for Phase 4 game logic
 */
const _DEFAULT_HEALTH = 40;

/**
 * Generate a short room code (6 uppercase alphanumeric characters)
 */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: 0, O, 1, I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Create a new room
 *
 * Creates the room, initial room state, and adds the creator as the first player.
 *
 * NOTE: ownerId is passed as parameter for Phase 3. Phase 5 will use getAuthUserId.
 */
export const createRoom = mutation({
  args: {
    ownerId: v.string(), // Discord user ID, will use Convex Auth in Phase 5
  },
  handler: async (ctx, { ownerId }) => {
    const userId = ownerId;
    if (!userId) {
      throw new Error("ownerId is required");
    }

    // Generate unique room code
    let roomId: string;
    let attempts = 0;
    do {
      roomId = generateRoomCode();
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
        .first();
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error("Failed to generate unique room code");
    }

    const now = Date.now();

    // Create room
    await ctx.db.insert("rooms", {
      roomId,
      ownerId: userId,
      status: "waiting",
      createdAt: now,
    });

    // Create initial room state
    await ctx.db.insert("roomState", {
      roomId,
      currentTurnUserId: userId,
      turnNumber: 1,
      lastUpdatedAt: now,
    });

    return { roomId };
  },
});

/**
 * Get a room by its short code
 */
export const getRoom = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .first();

    if (!room) {
      return null;
    }

    const state = await ctx.db
      .query("roomState")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .first();

    return {
      ...room,
      state,
    };
  },
});

/**
 * Update room status
 *
 * NOTE: callerId is used for Phase 3. Phase 5 will use getAuthUserId.
 */
export const updateRoomStatus = mutation({
  args: {
    roomId: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished"),
    ),
    callerId: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, status, callerId }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .first();

    if (!room) {
      throw new Error("Room not found");
    }

    if (callerId && room.ownerId !== callerId) {
      throw new Error("Only the room owner can change room status");
    }

    await ctx.db.patch(room._id, { status });
  },
});

/**
 * Set the current turn to a specific player
 *
 * NOTE: callerId is used for Phase 3. Phase 5 will use getAuthUserId.
 */
export const setTurn = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    callerId: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, userId, callerId }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .first();

    if (!room) {
      throw new Error("Room not found");
    }

    // Only owner can set turn arbitrarily
    if (callerId && room.ownerId !== callerId) {
      throw new Error("Only the room owner can set turn");
    }

    const state = await ctx.db
      .query("roomState")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .first();

    if (!state) {
      throw new Error("Room state not found");
    }

    await ctx.db.patch(state._id, {
      currentTurnUserId: userId,
      lastUpdatedAt: Date.now(),
    });
  },
});

/**
 * Advance turn to the next player
 *
 * Cycles through active players in join order.
 *
 * NOTE: callerId is used for Phase 3. Phase 5 will use getAuthUserId.
 */
export const advanceTurn = mutation({
  args: {
    roomId: v.string(),
    callerId: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, callerId }) => {
    const state = await ctx.db
      .query("roomState")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .first();

    if (!state) {
      throw new Error("Room state not found");
    }

    // Only current turn player can advance
    if (callerId && state.currentTurnUserId !== callerId) {
      throw new Error("Only the current turn player can advance turn");
    }

    // Get active players sorted by join time
    const presenceThreshold = Date.now() - 30_000; // 30s
    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.gt(q.field("lastSeenAt"), presenceThreshold),
        ),
      )
      .collect();

    // Sort by joinedAt to get consistent order
    players.sort((a, b) => a.joinedAt - b.joinedAt);

    // Deduplicate by userId (keep first session per user)
    const uniquePlayers = players.filter(
      (p, i, arr) => arr.findIndex((x) => x.userId === p.userId) === i,
    );

    if (uniquePlayers.length === 0) {
      throw new Error("No active players in room");
    }

    // Find current player index and advance
    const currentIndex = uniquePlayers.findIndex(
      (p) => p.userId === state.currentTurnUserId,
    );
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % uniquePlayers.length;
    const nextPlayer = uniquePlayers[nextIndex];

    if (!nextPlayer) {
      throw new Error("Failed to determine next player");
    }

    await ctx.db.patch(state._id, {
      currentTurnUserId: nextPlayer.userId,
      turnNumber: state.turnNumber + 1,
      lastUpdatedAt: Date.now(),
    });
  },
});

/**
 * Update a player's health
 *
 * NOTE: No auth check for Phase 3. Phase 5 will add proper authorization.
 */
export const updatePlayerHealth = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    delta: v.number(),
  },
  handler: async (ctx, { roomId, userId, delta }) => {
    // Find player record (any active session for this user)
    const player = await ctx.db
      .query("roomPlayers")
      .withIndex("by_roomId_userId", (q) =>
        q.eq("roomId", roomId).eq("userId", userId),
      )
      .first();

    if (!player) {
      throw new Error("Player not found in room");
    }

    // Update health for all sessions of this user
    const allSessions = await ctx.db
      .query("roomPlayers")
      .withIndex("by_roomId_userId", (q) =>
        q.eq("roomId", roomId).eq("userId", userId),
      )
      .collect();

    for (const session of allSessions) {
      await ctx.db.patch(session._id, {
        health: player.health + delta,
      });
    }
  },
});
