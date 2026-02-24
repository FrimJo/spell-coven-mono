/**
 * Convex HTTP client for server-side (Node) usage.
 *
 * Use this in loaders, beforeLoad, or server functions when you need
 * point-in-time Convex queries. Do not use the React client (convex/react)
 * on the server—it is browser-only.
 *
 * @see https://docs.convex.dev/client/javascript/node
 */

import { api } from '@convex/_generated/api'
import { ConvexHttpClient } from 'convex/browser'

/** Same shape as convex/rooms checkRoomAccess return type */
export type CheckRoomAccessResult =
  | { status: 'ok' }
  | { status: 'not_found' }
  | { status: 'banned' }
  | { status: 'full'; currentCount: number; maxCount: number }

/**
 * Check room access using a new ConvexHttpClient.
 * Creates a client per call (do not share ConvexHttpClient between requests).
 *
 * No auth is passed: the query still returns not_found for missing rooms.
 * Ban checks require auth; the client will handle that after hydration.
 */
export async function checkRoomAccessServer(
  convexUrl: string,
  roomId: string,
): Promise<CheckRoomAccessResult> {
  const client = new ConvexHttpClient(convexUrl)
  return await client.query(api.rooms.checkRoomAccess, { roomId })
}
