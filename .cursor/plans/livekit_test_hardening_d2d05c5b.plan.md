---
name: LiveKit Test Hardening
overview: Address remaining Playwright/test harness mismatches from the LiveKit refactor by making identity resolution, diagnostics, media seeding, and stability assertions explicit and consistent.
todos:
  - id: identity-resolution
    content: Fix toggle test player id resolution against actual Convex auth storage or a stable test hook
    status: completed
  - id: diagnostics-contract
    content: Rename and tighten LiveKit diagnostics helpers so missing diagnostics fail loudly
    status: completed
  - id: media-seeding
    content: Centralize committed media preference seeding across auth storage, navigation, and launch helpers
    status: completed
  - id: stability-assertions
    content: Split strict full-health assertions from connected-but-media-disabled assertions
    status: completed
  - id: track-health-contract
    content: Expose/test per-track LiveKit health state instead of relying only on room connection state
    status: completed
  - id: verification
    content: Run typecheck, lint, unit tests, Playwright list, then LiveKit-backed e2e/torture
    status: pending
isProject: false
---

# LiveKit Test Hardening Plan

## Scope

Harden the test suite around the current LiveKit implementation, focusing on behavior-affecting mismatches first and renaming/diagnostic clarity second.

Key files:

- [`apps/web/tests/helpers/toggle-assertions.ts`](apps/web/tests/helpers/toggle-assertions.ts)
- [`apps/web/tests/helpers/room-harness.ts`](apps/web/tests/helpers/room-harness.ts)
- [`apps/web/tests/helpers/media-assertions.ts`](apps/web/tests/helpers/media-assertions.ts)
- [`apps/web/tests/helpers/media-preferences.ts`](apps/web/tests/helpers/media-preferences.ts)
- [`apps/web/tests/helpers/auth-storage.ts`](apps/web/tests/helpers/auth-storage.ts)
- [`apps/web/tests/helpers/test-utils.ts`](apps/web/tests/helpers/test-utils.ts)
- [`apps/web/tests/helpers/launch-player.ts`](apps/web/tests/helpers/launch-player.ts)
- [`apps/web/src/components/VideoStreamGrid.tsx`](apps/web/src/components/VideoStreamGrid.tsx)
- [`apps/web/src/components/RemotePlayerCard.tsx`](apps/web/src/components/RemotePlayerCard.tsx)
- [`apps/web/src/contexts/RoomMediaContext.tsx`](apps/web/src/contexts/RoomMediaContext.tsx)
- [`apps/web/src/hooks/useMediaDiagnostics.ts`](apps/web/src/hooks/useMediaDiagnostics.ts)
- [`apps/web/src/types/media-session.ts`](apps/web/src/types/media-session.ts)

## Plan

1. Fix player identity resolution in toggle tests.
   - Replace JWT parsing in `resolvePlayerIds()` with logic that understands the actual Convex auth storage shape, especially raw JWT values under `__convexAuthJWT_*` keys.
   - Prefer a dedicated test-safe source if already available, such as diagnostics or a stable DOM data attribute, over brittle localStorage scanning.
   - Update comments so they no longer claim local player ids come from local video cards unless we add that selector.

2. Make LiveKit diagnostics strict and correctly named.
   - Rename helper concepts from “peer/WebRTC capture” to LiveKit/media diagnostics, while preserving attachment compatibility only if useful for existing reports.
   - In `assertAllPlayersMediaHealthy()`, fail when diagnostics are missing instead of silently skipping LiveKit room-state assertions.
   - Adjust diagnostic payload expectations to say `remoteSessionIds` are LiveKit session identities, not Convex user ids.

3. Align media preference seeding across all harnesses.
   - Use one shared helper for committed media preferences in `test-utils.ts`.
   - Apply it in `auth-storage.ts`, `launch-player.ts`, and any direct localStorage seeding in e2e specs.
   - Decide whether non-media navigation tests should publish media by default or explicitly seed `videoEnabled: false, audioEnabled: false`; make that choice consistent per test category.

4. Clarify and harden remote-card stability semantics.
   - Keep “full media health” strict: card exists, no offline warning, no connection warning, video element renders, audio element produces energy.
   - Add a separate “connected but media may be intentionally disabled” assertion for phases where toggles or room state do not require video/audio on.
   - Make `isRemoteCardStable()` and internal `isCardStable()` agree about whether audio is required.

5. Improve track-health visibility in the app/test contract.
   - Introduce `PeerMediaPresence` (`connected` / `pending` / `connecting` / `disconnected`) so peer warnings are decoupled from room transport state.
   - Surface per-track subscription/mute state on remote cards via `data-video-subscribed`, `data-audio-subscribed`, `data-video-muted`, and `data-audio-muted`.
   - Publish env-gated diagnostics to `window.__spellCovenMediaDiagnostics` for the e2e harness (`VITE_MEDIA_DIAGNOSTICS`).

6. Clean up remaining naming drift.
   - Rename test descriptions and helper names from WebRTC/peer language to LiveKit/media language where behavior and reports benefit.
   - Keep file names if renaming would create unnecessary churn, unless the suite owner wants the full rename.

## Verification

Run static checks first:

```sh
cd apps/web
bun run typecheck
bun run lint
bun run test
bun run playwright test --list
```

Then run browser tests with Convex preview + LiveKit env configured:

```sh
bun run convex:e2e:ui
cd apps/web && bun run e2e:torture
```

Use failure attachments to validate that diagnostics now show LiveKit room/session state and per-track media status clearly.

## Implementation notes

Shipped alongside this plan (prerequisite refactors):

- LiveKit is the sole in-room media owner; preview capture lives in setup only.
- Convex `videoEnabled` / `audioEnabled` presence flags removed; peer media state comes from LiveKit tracks.
- `RemotePlayerCard` extracted from `VideoStreamGrid`; `useDeviceList` and `useMediaDiagnostics` added.

Verification (Playwright e2e/torture with Convex preview + LiveKit env) remains pending in CI/local runs.
