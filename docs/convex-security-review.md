# Convex backend security & abuse review

Date: 2026-02-22
Scope: `convex/*.ts` backend functions, auth wiring, schema, and cron cleanup.

## Executive summary

The backend has a solid baseline of auth checks for most room/player mutations, but there are several meaningful abuse and security risks:

1. **Signal cleanup endpoint was externally callable (high)** and could be abused for room-level signaling disruption (DoS). This was fixed by converting `cleanupSignals` into an `internalMutation` so clients can no longer invoke it directly.
2. **Room code generation has a race condition (high)** due to non-atomic counter read/patch logic, and there is no explicit uniqueness guard for `rooms.roomId`.
3. **WebRTC signal payload is unbounded (medium/high abuse risk)** (`v.any()`), which can be used for oversized payload flooding and database growth.
4. **No explicit per-user rate limits on key write paths (medium)** (`joinRoom`, `heartbeat`, `sendSignal`) enables flood behavior even from authenticated users.
5. **Room discovery/enumeration remains possible in principle (low/medium)** through room code probing and status responses, though the code-space is large.

## Findings

## 1) Publicly callable signal cleanup enabled targeted DoS (FIXED)

- **Where:** `convex/signals.ts`
- **Issue:** `cleanupSignals` was defined as a regular public mutation with no auth/ownership check, allowing any client to delete all old signals for any `roomId`.
- **Abuse scenario:** attacker repeatedly calls cleanup for active rooms to interfere with slow or reconnecting peers that rely on retained signaling messages.
- **Fix applied:** changed `cleanupSignals` from `mutation` to `internalMutation`.
- **Residual risk:** none for direct external invocation; periodic global cleanup is still handled by cron.

## 2) Room ID counter update is not atomic, risking collisions/race bugs

- **Where:** `convex/rooms.ts` (`createRoom`)
- **Issue:** room counter is read, incremented in memory, and patched, but concurrent `createRoom` calls can read the same counter value before either patch commits.
- **Impact:** duplicate `roomId` generation risk and inconsistent room counter progression; can become a reliability and abuse vector under high concurrency.
- **Recommendation:** move ID allocation to an internal mutation with serialized semantics or use Convex patterns that guarantee atomic increments; add collision retry logic before insert.

## 3) Unbounded signaling payload allows storage/bandwidth abuse

- **Where:** `convex/signals.ts` (`sendSignal`)
- **Issue:** `payload` is `v.any()` with no size/type bounds.
- **Impact:** authenticated users can submit excessively large payloads, increasing DB writes, query fanout, and reactive sync costs.
- **Recommendation:** validate payload shape and enforce strict size caps (e.g., candidate length, SDP max bytes); reject unexpected fields.

## 4) Missing server-side rate limiting on high-frequency mutations

- **Where:** `convex/players.ts`, `convex/signals.ts`, `convex/rooms.ts`
- **Issue:** no token-bucket/throttle for `joinRoom`, `heartbeat`, `sendSignal`, or other expensive write paths (except room creation cooldown).
- **Impact:** authenticated spam/flood can degrade performance and increase costs.
- **Recommendation:** add per-user and per-room throttles (e.g., max heartbeats/min, max signals/sec, burst limits), and optionally soft-ban abusive sessions.

## 5) Room code and access checks permit some enumeration pressure

- **Where:** `convex/rooms.ts` (`checkRoomAccess`, room code generation)
- **Issue:** room IDs are deterministic permutations of a counter and access query reveals status distinctions.
- **Impact:** probabilistic scanning is still hard due to large namespace, but persistent probing can enumerate active rooms over time.
- **Recommendation:** add request throttling + abuse telemetry; optionally rotate to longer non-sequential random room IDs.

## 6) Preview login safety depends heavily on env gating

- **Where:** `convex/previewLogin.ts`, `convex/env.ts`, `convex/auth.ts`
- **Issue:** preview password auth and code-based login are gated by `E2E_TEST`, which is good, but accidental enablement in non-test environments would reduce auth posture.
- **Recommendation:** harden with explicit environment allow-list checks (e.g., require both `E2E_TEST=true` and deployment name pattern), and emit startup warning/error when preview mode is active outside CI.

## Positive controls observed

- Most sensitive mutations retrieve caller identity via `getAuthUserId` and verify ownership/membership.
- Ban/kick flows correctly enforce owner-only access.
- Presence-based membership checks reduce unauthorized room data access.
- Cron jobs exist for stale signal and inactive room cleanup.

## Recommended next actions (priority)

1. **P0:** Implement atomic room ID allocation + collision safety.
2. **P1:** Add payload schema + size caps for signaling.
3. **P1:** Add per-user/per-room rate limits for `sendSignal`, `heartbeat`, `joinRoom`.
4. **P2:** Add abuse telemetry (request counts, rejects, ban metrics).
5. **P2:** Strengthen preview-mode guardrails for non-test deployments.
