# PR: develop → main

## Title

**E2E & CI improvements, WebRTC stability, AppHeader enhancements, and auth/env refactor**

---

## Description

```markdown
## Summary

Improves E2E and CI reliability, WebRTC reconnection and test diagnostics, AppHeader (commanders panel + theme), auth/env handling, and visual/Playwright snapshot consistency.

## Changes

### CI & E2E

- Add GitHub workflow for web E2E with preflight checks, browser installation/caching, and Node setup
- Run E2E after Convex deploy and write `.convex_url` for e2e env
- Simplify env var handling in scripts and docs; centralize E2E preview logic in env module

### Tests

- Add visual snapshots for game room and landing page; normalize Playwright snapshot paths (single `chromium` set)
- Expand WebRTC e2e with peer diagnostics, connection wait, and stability reporting
- Improve WebRTC remote card stability checks, timeout handling, and audio energy assertions
- Enhance game room tests (settings dialog, getOrCreateRoomId); expect redirect to setup when unauthenticated
- Refactor auth storage helper and media assertions for better action handling and readiness checks

### Web & WebRTC

- Reconnect stuck WebRTC peers in `useConvexWebRTC`
- AppHeader: commanders panel and theme settings
- Lint, types, and component fixes across GameRoom, PlayerList, VideoStreamGrid, and related UI

### Convex & Auth

- Fix type-only auth import and safe base32 string access in Convex
- Move preview login to `convex/previewLogin`, tighten env validation
- Portable URL export in convex preview script (#49)
- Refactor authentication logic to simplify environment variable requirements

### Infrastructure & UI

- Fix dialog portal container and reposition stability (packages/ui)
- Fix Vite SPA preview fallback to `index.html` and normalize request path
- Turbo env vars, tsconfig format, README and .gitignore updates
```
