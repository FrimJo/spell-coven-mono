/**
 * Canonical game ID validation — single source of truth.
 *
 * Game IDs are 6-character uppercase alphanumeric codes generated server-side
 * using a base-32 alphabet (see convex/rooms.ts). The frontend pattern is
 * intentionally wider than the backend alphabet so that codes containing
 * excluded characters (0, O, 1, I) are still syntactically valid but simply
 * won't match any room.
 */

export const GAME_ID_PATTERN = /^[A-Z0-9]{6}$/
