# Streaming Overhaul: Managed SFU + Simplified Media Pipeline

## Summary

- Replace the current full-mesh WebRTC + Convex signaling path with a managed SFU, using **LiveKit Cloud** as the concrete target. Keep **Convex** as the source of truth for room access, presence, moderation, and game state.
- Optimize for the current product shape: **up to 4 players, one primary overhead/playmat camera + one mic per player**.
- The main outcomes are:
  - reduce sender uplink from full-mesh `O(n-1)` to **one upstream publish per participant**
  - remove the current **STUN-only** failure mode by using provider-managed relay/TURN
  - delete the custom SDP/ICE/signaling/watchdog stack
  - simplify local media ownership so the app no longer rebuilds `MediaStream`s and reattaches elements via timers/polling

## Key Changes

### 1. Transport and backend

- Introduce a new Convex server endpoint, `api.media.issueAccessToken({ roomId })`, that:
  - verifies the caller is an active room member
  - issues a short-lived **LiveKit** access token
  - uses **room name = current `roomId`**
  - uses **participant identity = current `sessionId`**
  - includes `userId` and `username` in participant metadata for mapping back to Convex presence
- Add Convex env vars for the media provider: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- Keep `useConvexPresence` for roster, seat count, duplicate-session handling, moderation, and in-room state.
- Remove the current custom transport path after migration soak:
  - `convex/signals.ts`
  - `roomSignals` usage and cleanup cron
  - `useConvexSignaling`
  - `useConvexWebRTC`
  - `useConvexWebRTC.helpers`
  - `WebRTCManager`
  - `WebRTCSignal` transport types

### 2. Frontend media session

- Replace the current room transport hook with a new `useRoomMediaSession` built on `livekit-client`.
- `useRoomMediaSession` should:
  - connect only after Convex presence is ready and the local session exists
  - connect the LiveKit `Room` with `adaptiveStream: true` and `dynacast: true`
  - publish one camera track and one microphone track
  - expose:
    - room connection state
    - local camera/mic enabled state
    - remote participant media map keyed by `sessionId`
    - publish/subscription errors
- Do not reimplement reconnect/watchdog logic. Use provider room events (`Reconnecting`, `Reconnected`, `Disconnected`, participant/track events) as the source of truth.

### 3. Local capture and quality profile

- Replace the current split `video` + `audio` hooks plus `combinedStream` assembly with a single `useLocalMediaSession`.
- `useLocalMediaSession` owns:
  - selected device IDs from the existing preference store
  - one stable preview/publish stream identity
  - acquisition/reacquisition on initial setup or device change only
- Default capture profile:
  - camera: **1920x1080 @ 15fps**
  - `contentHint = 'detail'`
  - microphone: mono voice capture with browser defaults
- Publishing profile:
  - enable simulcast/adaptive layers through LiveKit defaults
  - no custom per-peer bitrate logic in app code
- Toggle behavior:
  - camera off: unpublish/disable camera and stop capture to save upstream payload
  - camera on: reacquire selected camera and republish
  - mic off/on: use provider mute/unmute API, without renegotiation logic in app code
  - device switching: use provider/device APIs plus a single reacquire path, not manual sender replacement code

### 4. Rendering and UI simplification

- Replace `useVideoStreamAttachment` and manual `srcObject`/`load()`/`play()` orchestration with a small `MediaTrackElement` component:
  - accepts a provider video/audio track reference
  - uses SDK `attach()` / `detach()` in one effect
- Remote tile state should derive from:
  - Convex presence for “player is in room / offline”
  - LiveKit participant/track publication state for “camera off / mic off / reconnecting”
- Keep the existing room grid and overlays, but feed them SDK-native track/publication data.
- Remove 500ms remote track polling and timer-based forced reloads.

### 5. Rollout and cleanup

- Add a transport feature flag, `VITE_MEDIA_TRANSPORT`, with values `p2p` and `sfu`.
- Phase rollout:
  1. add token issuance + LiveKit connection behind `sfu`
  2. migrate local capture and remote tile rendering
  3. update diagnostics and E2E harness
  4. soak on `sfu`
  5. delete `p2p` path, Convex signaling schema usage, and obsolete helpers
- Add a lightweight debug surface for room state:
  - provider connection state
  - participant publish/subscription state
  - selected devices
  - last transport error
- Gate verbose logging behind a debug flag and remove unconditional transport `console.log` noise.

## Public APIs / Interfaces

- Add `api.media.issueAccessToken({ roomId })` in Convex.
- Add `useRoomMediaSession({ roomId, sessionId, userId, username, enabled })`.
- Add `useLocalMediaSession(...)` and make `MediaStreamContext` expose local device/capture state only.
- Retire the app-owned WebRTC signaling interfaces and manager classes once the `sfu` path is default.

## Test Plan

- Unit:
  - token issuance rejects non-members and returns room/session-scoped metadata for active members
  - local media controller preserves stable preview state and only reacquires on device change or camera re-enable
  - remote participant mapping correctly joins Convex presence to LiveKit participants by `sessionId`
- Integration:
  - mocked `livekit-client` tests for connect, publish, mute/unmute, participant join/leave, reconnect, and camera republish
- E2E:
  - keep the existing 4-player room, toggle-matrix, and torture suites
  - update diagnostics to assert provider room/participant state instead of raw `RTCPeerConnection` internals
  - acceptance scenarios:
    - 4 players join and all remotes render video/audio
    - camera toggle propagates to all receivers without stale/frozen tiles
    - mic toggle propagates without reconnect churn
    - page reload rejoins and converges
    - sender publishes a single upstream track regardless of receiver count

## Assumptions and Defaults

- Managed media backend is **LiveKit Cloud**, not self-hosted SFU.
- Maximum room size for this refactor remains **4 players**.
- No spectator mode, second camera, or larger-room transport work is included in this pass.
- Convex remains the system of record for room membership and moderation; the SFU handles media only.
- Cross-browser support should remain compatibility-first; rely on LiveKit defaults rather than app-managed codec policy in v1 of this migration.
