# Card Counters — Design Spec

**Status:** Draft, pending review
**Date:** 2026-04-24

## Goal

Let players track on-card counters (Commander format) and player-level resources during a game, synced across all participants in real time, with right-click and click-to-bump UX.

## Decisions (locked from brainstorming)

| # | Question | Choice |
|---|---|---|
| 1 | Sync model | **Public sync, owner-gated writes.** Counters synced via Convex; only the card's owner (player whose webcam shows it) can add/remove. |
| 2 | Counter catalog | **Commander curated.** Card-level: `+1/+1`, `-1/-1`, loyalty, charge, stun, shield, quest, time. Player-level: poison, energy, experience. |
| 3 | Lifetime model | **Explicit tracked instances.** Player explicitly marks a card as "tracked", which mints a UUID instance. Counters live on the instance, not on the recognized region. Multiple copies of same card = multiple instances. |
| 4 | Render location | **Player-tile tray.** Each webcam tile has an overlay tray listing that player's tracked cards. Counters live in the tray; live detection is only used to *create* tracked instances, not to render badges. |
| UX | Add/remove | **Both** right-click context menu (add type, +/-) and click-to-bump on existing counter badges. |

## Data model

### Convex schema (additive)

The existing `counters` table is for sequential ID generation — name collision avoided by calling the new table `trackedCards`. The existing `roomPlayers.poison` field is reused as-is. IDs follow the existing convention (`roomId`/`userId` are Discord ID strings, not `v.id(...)`).

```ts
// convex/schema.ts — new table
trackedCards: defineTable({
  roomId: v.string(),
  ownerUserId: v.string(),      // Discord user ID of card's owner
  scryfallId: v.string(),       // for art lookup
  name: v.string(),             // cached for display when offline
  // Counter map. Keys are well-known type strings; values are non-negative ints.
  // Absent key = 0. Empty {} = no counters.
  counters: v.object({
    plus1plus1: v.optional(v.number()),
    minus1minus1: v.optional(v.number()),
    loyalty: v.optional(v.number()),
    charge: v.optional(v.number()),
    stun: v.optional(v.number()),
    shield: v.optional(v.number()),
    quest: v.optional(v.number()),
    time: v.optional(v.number()),
  }),
  createdAt: v.number(),
})
  .index('by_room', ['roomId'])
  .index('by_room_owner', ['roomId', 'ownerUserId'])

// convex/schema.ts — extend existing roomPlayers
//   Existing fields: roomId, userId, sessionId, username, avatar, health,
//                    poison, commanders, commanderDamage, status, joinedAt, lastSeenAt
//   Add:
energy: v.optional(v.number()),
experience: v.optional(v.number()),
// poison is REUSED — already exists.
```

### Counter types — display

| Key | Display | Color |
|---|---|---|
| `plus1plus1` | +1/+1 | green |
| `minus1minus1` | -1/-1 | red |
| `loyalty` | Loyalty | indigo |
| `charge` | Charge | amber |
| `stun` | Stun | sky |
| `shield` | Shield | slate |
| `quest` | Quest | purple |
| `time` | Time | rose |

## Mutations

```ts
// convex/trackedCards.ts
trackCard({ gameId, scryfallId, name }) -> instanceId
  // Owner = current user. Creates a new instance with counters: {}.

untrackCard({ instanceId })
  // Auth: must be owner.

setCounter({ instanceId, type, value })
  // Auth: must be owner. value clamped >=0. value=0 removes the key.

bumpCounter({ instanceId, type, delta })
  // Auth: must be owner. Atomic +/-, clamped >=0.

setPlayerResource({ gameId, type: 'poison'|'energy'|'experience', value })
  // Auth: setting your own only.
```

## UI

### Webcam tile tray

Each `LocalVideoCard` and remote `RemotePlayerCard` gets a tray docked at the bottom of the tile, height ~80px (collapsible). Empty state hidden until the player tracks at least one card.

Each row in the tray:
- Mini Scryfall art thumb (40×56)
- Card name truncated
- Counter badges (one per non-zero type) — click to bump +1, shift-click to bump -1
- Right-click on the row → context menu with "Add counter ▸ (8 types)", "Remove [type]", "Untrack card"

### Right-click on live webcam card

When a card is recognized in the webcam (via existing CLIP pipeline), right-clicking the **detection outline** (now always-visible per planned outline-display change) opens a context menu with:
- "Track this card"  (only for the local user on their own tile)
- Existing orientation items (rotate/mirror) stay below

If the card is already tracked (matched by scryfallId in owner's tray), the menu instead shows the counter add/remove items inline.

### Player-level resources

Existing player tile already shows life total. Add a small row of three icon+number badges next to it: poison, energy, experience. Each is click-to-bump-up, shift-click-to-bump-down. Defaults hidden when value=0; show small "+" affordance to add.

## Permissions / auth

All mutations check `ctx.auth.getUserIdentity()` and verify the calling user equals the owner of the affected resource. Reads are open to anyone in the game.

## Out of scope (future)

- Voice recognition for counter actions (separate spec)
- Floating-anchor counter rendering on the live video (rejected as Q4-B)
- Custom freeform counter types (rejected as Q2-C)
- Per-card commander damage (separate from counters; lives on player tile)
- History / undo of counter changes
- Animation for counter increments

## Open questions

None — all four design questions are decided.
