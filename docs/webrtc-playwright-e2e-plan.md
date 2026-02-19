# Playwright WebRTC E2E Plan (Aligned to Current Repo)

This plan adapts the provided WebRTC E2E guidance to the existing Playwright test layout in
`apps/web/tests`, the shared helpers, and the current Playwright configuration. It is scoped
to GitHub Actions (Ubuntu) and local runs, with deterministic fake media, reliable assertions,
and a path for device switching. This plan assumes the existing `room.setup.ts` project creates
rooms and auth storage, and it extends the existing media-mocking helpers where possible. 【F:apps/web/playwright.config.ts†L1-L58】【F:apps/web/tests/helpers/test-utils.ts†L18-L284】

---

## 1) Align on existing Playwright structure

**Current structure**

- Playwright config: `apps/web/playwright.config.ts` (projects, baseURL, permissions, webServer).【F:apps/web/playwright.config.ts†L1-L58】
- Tests live under `apps/web/tests/e2e` and `apps/web/tests/visual`.【F:apps/web/playwright.config.ts†L1-L58】
- Room creation and shared state lives in `apps/web/tests/room.setup.ts` and helpers in
  `apps/web/tests/helpers/test-utils.ts` (room ID, storage, media mocks).【F:apps/web/tests/helpers/test-utils.ts†L18-L284】

**Plan adaptation**

- Place new WebRTC E2E tests in `apps/web/tests/e2e/` to match `testMatch`.
- Add new helpers inside `apps/web/tests/helpers/` (e.g., `media-assertions.ts` and
  `launch-player.ts`) mirroring existing helper location and conventions.
- Use the existing `room-setup` project in `playwright.config.ts` so tests can reuse the
  cached room ID (via `getRoomId()` / room state storage).【F:apps/web/playwright.config.ts†L1-L58】【F:apps/web/tests/helpers/test-utils.ts†L64-L149】

---

## 2) Fixture strategy (deterministic audio + video)

**Goal:** deterministic fake camera + mic input for 4 separate players.

**Plan**

- Add fixtures under `apps/web/tests/assets/webrtc/` (or `apps/web/tests/assets/fixtures/`) to
  match the current test assets structure. This keeps test assets colocated with existing
  tests (`apps/web/tests/assets` already exists).【F:apps/web/tests/helpers/test-utils.ts†L18-L284】
- Generate `.y4m` and `.wav` fixtures for 4 players as described (distinct patterns/tones).
- Commit fixtures to repo to avoid CI dependency on ffmpeg. Optionally provide a script under
  `apps/web/tests/assets/scripts/` for regeneration if needed.

**Why this aligns with current code**

- Current tests already use Playwright in a controlled environment with a fixed base URL and
  permissions set in `playwright.config.ts`, so fixture-driven fake devices are a clean
  extension. 【F:apps/web/playwright.config.ts†L1-L58】

---

## 3) Launch 4 players with fake devices (Chromium flags)

**Goal:** each player gets its own fake camera/mic stream.

**Plan**

- Introduce a helper `launchPlayer` (in `apps/web/tests/helpers/launch-player.ts`) that:
  - launches Chromium with:
    - `--use-fake-device-for-media-stream`
    - `--use-fake-ui-for-media-stream`
    - `--use-file-for-fake-video-capture=...`
    - `--use-file-for-fake-audio-capture=...`
    - `--autoplay-policy=no-user-gesture-required`
  - creates a context with `permissions: ['camera', 'microphone']` to match the existing
    Playwright defaults in `playwright.config.ts`.【F:apps/web/playwright.config.ts†L1-L58】

**Notes**

- Each player must be its own browser process to use per-process fake capture files.
- This aligns with the repo’s use of Playwright’s Chromium project and permissions.

---

## 4) Room join and auth flow (match existing helpers)

**Goal:** 4 players join the same room deterministically.

**Plan**

- Continue to rely on `room.setup.ts` and the shared room state file:
  - `room.setup.ts` creates or caches the room ID.
  - `getRoomId()` reads the cached value for tests. 【F:apps/web/tests/helpers/test-utils.ts†L64-L149】
- For each player:
  - apply auth storage (existing `auth-storage` helpers).
  - navigate to `/game/:roomId` using `navigateToTestGame(...)` to reuse existing patterns
    for media preferences and duplicate-session handling. 【F:apps/web/tests/helpers/test-utils.ts†L151-L233】

**Why this aligns**

- The repository already caches room ID and handles duplicate sessions in helper utilities.
- This avoids reimplementing session auth logic.

---

## 5) Assertions: video frames and audio energy

**Goal:** verify remote video renders and audio is non-silent without relying on OS output.

**Plan**

- Add `media-assertions.ts` in `apps/web/tests/helpers/` with:
  - `expectVideoRendering(page, selector)` (canvas hash / frame change)
  - `expectAudioEnergy(page, selector)` (WebAudio RMS)
- Prefer using existing selectors in `VideoStreamGrid` or data-testid attributes
  (e.g., `[data-testid="remote-video"]`) after verifying actual DOM in the app.

**Alignment with current code**

- Existing tests already use `@playwright/test` expect patterns and helpers.
- Helpers follow the shared helper pattern in `apps/web/tests/helpers/test-utils.ts`.【F:apps/web/tests/helpers/test-utils.ts†L18-L284】

---

## 6) Toggle on/off tests (sender + receiver)

**Goal:** validate mic/camera toggles from both sender and receiver perspectives.

**Plan**

1. **Sender-side:**
   - Use UI controls (existing buttons in the room) to toggle mic/camera.
   - Optionally introduce a test hook in app state (CI-only) to read local track `enabled`
     states for deterministic sender-side assertions.
2. **Receiver-side:**
   - After sender mutes mic, assert remote audio energy drops below threshold.
   - After sender disables camera, assert frame updates stop or verify via stats hooks.

**Alignment**

- The repo already mocks media preferences in `navigateToTestGame` and exposes device mocks,
  so adding a test-only hook would extend the same testing philosophy. 【F:apps/web/tests/helpers/test-utils.ts†L151-L233】

---

## 7) Device switching (virtual device adapter)

**Goal:** deterministic device switching in CI, independent of OS enumeration.

**Plan**

- Extend existing mocks in `apps/web/tests/helpers/test-utils.ts`:
  - `mockMediaDevices()` already overrides `enumerateDevices()`. Enhance it (or add a new
    helper) to support a test-only “virtual device adapter”.
  - `mockGetUserMedia()` already returns a fake stream; extend it to return different streams
    per `deviceId` (e.g., canvas patterns + audio oscillators).
- Run a separate suite (e.g., `e2e/webrtc-device-switching.spec.ts`) that:
  - verifies device list UI
  - switches camera/mic sources
  - asserts remote media updates accordingly.

**Alignment**

- Existing helpers already include `mockMediaDevices()` and `mockGetUserMedia()`, so this
  plan extends that infrastructure rather than introducing a parallel system. 【F:apps/web/tests/helpers/test-utils.ts†L234-L329】

---

## 8) Proposed test suite layout

```
apps/web/tests
  assets/
    webrtc/
      p1.y4m
      p1.wav
      p2.y4m
      p2.wav
      p3.y4m
      p3.wav
      p4.y4m
      p4.wav
  helpers/
    launch-player.ts
    media-assertions.ts
    (existing) test-utils.ts
  e2e/
    webrtc-4p-room.spec.ts
    webrtc-device-switching.spec.ts
```

---

## 9) GitHub Actions alignment

**Current:** Playwright config uses webServer and CI-friendly defaults, including retries and
`workers: 1` on CI. 【F:apps/web/playwright.config.ts†L1-L58】

**Plan**

- Add a CI job under `.github/workflows/` (if not already present) to run `bun run e2e` with:
  - `npx playwright install --with-deps chromium`
  - `bun install` / `bun run e2e`
  - Set environment variables expected by auth setup (already used in `room.setup.ts`).
- Ensure E2E secrets align with `auth-storage` helper requirements and `room.setup.ts`
  (E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, VITE_CONVEX_URL).

---

## 10) Minimum viable implementation checklist

1. **Fixtures committed** under `apps/web/tests/assets/webrtc/`.
2. **launchPlayer helper** with Chromium fake device flags.
3. **WebRTC 4-player spec**:
   - 4 players login/join same room
   - each sees at least one remote video with changing frames
   - each sees audio energy above threshold
4. **Toggle tests**:
   - sender mic off → receiver audio silent
   - sender camera off → receiver video stops updating
5. **Phase 2**:
   - virtual device adapter for deterministic device switching tests.

---

## 11) Success criteria (CI + local)

- 4 browsers join the same room on GitHub Actions Ubuntu.
- Each browser renders remote video with changing frames.
- Each browser detects non-silent remote audio via WebAudio.
- Mic/cam toggles update sender state and receiver behavior.
- (Optional) Device switching UX validated via virtual device adapter.

---

## 12) Confidence model

Automated WebRTC E2E tests provide strong regression detection but cannot
guarantee "100% certainty" that streaming works in all real-world conditions.
The confidence strategy is layered:

### Tier 1: Deterministic mocked-media E2E (PR gate)

- **What it covers:** Room join flow, WebRTC signaling/connection convergence,
  remote video frame rendering, remote audio energy detection, basic UI state.
- **Confidence level:** High for regression detection. Catches broken
  signaling, missing tracks, frozen video, and silent audio before merge.
- **Limitations:** Uses canvas-based fake camera + oscillator audio. Does not
  exercise real hardware codecs, network transport jitter, or browser media
  pipeline edge cases.

### Tier 2: Toggle matrix + torture suite (nightly / manual)

- **What it covers:** Sender→receiver camera/mic toggle propagation (NxN
  matrix), rapid toggle bursts, concurrent toggle storms across all players,
  player page reload/reconnect, long-running connection stability.
- **Confidence level:** High for stability and race-condition detection.
  Catches state-machine bugs, track replacement failures, stuck connections,
  and reconnect regressions.
- **Limitations:** Still runs with mocked media in headless Chromium. Cannot
  detect hardware-specific failures (e.g. macOS camera permission revocation,
  Bluetooth headset switching, mobile browser backgrounding).

### Tier 3: Manual real-device canary (periodic)

- **What it covers:** Actual camera/microphone hardware, real network
  conditions, cross-browser behavior (Firefox, Safari), mobile browsers,
  device switching mid-call.
- **Confidence level:** Catches hardware/OS/browser integration issues that
  automation cannot reproduce.
- **When to run:** Before major releases, after WebRTC library upgrades, or
  when users report streaming issues.

### What these tests cannot guarantee

- Network partition recovery across real ISPs / NAT topologies.
- Performance under CPU/memory pressure on user devices.
- Browser autoplay policy changes or WebRTC API deprecations.
- Codec negotiation between different browser engines.

These gaps are inherent to browser automation and should be addressed through
monitoring, user feedback channels, and periodic manual QA rather than
attempting to automate the untestable.
