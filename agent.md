# Spell Coven Agent Guide

## Purpose

This guide consolidates the most relevant operational knowledge for agents working in this repository. It distills the "You Might Not Need an Effect" memory notes and the active Specify rules so that day-to-day decisions stay aligned with the project direction.

## Repository Scope

- **Tech stack:** TypeScript 5.x, React 18+/19, Vite 7, Tailwind CSS 4.x, TanStack Router, Radix UI, Node.js 20+ build tooling, Transformers.js for browser ML workloads.
- **Supporting tooling:** Python 3.10+ (embedding/data pipelines), browser IndexedDB for model caching, FAISS index + JSONL metadata for offline assets.
- **Structure:** Primary packages live under `packages/` and `apps/`; shared scripts sit in `scripts/`.

## Coding Guidelines

1. **Prefer render-time derivations.** If a value is based solely on props or state, compute it inline during render instead of storing it in React state plus an Effect.
2. **Reserve Effects for external synchronization.** Only reach for `useEffect` (or similar hooks) when coordinating with systems outside React (e.g., DOM APIs, network requests, subscriptions). Keep each effect minimal and focused.
3. **Handle expensive calculations with `useMemo`.** When you need to memoize a pure computation, wrap it in `useMemo` tied to its dependencies instead of using an Effect and extra state.
4. **Reset state declaratively.** Use the `key` prop to remount components when wholesale state resets are required; for partial resets, derive the new state directly during render.
5. **Consolidate event-driven logic.** Move user-driven workflows into event handlers or shared helper functions so that notifications, navigation, and cascading updates occur within the initiating event, not post-render effects.
6. **Lift shared state.** When multiple components need coordinated data, lift the state to a common ancestor rather than syncing separate state slices via effects.
7. **Data fetching discipline.** Fetch data inside effects only when strictly necessary, guard against race conditions, and clean up subscriptions or async work on unmount.

## Tooling & Commands

- **Type checking:** `bun typescheck`
- **Lint (auto-fix):** `bun lint:fix`
- **Format (auto-fix):** `bun format:fix`
- **Run tests:** `bun test`

## Decision Checklist

Before adding an Effect, confirm all of the following:

- There is an external system interaction that cannot be handled during render or via event handlers.
- The logic cannot be expressed as a pure computation (`useMemo`/derived values) or through declarative state control (`key`, lifted state).
- Cleanup for subscriptions or async operations is implemented to avoid leaks or race conditions.
- Can some code be moved into a `useEffectEvent` (React 19.2) to replace `useRef`, or `use` to replace awaiting promises in `useEffect`.

## When in Doubt

- Prefer declarative solutions and composition over imperative patches.
- Keep Effects rare, focused, and justified by external dependencies.
- Align with the active technology matrix above when choosing libraries, language features, or runtime assumptions.
