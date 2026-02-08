# Room Management Architecture (Convex)

This document describes how game rooms are created, validated, and maintained.

## Overview

Rooms are first-class Convex records. Creating a room writes to `rooms`,
presence is tracked in `roomPlayers`, and WebRTC signaling moves through
`roomSignals`.

## Data Model

Convex tables involved in room management:

- `rooms`: metadata for each room (owner, createdAt)
- `roomPlayers`: presence, sessions, and player stats
- `roomSignals`: WebRTC signaling messages
- `roomBans`: persistent bans
- `counters`: sequential counters for room ID generation

See `convex/schema.ts` for definitions and indexes.

## Room IDs

Room IDs are server-generated 6-character base-32 codes. The ID is created in
`convex/rooms.ts` using a monotonically increasing counter and a custom base-32
alphabet that avoids ambiguous characters.

## Room Lifecycle

### Create Room

The landing page calls `api.rooms.createRoom`. The server:

1. Requires an authenticated user (Convex auth)
2. Enforces a per-user throttle (5s cooldown)
3. Increments the `counters` record
4. Generates a new room ID
5. Inserts `rooms`

Room ID creation happens server-side; the client only receives the final code.

### Join Room

The `game.$gameId` route validates access in `beforeLoad`:

- `checkRoomAccess` returns `ok`, `not_found`, or `banned`
- Any non-`ok` result throws `notFound()` (same UI for banned/not-found)

After validation, the game room mounts and presence starts.

### Leave Room

Presence is tracked per session. Each tab has a unique `sessionId` stored in
`sessionStorage`. Leaving a room marks the session as left server-side.
Heartbeats keep a session active.

## Presence & Players

Presence is managed via `apps/web/src/hooks/useConvexPresence.ts`:

- `joinRoom` inserts/updates a `roomPlayers` session
- `heartbeat` updates `lastSeenAt` on a 10s interval
- `leaveRoom` marks the session as `left`
- Duplicate sessions are detected and can be transferred
- The room owner comes from the `rooms` record, not from presence

Active players are determined by `lastSeenAt` within a threshold (30s on server
queries).

## WebRTC Signaling

Signaling lives in `roomSignals` and is handled by `useConvexSignaling`:

- `sendSignal` writes an SDP/ICE payload to `roomSignals`
- `listSignals` subscribes reactively to messages scoped by room
- Client-side de-duplication avoids double processing

Signals are intended to be short-lived and cleaned up by a scheduled job.

## Access Control & Bans

`checkRoomAccess`:

- Verifies room existence
- If authenticated, checks for a ban in `roomBans`
- Returns `not_found` or `banned` (UI treats both the same)

Owners can kick or ban players via `useConvexPresence`.

## Session Storage

Client session storage is used for:

- `spell-coven:game-state` (gameId, playerName, timestamp)
- `spell-coven-session-id` (per-tab sessionId)

Validation enforces a 6-character uppercase code and a 24-hour max age.

## Key Files

- `convex/rooms.ts`: create room, access checks, live stats
- `convex/schema.ts`: room tables and indexes
- `apps/web/src/hooks/useConvexPresence.ts`: presence + heartbeat
- `apps/web/src/hooks/useConvexSignaling.ts`: WebRTC signaling
- `apps/web/src/routes/game.$gameId.tsx`: access validation + auth gating
- `apps/web/src/components/LandingPage.tsx`: create/join room flow
- `apps/web/src/lib/session-storage.ts`: saved game state

## Testing Checklist

- Create room as authed user -> receives a valid 6-char code
- Create room twice quickly -> throttled (roomId null + waitMs)
- Join room with invalid code -> notFound dialog on landing
- Join room when banned -> same notFound dialog
- Presence heartbeat updates active players within 30s
- Duplicate session detection works across tabs
- Signaling sends/receives within the same room

## Troubleshooting

### Room not found

Check:

- Room code format (must be 6 uppercase alphanumerics)
- `rooms` table contains the code
- `checkRoomAccess` returns `ok`

### Presence not updating

Check:

- `joinRoom` and `heartbeat` mutations in network logs
- `roomPlayers.lastSeenAt` changes
- `useConvexPresence` enabled flag is true

### Signaling not received

Check:

- `roomSignals` records are being created
- `listSignals` is subscribed with the correct roomId/userId
- Client de-duplication is not filtering new messages

## Key Takeaway

Rooms are explicit Convex records with authenticated creation, access
validation, and heartbeat-based presence.
