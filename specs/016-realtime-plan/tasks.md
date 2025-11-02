# Tasks: Discord Gateway Realtime Communications Platform

**Input**: Design documents from `/specs/016-realtime-plan/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Add the tests called out per user story. Focus on Vitest for server units and integration harnesses under `apps/web/tests`.

**Organization**: Tasks are grouped by user story so each increment is independently implementable and verifiable.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Backend code lives in `apps/web/src/server`
- Frontend React hooks live in `apps/web/src/hooks`
- API routes live in `apps/web/src/routes`
- Shared gateway types reside in `packages/discord-gateway`
- Tests live in `apps/web/tests`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare environment configuration and testing scaffolding used by all stories

- [ ] T001 Update `.env.example` with `GATEWAY_WS_URL`, `LINK_TOKEN`, and `ENABLE_WS_BRIDGE` placeholders for the realtime gateway secrets
- [ ] T002 Create `apps/web/tests/server/README.md` and `apps/web/tests/integration/README.md` to describe new realtime test suites and ensure directories exist

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core gateway primitives that must exist before delivering story-specific behavior

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Update `packages/discord-gateway/src/types.ts` with versioned `TraceMeta`, `GatewayEvent`, and `GatewayCommand` contracts and sanitize helpers
- [ ] T004 Export the new realtime contracts from `packages/discord-gateway/src/index.ts` and `packages/discord-gateway/types/index.d.ts`
- [ ] T005 Add `apps/web/src/server/gateway/event-bus.ts` implementing the in-memory `EventBus<GatewayEvent>` with safe subscriber teardown
- [ ] T006 Add `apps/web/src/server/gateway/command-queue.ts` encapsulating the capped retry queue with jitter backoff controls
- [ ] T007 Add `apps/web/src/server/gateway/config.ts` to parse `GATEWAY_WS_URL`, `LINK_TOKEN`, and feature flags with descriptive errors
- [ ] T008 Add `apps/web/src/server/metrics/gateway-metrics.ts` exposing counters, histograms, and gauges for gateway health

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Stream multi-domain Discord events to web clients (Priority: P1) 🎯 MVP

**Goal**: Unify inbound gateway traffic through a singleton client and broadcast via `/api/stream` SSE with observability guarantees

**Independent Test**: Connect a browser to `/api/stream`, inject `messageCreate`, `voice.joined`, and `voice.left` frames via the gateway mock, and verify SSE delivers each event with trace metadata and heartbeat cadence within latency targets

### Implementation for User Story 1

- [ ] T009 [US1] Implement `apps/web/src/server/gateway/gateway-ws.client.ts` to lazily connect, reconnect with backoff, fan out events, and emit logs/metrics
- [ ] T010 [P] [US1] Implement `apps/web/src/server/gateway/sse-router.server.ts` to translate bus events into SSE frames with 15s heartbeats
- [ ] T011 [US1] Add `apps/web/src/routes/api/stream.ts` to wire the SSE handler into TanStack Start and ensure `gateway.start()` is invoked
- [ ] T012 [US1] Refactor `apps/web/src/server/init/start-ws.server.ts` to bootstrap the singleton gateway client instead of the legacy Discord connector
- [ ] T013 [US1] Replace `apps/web/src/server/init/discord-gateway-init.ts` with a facade that delegates lifecycle controls to the new `GatewayWsClient`
- [ ] T014 [US1] Update `apps/web/src/server/internal-events-handler.server.ts` to emit incoming hub fallbacks onto the event bus with structured logging
- [ ] T015 [US1] Add Vitest coverage in `apps/web/tests/server/gateway-ws.test.ts` for reconnect logic, queue overflow, and event bus fan-out
- [ ] T016 [US1] Add integration test `apps/web/tests/integration/realtime-bridge.test.ts` that streams mock gateway events and asserts SSE delivery + metrics gauges

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Send Discord commands from the browser (Priority: P2)

**Goal**: Provide rate-limited, authorized server functions that enqueue gateway commands with traceability

**Independent Test**: Call the `sendMessage`, `addReaction`, and `typingStart` server functions under varying auth/rate-limit conditions and verify Gateway commands, logs, and HTTP responses align with the contract

### Implementation for User Story 2

- [ ] T017 [US2] Implement `apps/web/src/server/gateway/rate-limiter.ts` providing per-user and per-channel token buckets
- [ ] T018 [P] [US2] Add `apps/web/src/server/actions/send-message.ts` using Zod validation, auth checks, rate limiter, and command queue dispatch
- [ ] T019 [P] [US2] Add `apps/web/src/server/actions/add-reaction.ts` mirroring validation, auth, and logging requirements
- [ ] T020 [P] [US2] Add `apps/web/src/server/actions/typing-start.ts` with shared guardrails and metrics emission
- [ ] T021 [US2] Update `apps/web/src/server/gateway/gateway-ws.client.ts` to publish command lifecycle logs and expose queue saturation errors to callers
- [ ] T022 [US2] Add Vitest coverage in `apps/web/tests/server/gateway-commands.test.ts` for rate limiting, auth failures, and queue overflow responses
- [ ] T023 [US2] Add integration test `apps/web/tests/integration/gateway-commands.test.ts` to assert Gateway frames issued over the mocked socket and HTTP status mappings

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Migrate existing realtime consumers to the unified bus (Priority: P3)

**Goal**: Preserve voice dropout UX while routing all consumers through the unified event bus and optional legacy bridge

**Independent Test**: Trigger a simulated voice dropout while the new gateway client runs, confirm `VoiceDropoutModal` behavior, absence of duplicate `/api/ws` sockets when flag disabled, and presence of queued commands during outages

### Implementation for User Story 3

- [ ] T024 [US3] Implement `apps/web/src/server/legacy/voice-bridge.ts` to relay bus events into `wsManager.broadcastToGuild` behind a feature flag
- [ ] T025 [US3] Update `apps/web/src/server/managers/ws-manager.ts` and `apps/web/src/server/ws-server.server.ts` to consume the legacy bridge feed and expose connection gauges
- [ ] T026 [US3] Update `apps/web/src/routes/api/ws.ts` to respect `ENABLE_WS_BRIDGE` and document deprecation messaging
- [ ] T027 [US3] Refactor `apps/web/src/hooks/useVoiceChannelEvents.ts` to source events from `/api/stream` while reusing the bus adapter when SSE unavailable
- [ ] T028 [US3] Update `apps/web/src/hooks/useVoiceChannelMembersFromEvents.ts` to rely on the unified hook outputs and drop direct WebSocket handling
- [ ] T029 [US3] Add integration test `apps/web/tests/integration/voice-dropout-sse.test.ts` exercising the voice modal flow via SSE + legacy bridge toggle

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repository-wide documentation, observability, and rollout cleanup

- [ ] T030 Update `docs/VOICE_CHANNEL_EVENTS_REFACTOR.md` and related voice dropout docs with unified gateway + SSE architecture details
- [ ] T031 Refresh `docs/IMPLEMENTATION_SUMMARY.md` and `docs/VOICE_DROPOUT_QUICK_START.md` with new server functions, feature flag instructions, and test steps
- [ ] T032 Add operational runbook entry to `docs/VOICE_DROPOUT_CHECKLIST.md` covering queue saturation alerts and SSE monitoring
- [ ] T033 Validate quickstart instructions in `specs/016-realtime-plan/quickstart.md` against the implemented endpoints and update if needed
- [ ] T034 Perform final lint/test sweep (`pnpm lint`, `pnpm test`, `pnpm --filter @repo/web test`) and capture results in PR notes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-5)**: Each depends on Foundational phase completion; proceed in priority order (US1 → US2 → US3)
- **Polish (Phase 6)**: Depends on completion of targeted user stories and associated tests

### User Story Dependencies

- **User Story 1 (P1)**: Requires Phase 2 primitives. No dependency on other stories.
- **User Story 2 (P2)**: Requires Phase 2 + User Story 1 gateway client exports.
- **User Story 3 (P3)**: Requires Phases 2-4 to ensure unified bus and commands exist before migration.

### Within Each User Story

- Implement shared modules before consuming them (e.g., gateway client before SSE route).
- Write or update tests immediately after implementing functionality.
- Maintain observability (logging/metrics) alongside feature code to meet acceptance criteria.

### Parallel Opportunities

- [Setup] T001 and T002 can run concurrently.
- [Foundational] T003-T008 touch distinct files and can proceed in parallel once environment prep finishes.
- [US1] T010 and T011 can run alongside T009 once the client interface stabilizes.
- [US2] T018-T020 can run in parallel; they depend on T017.
- [US3] T027 and T028 can proceed together after bridge tasks (T024-T026) complete.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2 tasks.
2. Deliver Phase 3 tasks to establish unified inbound streaming.
3. Run independent tests (T015, T016) and validate SSE delivery before proceeding.

### Incremental Delivery

1. Foundation ready → ship US1 (core streaming).
2. Layer US2 (commands + rate limiting) once gateway client dispatch ready.
3. Migrate legacy consumers under US3 with feature flag guardrails.
4. Finish with documentation and operational polish in Phase 6.

### Parallel Team Strategy

- Developer A: Focus on Foundational tasks T003-T008, then lead US1 (T009-T016).
- Developer B: After Phase 2, tackle US2 command handlers (T017-T023).
- Developer C: Once US1+US2 stabilized, migrate voice hooks under US3 (T024-T029) and drive polish tasks.

---

## Notes

- [P] tasks = different files, no dependencies; schedule them to maximize throughput.
- Keep user stories independently testable; stop after each checkpoint for validation.
- Maintain traceId propagation and metrics per acceptance criteria while implementing each module.
- Update tasks as implementation reveals new shared primitives, keeping checklist format intact.
