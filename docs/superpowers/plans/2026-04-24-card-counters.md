# Card Counters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship public-synced card counter tracking for Commander gameplay — players right-click to track recognized cards, manage 8 counter types per card via right-click + click-bump, and adjust 3 player-level resources (poison/energy/experience), all visible to every player in the room in real time.

**Architecture:** New Convex `trackedCards` table (room-scoped, owner-gated mutations) + extension of existing `roomPlayers` with `energy`/`experience` (poison already exists). React layer uses Convex live queries to render a tray docked at the bottom of each webcam tile. Right-click and click-bump UX both call the same mutations. Reuses existing `VideoOrientationContextMenu` pattern for the per-tile context menu.

**Tech Stack:** Convex (queries/mutations/schema), TanStack Start (React 19), Radix `ContextMenu`, Tailwind, lucide-react icons, Vitest for unit tests, Playwright for E2E.

---

## File Structure

**Create:**
- `convex/trackedCards.ts` — queries + mutations for tracked cards
- `convex/playerResources.ts` — mutations for `energy` / `experience` / `poison` bumps
- `apps/web/src/lib/counter-types.ts` — shared catalog (key, label, color, icon)
- `apps/web/src/hooks/useTrackedCards.ts` — convex hook + helpers
- `apps/web/src/components/CounterBadge.tsx` — single counter pill (click-bump UI)
- `apps/web/src/components/TrackedCardTray.tsx` — tile-level tray component
- `apps/web/src/components/TrackedCardRow.tsx` — single row inside the tray (mini art + name + badges + context menu)
- `apps/web/src/components/PlayerResourceBadges.tsx` — poison/energy/experience badge cluster
- `convex/__tests__/trackedCards.test.ts` — mutation unit tests
- `apps/web/src/components/__tests__/CounterBadge.test.tsx` — badge UX tests
- `apps/web/tests/e2e/counters.spec.ts` — track + bump end-to-end

**Modify:**
- `convex/schema.ts` — add `trackedCards` table + `energy` / `experience` on `roomPlayers`
- `apps/web/src/components/LocalVideoCard.tsx` — render tray + add "Track this card" item to right-click menu
- `apps/web/src/components/VideoStreamGrid.tsx` (RemotePlayerCard) — render tray for remote tiles (read-only when not owner)
- `apps/web/src/components/VideoOrientationContextMenu.tsx` — accept additional menu items as a slot

---

## Task 1: Schema migration

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add `trackedCards` table + extend `roomPlayers`**

In `convex/schema.ts`, inside the `defineSchema({...})` object, add after the existing `roomBans` table:

```ts
  /**
   * trackedCards - Player-tracked card instances with counters
   *
   * Created when a player right-clicks a recognized card and chooses
   * "Track this card". Persists for the life of the room. Owner-gated mutations.
   */
  trackedCards: defineTable({
    roomId: v.string(),
    ownerUserId: v.string(),
    scryfallId: v.string(),
    name: v.string(),
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
    .index('by_room_owner', ['roomId', 'ownerUserId']),
```

In the existing `roomPlayers` table (around line 52), add two optional fields after `poison`:

```ts
    /** Player's current energy counters (Commander) */
    energy: v.optional(v.number()),
    /** Player's current experience counters (Commander) */
    experience: v.optional(v.number()),
```

- [ ] **Step 2: Run convex codegen + verify schema validates**

```bash
bunx convex dev --once
```

Expected: `Converting TypeScript ...` with no schema errors. New types appear in `convex/_generated/dataModel.d.ts`.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts convex/_generated/
git commit -m "feat(schema): add trackedCards table + energy/experience on roomPlayers"
```

---

## Task 2: Counter type catalog (shared module)

**Files:**
- Create: `apps/web/src/lib/counter-types.ts`

- [ ] **Step 1: Write the catalog module**

```ts
// apps/web/src/lib/counter-types.ts
import {
  Hourglass,
  Plus,
  Minus,
  Crown,
  Zap,
  Shield as ShieldIcon,
  Snowflake,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

/** Keys must match the keys of trackedCards.counters in convex/schema.ts */
export const COUNTER_KEYS = [
  'plus1plus1',
  'minus1minus1',
  'loyalty',
  'charge',
  'stun',
  'shield',
  'quest',
  'time',
] as const

export type CounterKey = (typeof COUNTER_KEYS)[number]

export interface CounterMeta {
  key: CounterKey
  label: string
  /** Tailwind text + bg color classes for the badge */
  badgeClass: string
  icon: LucideIcon
}

export const COUNTER_META: Record<CounterKey, CounterMeta> = {
  plus1plus1: { key: 'plus1plus1', label: '+1/+1', badgeClass: 'bg-green-600/30 text-green-200 border-green-600/50', icon: Plus },
  minus1minus1: { key: 'minus1minus1', label: '-1/-1', badgeClass: 'bg-red-600/30 text-red-200 border-red-600/50', icon: Minus },
  loyalty: { key: 'loyalty', label: 'Loyalty', badgeClass: 'bg-indigo-600/30 text-indigo-200 border-indigo-600/50', icon: Crown },
  charge: { key: 'charge', label: 'Charge', badgeClass: 'bg-amber-500/30 text-amber-200 border-amber-500/50', icon: Zap },
  stun: { key: 'stun', label: 'Stun', badgeClass: 'bg-sky-600/30 text-sky-200 border-sky-600/50', icon: Snowflake },
  shield: { key: 'shield', label: 'Shield', badgeClass: 'bg-slate-500/30 text-slate-200 border-slate-500/50', icon: ShieldIcon },
  quest: { key: 'quest', label: 'Quest', badgeClass: 'bg-purple-600/30 text-purple-200 border-purple-600/50', icon: ScrollText },
  time: { key: 'time', label: 'Time', badgeClass: 'bg-rose-500/30 text-rose-200 border-rose-500/50', icon: Hourglass },
}

export type CounterMap = Partial<Record<CounterKey, number>>

/** Total non-zero counter types in a map */
export function counterTypeCount(map: CounterMap): number {
  return COUNTER_KEYS.reduce((acc, key) => acc + ((map[key] ?? 0) > 0 ? 1 : 0), 0)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/counter-types.ts
git commit -m "feat(counters): catalog of counter types + color/icon mapping"
```

---

## Task 3: Convex queries + mutations for tracked cards

**Files:**
- Create: `convex/trackedCards.ts`
- Test: `convex/__tests__/trackedCards.test.ts` (deferred to Task 9)

- [ ] **Step 1: Write the module**

```ts
// convex/trackedCards.ts
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getUserIdentityOrThrow } from './lib/auth'  // existing helper — adjust import if it lives elsewhere

const COUNTER_KEYS = [
  'plus1plus1', 'minus1minus1', 'loyalty', 'charge',
  'stun', 'shield', 'quest', 'time',
] as const

const counterKeyValidator = v.union(...COUNTER_KEYS.map(k => v.literal(k)))

export const listByRoom = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    return await ctx.db
      .query('trackedCards')
      .withIndex('by_room', q => q.eq('roomId', roomId))
      .collect()
  },
})

export const trackCard = mutation({
  args: {
    roomId: v.string(),
    scryfallId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    return await ctx.db.insert('trackedCards', {
      roomId: args.roomId,
      ownerUserId: identity.subject,
      scryfallId: args.scryfallId,
      name: args.name,
      counters: {},
      createdAt: Date.now(),
    })
  },
})

export const untrackCard = mutation({
  args: { instanceId: v.id('trackedCards') },
  handler: async (ctx, { instanceId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const doc = await ctx.db.get(instanceId)
    if (!doc) throw new Error('Not found')
    if (doc.ownerUserId !== identity.subject) throw new Error('Forbidden')
    await ctx.db.delete(instanceId)
  },
})

export const setCounter = mutation({
  args: {
    instanceId: v.id('trackedCards'),
    type: counterKeyValidator,
    value: v.number(),
  },
  handler: async (ctx, { instanceId, type, value }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const doc = await ctx.db.get(instanceId)
    if (!doc) throw new Error('Not found')
    if (doc.ownerUserId !== identity.subject) throw new Error('Forbidden')
    const clamped = Math.max(0, Math.floor(value))
    const counters = { ...doc.counters }
    if (clamped === 0) {
      delete counters[type]
    } else {
      counters[type] = clamped
    }
    await ctx.db.patch(instanceId, { counters })
  },
})

export const bumpCounter = mutation({
  args: {
    instanceId: v.id('trackedCards'),
    type: counterKeyValidator,
    delta: v.number(),
  },
  handler: async (ctx, { instanceId, type, delta }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const doc = await ctx.db.get(instanceId)
    if (!doc) throw new Error('Not found')
    if (doc.ownerUserId !== identity.subject) throw new Error('Forbidden')
    const current = doc.counters[type] ?? 0
    const next = Math.max(0, Math.floor(current + delta))
    const counters = { ...doc.counters }
    if (next === 0) {
      delete counters[type]
    } else {
      counters[type] = next
    }
    await ctx.db.patch(instanceId, { counters })
  },
})
```

> **Note for implementer:** if `getUserIdentityOrThrow` does not exist in `convex/lib/`, replace the inline `ctx.auth.getUserIdentity()` checks with whatever auth helper the codebase actually exports. Search `convex/` for `getUserIdentity` first.

- [ ] **Step 2: Verify codegen succeeds**

```bash
bunx convex dev --once
```

Expected: `api.trackedCards.{listByRoom,trackCard,untrackCard,setCounter,bumpCounter}` available in generated types.

- [ ] **Step 3: Commit**

```bash
git add convex/trackedCards.ts convex/_generated/
git commit -m "feat(convex): trackedCards CRUD with owner-gated mutations"
```

---

## Task 4: Convex mutations for player resources

**Files:**
- Create: `convex/playerResources.ts`

- [ ] **Step 1: Write the module**

```ts
// convex/playerResources.ts
import { v } from 'convex/values'
import { mutation } from './_generated/server'

const RESOURCE_KEYS = ['poison', 'energy', 'experience'] as const
const resourceKeyValidator = v.union(...RESOURCE_KEYS.map(k => v.literal(k)))

export const setResource = mutation({
  args: {
    roomId: v.string(),
    type: resourceKeyValidator,
    value: v.number(),
  },
  handler: async (ctx, { roomId, type, value }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', q =>
        q.eq('roomId', roomId).eq('userId', identity.subject),
      )
      .first()
    if (!player) throw new Error('Player not in room')
    const clamped = Math.max(0, Math.floor(value))
    await ctx.db.patch(player._id, { [type]: clamped })
  },
})

export const bumpResource = mutation({
  args: {
    roomId: v.string(),
    type: resourceKeyValidator,
    delta: v.number(),
  },
  handler: async (ctx, { roomId, type, delta }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', q =>
        q.eq('roomId', roomId).eq('userId', identity.subject),
      )
      .first()
    if (!player) throw new Error('Player not in room')
    const current = (player as Record<string, unknown>)[type] as number | undefined ?? 0
    const next = Math.max(0, Math.floor(current + delta))
    await ctx.db.patch(player._id, { [type]: next })
  },
})
```

- [ ] **Step 2: Verify codegen + commit**

```bash
bunx convex dev --once
git add convex/playerResources.ts convex/_generated/
git commit -m "feat(convex): playerResources mutations (poison/energy/experience)"
```

---

## Task 5: React hook for tracked cards

**Files:**
- Create: `apps/web/src/hooks/useTrackedCards.ts`

- [ ] **Step 1: Write the hook**

```ts
// apps/web/src/hooks/useTrackedCards.ts
import { useMutation, useQuery } from 'convex/react'
import { useCallback } from 'react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { CounterKey } from '@/lib/counter-types'

export function useTrackedCards(roomId: string) {
  const cards = useQuery(api.trackedCards.listByRoom, { roomId }) ?? []
  const trackCardMutation = useMutation(api.trackedCards.trackCard)
  const untrackCardMutation = useMutation(api.trackedCards.untrackCard)
  const bumpMutation = useMutation(api.trackedCards.bumpCounter)
  const setMutation = useMutation(api.trackedCards.setCounter)

  const trackCard = useCallback(
    (scryfallId: string, name: string) =>
      trackCardMutation({ roomId, scryfallId, name }),
    [roomId, trackCardMutation],
  )
  const untrackCard = useCallback(
    (instanceId: Id<'trackedCards'>) => untrackCardMutation({ instanceId }),
    [untrackCardMutation],
  )
  const bump = useCallback(
    (instanceId: Id<'trackedCards'>, type: CounterKey, delta: number) =>
      bumpMutation({ instanceId, type, delta }),
    [bumpMutation],
  )
  const set = useCallback(
    (instanceId: Id<'trackedCards'>, type: CounterKey, value: number) =>
      setMutation({ instanceId, type, value }),
    [setMutation],
  )

  return { cards, trackCard, untrackCard, bump, set }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useTrackedCards.ts
git commit -m "feat(web): useTrackedCards hook"
```

---

## Task 6: CounterBadge component (click-bump UX)

**Files:**
- Create: `apps/web/src/components/CounterBadge.tsx`
- Test: `apps/web/src/components/__tests__/CounterBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/__tests__/CounterBadge.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CounterBadge } from '../CounterBadge'

describe('CounterBadge', () => {
  it('calls onChange(+1) on click', () => {
    const onChange = vi.fn()
    render(<CounterBadge type="plus1plus1" count={3} editable onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /\+1\/\+1: 3/i }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('calls onChange(-1) on shift+click', () => {
    const onChange = vi.fn()
    render(<CounterBadge type="plus1plus1" count={3} editable onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'), { shiftKey: true })
    expect(onChange).toHaveBeenCalledWith(-1)
  })

  it('does not fire onChange when not editable', () => {
    const onChange = vi.fn()
    render(<CounterBadge type="plus1plus1" count={3} editable={false} onChange={onChange} />)
    fireEvent.click(screen.getByText('3'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
bun --cwd apps/web vitest run src/components/__tests__/CounterBadge.test.tsx
```

Expected: Cannot find module '../CounterBadge'

- [ ] **Step 3: Implement CounterBadge**

```tsx
// apps/web/src/components/CounterBadge.tsx
import { COUNTER_META, type CounterKey } from '@/lib/counter-types'

interface CounterBadgeProps {
  type: CounterKey
  count: number
  editable: boolean
  onChange?: (delta: number) => void
}

export function CounterBadge({ type, count, editable, onChange }: CounterBadgeProps) {
  const meta = COUNTER_META[type]
  const Icon = meta.icon
  const className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.badgeClass} ${editable ? 'cursor-pointer hover:brightness-125' : ''}`
  if (!editable) {
    return (
      <span className={className} aria-label={`${meta.label}: ${count}`}>
        <Icon className="h-3 w-3" />
        {count}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={`${meta.label}: ${count}`}
      onClick={(e) => onChange?.(e.shiftKey ? -1 : 1)}
    >
      <Icon className="h-3 w-3" />
      {count}
    </button>
  )
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
bun --cwd apps/web vitest run src/components/__tests__/CounterBadge.test.tsx
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CounterBadge.tsx apps/web/src/components/__tests__/CounterBadge.test.tsx
git commit -m "feat(web): CounterBadge with shift-click decrement"
```

---

## Task 7: TrackedCardRow + TrackedCardTray

**Files:**
- Create: `apps/web/src/components/TrackedCardRow.tsx`
- Create: `apps/web/src/components/TrackedCardTray.tsx`

- [ ] **Step 1: Implement TrackedCardRow**

```tsx
// apps/web/src/components/TrackedCardRow.tsx
import type { Id } from '@convex/_generated/dataModel'
import { COUNTER_KEYS, COUNTER_META, type CounterKey, type CounterMap } from '@/lib/counter-types'
import { Trash2 } from 'lucide-react'
import { CounterBadge } from './CounterBadge'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@repo/ui/components/context-menu'

interface TrackedCardRowProps {
  instanceId: Id<'trackedCards'>
  scryfallId: string
  name: string
  counters: CounterMap
  editable: boolean
  onBump?: (type: CounterKey, delta: number) => void
  onUntrack?: () => void
}

const SCRYFALL_ART = (id: string) =>
  `https://api.scryfall.com/cards/${id}?format=image&version=art_crop`

export function TrackedCardRow({
  instanceId: _instanceId, scryfallId, name, counters, editable, onBump, onUntrack,
}: TrackedCardRowProps) {
  const activeKeys = COUNTER_KEYS.filter(k => (counters[k] ?? 0) > 0)

  const row = (
    <div className="flex items-center gap-2 rounded-md bg-surface-2/60 px-2 py-1">
      <img src={SCRYFALL_ART(scryfallId)} alt={name} className="h-10 w-14 rounded object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-white">{name}</div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {activeKeys.length === 0 && (
            <span className="text-[10px] italic text-text-muted">no counters</span>
          )}
          {activeKeys.map(key => (
            <CounterBadge
              key={key}
              type={key}
              count={counters[key] ?? 0}
              editable={editable}
              onChange={delta => onBump?.(key, delta)}
            />
          ))}
        </div>
      </div>
    </div>
  )

  if (!editable) return row

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuSub>
          <ContextMenuSubTrigger>Add counter</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {COUNTER_KEYS.map(key => (
              <ContextMenuItem key={key} onSelect={() => onBump?.(key, 1)}>
                +1 {COUNTER_META[key].label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {activeKeys.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>Remove counter</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {activeKeys.map(key => (
                <ContextMenuItem key={key} onSelect={() => onBump?.(key, -1)}>
                  -1 {COUNTER_META[key].label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onUntrack} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Untrack card
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

- [ ] **Step 2: Implement TrackedCardTray**

```tsx
// apps/web/src/components/TrackedCardTray.tsx
import type { Id } from '@convex/_generated/dataModel'
import type { CounterMap, CounterKey } from '@/lib/counter-types'
import { TrackedCardRow } from './TrackedCardRow'

export interface TrackedCardEntry {
  _id: Id<'trackedCards'>
  scryfallId: string
  name: string
  counters: CounterMap
}

interface TrackedCardTrayProps {
  cards: TrackedCardEntry[]
  editable: boolean
  onBump?: (id: Id<'trackedCards'>, type: CounterKey, delta: number) => void
  onUntrack?: (id: Id<'trackedCards'>) => void
}

export function TrackedCardTray({ cards, editable, onBump, onUntrack }: TrackedCardTrayProps) {
  if (cards.length === 0) return null
  return (
    <div className="absolute inset-x-2 bottom-2 z-20 max-h-32 overflow-y-auto rounded-lg border border-surface-3 bg-surface-1/90 p-1.5 backdrop-blur-sm">
      <div className="space-y-1">
        {cards.map(card => (
          <TrackedCardRow
            key={card._id}
            instanceId={card._id}
            scryfallId={card.scryfallId}
            name={card.name}
            counters={card.counters}
            editable={editable}
            onBump={(type, delta) => onBump?.(card._id, type, delta)}
            onUntrack={() => onUntrack?.(card._id)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/TrackedCardRow.tsx apps/web/src/components/TrackedCardTray.tsx
git commit -m "feat(web): TrackedCardTray + TrackedCardRow with counter UI"
```

---

## Task 8: PlayerResourceBadges

**Files:**
- Create: `apps/web/src/components/PlayerResourceBadges.tsx`

- [ ] **Step 1: Implement**

```tsx
// apps/web/src/components/PlayerResourceBadges.tsx
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import { Skull, Zap, Star } from 'lucide-react'

interface PlayerResourceBadgesProps {
  roomId: string
  poison: number
  energy: number
  experience: number
  editable: boolean
}

const ITEMS: Array<{ key: 'poison' | 'energy' | 'experience'; icon: typeof Skull; class: string }> = [
  { key: 'poison', icon: Skull, class: 'text-emerald-400' },
  { key: 'energy', icon: Zap, class: 'text-amber-300' },
  { key: 'experience', icon: Star, class: 'text-purple-300' },
]

export function PlayerResourceBadges({ roomId, poison, energy, experience, editable }: PlayerResourceBadgesProps) {
  const bump = useMutation(api.playerResources.bumpResource)
  const values = { poison, energy, experience }
  const visible = ITEMS.filter(i => editable || values[i.key] > 0)
  if (visible.length === 0) return null
  return (
    <div className="flex gap-1.5">
      {visible.map(({ key, icon: Icon, class: cls }) => {
        const val = values[key]
        const onClick = (e: React.MouseEvent) => {
          if (!editable) return
          bump({ roomId, type: key, delta: e.shiftKey ? -1 : 1 })
        }
        return (
          <button
            key={key}
            type="button"
            disabled={!editable}
            onClick={onClick}
            aria-label={`${key}: ${val}`}
            className={`inline-flex items-center gap-1 rounded-md border border-surface-3 bg-surface-2/70 px-1.5 py-0.5 text-xs ${cls} ${editable ? 'cursor-pointer hover:bg-surface-2' : 'cursor-default'}`}
          >
            <Icon className="h-3 w-3" />
            {val}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/PlayerResourceBadges.tsx
git commit -m "feat(web): PlayerResourceBadges (poison/energy/experience)"
```

---

## Task 9: Wire tray into LocalVideoCard + remote tile

**Files:**
- Modify: `apps/web/src/components/LocalVideoCard.tsx`
- Modify: `apps/web/src/components/VideoStreamGrid.tsx`

- [ ] **Step 1: Add tray to LocalVideoCard**

In `apps/web/src/components/LocalVideoCard.tsx`, import and render the tray. Add these imports:

```tsx
import { useTrackedCards } from '@/hooks/useTrackedCards'
import { TrackedCardTray } from './TrackedCardTray'
```

Inside the component (after the existing `orientation` hook), add:

```tsx
const { cards, bump, untrack } = useTrackedCards(roomId ?? '')
const myCards = cards.filter(c => c.ownerUserId === currentUser?.id)
```

In the JSX, after `<LocalMediaControls ...>` and before the closing `</PlayerVideoCard>`, render:

```tsx
{roomId && currentUser && (
  <TrackedCardTray
    cards={myCards}
    editable={true}
    onBump={bump}
    onUntrack={untrack}
  />
)}
```

- [ ] **Step 2: Add tray to RemotePlayerCard**

In `apps/web/src/components/VideoStreamGrid.tsx`, inside the `RemotePlayerCard` component, after `useVideoOrientation`:

```tsx
const { cards } = useTrackedCards(roomId)
const theirCards = cards.filter(c => c.ownerUserId === playerId)
```

Inside the `<div ref={videoContainerRef} ...>` JSX, after the badges row, render:

```tsx
<TrackedCardTray cards={theirCards} editable={false} />
```

Add the import at the top:

```tsx
import { useTrackedCards } from '@/hooks/useTrackedCards'
import { TrackedCardTray } from './TrackedCardTray'
```

- [ ] **Step 3: Typecheck + commit**

```bash
bun --cwd apps/web tsc --noEmit
git add apps/web/src/components/LocalVideoCard.tsx apps/web/src/components/VideoStreamGrid.tsx
git commit -m "feat(web): render tracked-card tray in local + remote tiles"
```

---

## Task 10: Add "Track this card" to detection right-click

**Files:**
- Modify: `apps/web/src/components/VideoOrientationContextMenu.tsx`
- Modify: `apps/web/src/components/LocalVideoCard.tsx`

- [ ] **Step 1: Make context menu accept extra items**

Edit `VideoOrientationContextMenu.tsx`:

```tsx
interface VideoOrientationContextMenuProps {
  orientation: UseVideoOrientationReturn
  children: ReactNode
  /** Optional items rendered at the top of the menu, above orientation items */
  topSlot?: ReactNode
}

export function VideoOrientationContextMenu({
  orientation, children, topSlot,
}: VideoOrientationContextMenuProps) {
  // ...existing isModified
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {topSlot}
        {topSlot && <ContextMenuSeparator />}
        {/* ...existing rotate/mirror/reset items */}
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

- [ ] **Step 2: Wire "Track this card" in LocalVideoCard**

In `LocalVideoCard.tsx`, import the latest CLIP query result (from `useCardQueryContext`) so we know what card is currently recognized. Then build a `topSlot`:

```tsx
import { useCardQueryContext } from '@/contexts/CardQueryContext'
import { ContextMenuItem } from '@repo/ui/components/context-menu'
import { Bookmark } from 'lucide-react'

// inside component
const cardQuery = useCardQueryContext()
const lastResult = cardQuery.state.result  // shape: { name, scryfall_uri, set, ... } — adjust to match
const { trackCard } = useTrackedCards(roomId ?? '')

const topSlot = lastResult ? (
  <ContextMenuItem
    onSelect={() => trackCard(lastResult.scryfallId, lastResult.name)}
  >
    <Bookmark className="mr-2 h-4 w-4" />
    Track {lastResult.name}
  </ContextMenuItem>
) : null

// pass to VideoOrientationContextMenu:
<VideoOrientationContextMenu orientation={orientation} topSlot={topSlot}>
```

> **Note:** confirm the field name on `CardQueryResult` — it may be `id`, `scryfallId`, or similar. Read `apps/web/src/types/card-query.ts` first.

- [ ] **Step 3: Typecheck + commit**

```bash
bun --cwd apps/web tsc --noEmit
git add apps/web/src/components/VideoOrientationContextMenu.tsx apps/web/src/components/LocalVideoCard.tsx
git commit -m "feat(web): right-click 'Track this card' on recognized cards"
```

---

## Task 11: Wire PlayerResourceBadges into player tile

**Files:**
- Modify: `apps/web/src/components/LocalVideoCard.tsx`
- Modify: `apps/web/src/components/VideoStreamGrid.tsx`

- [ ] **Step 1: Render in LocalVideoCard near LocalMediaControls**

After identifying where life total is shown (search for `health` or `PlayerStatsOverlay` integration in `LocalVideoCard`), render `<PlayerResourceBadges roomId={roomId} poison={participant?.poison ?? 0} energy={participant?.energy ?? 0} experience={participant?.experience ?? 0} editable />`.

- [ ] **Step 2: Render in RemotePlayerCard read-only**

Same component, `editable={false}`, sourcing values from `participantData`.

- [ ] **Step 3: Typecheck + commit**

```bash
bun --cwd apps/web tsc --noEmit
git add apps/web/src/components/LocalVideoCard.tsx apps/web/src/components/VideoStreamGrid.tsx
git commit -m "feat(web): render player resource badges on tiles"
```

---

## Task 12: Convex unit tests

**Files:**
- Create: `convex/__tests__/trackedCards.test.ts`

- [ ] **Step 1: Write tests using convex-test**

```ts
// convex/__tests__/trackedCards.test.ts
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../_generated/api'
import schema from '../schema'

describe('trackedCards', () => {
  it('lets owner track + bump + untrack', async () => {
    const t = convexTest(schema)
    const asAlice = t.withIdentity({ subject: 'alice', name: 'Alice' })
    const id = await asAlice.mutation(api.trackedCards.trackCard, {
      roomId: 'ROOM1', scryfallId: 'sc-1', name: 'Sol Ring',
    })
    await asAlice.mutation(api.trackedCards.bumpCounter, { instanceId: id, type: 'plus1plus1', delta: 3 })
    let list = await asAlice.query(api.trackedCards.listByRoom, { roomId: 'ROOM1' })
    expect(list[0].counters.plus1plus1).toBe(3)
    await asAlice.mutation(api.trackedCards.bumpCounter, { instanceId: id, type: 'plus1plus1', delta: -10 })
    list = await asAlice.query(api.trackedCards.listByRoom, { roomId: 'ROOM1' })
    expect(list[0].counters.plus1plus1).toBeUndefined()
    await asAlice.mutation(api.trackedCards.untrackCard, { instanceId: id })
    list = await asAlice.query(api.trackedCards.listByRoom, { roomId: 'ROOM1' })
    expect(list).toHaveLength(0)
  })

  it('forbids non-owner mutations', async () => {
    const t = convexTest(schema)
    const asAlice = t.withIdentity({ subject: 'alice' })
    const asBob = t.withIdentity({ subject: 'bob' })
    const id = await asAlice.mutation(api.trackedCards.trackCard, {
      roomId: 'ROOM1', scryfallId: 'sc-1', name: 'Sol Ring',
    })
    await expect(
      asBob.mutation(api.trackedCards.bumpCounter, { instanceId: id, type: 'plus1plus1', delta: 1 }),
    ).rejects.toThrow(/Forbidden/)
    await expect(
      asBob.mutation(api.trackedCards.untrackCard, { instanceId: id }),
    ).rejects.toThrow(/Forbidden/)
  })

  it('rejects unauthenticated callers', async () => {
    const t = convexTest(schema)
    await expect(
      t.mutation(api.trackedCards.trackCard, { roomId: 'r', scryfallId: 'x', name: 'y' }),
    ).rejects.toThrow(/Unauthenticated/)
  })
})
```

- [ ] **Step 2: Run + verify**

```bash
bun --cwd convex vitest run __tests__/trackedCards.test.ts
```

Expected: 3 passing.

- [ ] **Step 3: Commit**

```bash
git add convex/__tests__/trackedCards.test.ts
git commit -m "test(convex): trackedCards CRUD + auth coverage"
```

---

## Task 13: E2E test — track a card and bump counter

**Files:**
- Create: `apps/web/tests/e2e/counters.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// apps/web/tests/e2e/counters.spec.ts
import { test, expect } from '@playwright/test'

test('track a card and bump +1/+1 counter', async ({ page }) => {
  await page.goto('/')
  // Use existing helpers to create + enter a room as the seeded user.
  // (See tests/helpers/test-utils.ts for createRoomViaUI.)
  // ...
  // Once in the room, simulate a recognized card by setting card history directly,
  // then right-click on the local tile and choose "Track ..."
  // After tracking, expect the tray row + bump via badge click.
  // Implementation depends on existing test helpers — keep this stub realistic.
  test.skip(true, 'Stub — fill in with helpers in PR review')
})
```

> **Note for implementer:** the e2e test depends on existing test helpers (`createRoomViaUI`, fake card detection injection). Wire in once helpers are reviewed; ship as a `test.skip` placeholder if helpers don't yet exist for forcing a recognized card.

- [ ] **Step 2: Commit**

```bash
git add apps/web/tests/e2e/counters.spec.ts
git commit -m "test(e2e): scaffold counters spec (skipped pending helpers)"
```

---

## Task 14: Final review pass

- [ ] **Step 1: Typecheck + lint + format the whole repo**

```bash
bun run preflight
```

- [ ] **Step 2: Manual verify in dev**

```bash
bun run dev
```

- Open two browsers, two accounts, join the same room
- User A right-clicks recognized card → "Track ..." → row appears in A's tile tray AND in A's tile rendered inside B's grid
- User A clicks +1/+1 badge → count increments for both
- User B right-click on A's tray row → menu does NOT show (read-only)
- User A: poison badge → click bumps; B sees the new value

- [ ] **Step 3: Open PR**

```bash
git push
gh pr create --base setup-card-detection --title "feat: card counters (Commander)" --body "Implements docs/superpowers/specs/2026-04-24-counters-design.md"
```
