# Tasks: Discord Private Voice Rooms

**Input**: Design documents from `/specs/015-discord-private-voice-rooms/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Implement the unit, integration, and component tests called out within each phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare environment variables and documentation required before enabling private Discord rooms.

- [X] T001 Update `apps/web/.env.example` with `ROOM_TOKEN_SECRET`, `ENABLE_PRIVATE_ROOMS`, and Discord permission guidance for private rooms.
- [X] T002 Document bot permissions, required OAuth scopes, and feature-flag rollout notes in `apps/web/README.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend contracts and Discord client helpers that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Create `apps/web/src/server/room-tokens.ts` with `createRoomInviteToken` and `verifyRoomInviteToken` helpers using `jose` and `createServerOnlyFn` for secrets.
- [X] T004 Extend `apps/web/src/server/schemas.ts` with zod schemas for room invite payloads, token errors, and shared Discord response fragments.
- [X] T005 Expand Discord role/channel/member/voice schemas in `packages/discord-integration/src/types/rest-schemas.ts` to support private room operations and join payloads.
- [X] T006 Implement `getChannel`, `getGuildRole`, `getGuildMember`, and `getVoiceStateSnapshot` methods in `packages/discord-integration/src/clients/DiscordRestClient.ts` with audit-log support.
- [X] T007 Implement `createRole`, `deleteRole`, `addGuildMember`, `addMemberRole`, `removeMemberRole`, and `countVoiceChannelMembers` in `packages/discord-integration/src/clients/DiscordRestClient.ts` using new schemas.
- [X] T008 Add permission overwrite builders in `packages/discord-integration/src/utils/permission-builders.ts` for everyone deny, role allow, bot allow, and optional creator allow cases.
- [X] T009 Re-export the new permission builders and REST helpers from `packages/discord-integration/src/utils/index.ts` and `packages/discord-integration/src/clients/index.ts`.
- [X] T010 Add Discord error-to-domain mapping utility in `packages/discord-integration/src/utils/error-map.ts` with typed error codes for server usage.
- [X] T011 [P] Add unit tests for token expiry, seat limits, and signature validation in `apps/web/src/server/__tests__/room-tokens.test.ts`.
- [X] T012 [P] Add unit tests for permission overwrite builders in `packages/discord-integration/src/utils/__tests__/permission-builders.test.ts`.

**Checkpoint**: Token service, Discord SDK helpers, and shared schemas are ready for feature work.

---

## Phase 3: User Story 1 - Creator shares a private room invite (Priority: P1) 🎯 MVP

**Goal**: As a room creator, I can generate a private Discord voice room and receive a shareable invite link with a signed token.

**Independent Test**: Calling `createRoom` and `refreshRoomInvite` returns channel + role metadata, invite token, and Discord deep link; refreshing regenerates only the token.

### Tests for User Story 1

- [ ] T013 [P] [US1] Add integration tests for `createRoom` and `refreshRoomInvite` in `apps/web/src/server/__tests__/discord-rooms.create.test.ts` using mocked Discord REST responses.
- [ ] T014 [P] [US1] Add component tests for share UI states in `apps/web/src/components/discord/__tests__/RoomInvitePanel.test.tsx`.

### Implementation for User Story 1

- [ ] T015 [US1] Update `apps/web/src/server/discord-rooms.ts` to create scoped roles/channels, apply permission builders, and return invite metadata plus deep link.
- [ ] T016 [US1] Implement `refreshRoomInvite` in `apps/web/src/server/discord-rooms.ts` to regenerate tokens for existing channel/role pairs.
- [ ] T017 [P] [US1] Define create/refresh request and response schemas in `apps/web/src/server/schemas.ts` covering deep link, token expiry, and share URL.
- [ ] T018 [US1] Update `apps/web/src/routes/index.tsx` to call the enhanced `createRoom`, persist invite metadata, and honor the private rooms feature flag.
- [ ] T019 [P] [US1] Build `RoomInvitePanel` UI in `apps/web/src/components/discord/RoomInvitePanel.tsx` for copy/share/regenerate actions.
- [ ] T020 [US1] Integrate the invite panel into `apps/web/src/components/LandingPage.tsx`, wiring copy + regenerate handlers to server mutations.
- [ ] T021 [US1] Extend `apps/web/src/lib/session-storage.ts` to store creator invite state (channelId, token, expiry) for later refreshes.

**Checkpoint**: Creators can provision rooms, copy invites, and refresh tokens without manual Discord setup.

---

## Phase 4: User Story 2 - Invitee joins via shareable link (Priority: P1)

**Goal**: As an invited friend, I can follow the share URL, authenticate, and gain access to the private voice room with clear success/error states.

**Independent Test**: Visiting `/game/{roomId}?t=token` triggers authentication, validates `joinRoom`, enforces guild membership, and returns the Discord deep link or actionable errors.

### Tests for User Story 2

- [ ] T022 [P] [US2] Add integration tests for `joinRoom` invariants in `apps/web/src/server/__tests__/discord-rooms.join.test.ts` covering expired tokens, room full, and missing role.
- [ ] T023 [P] [US2] Add route/component tests for `/game/$gameId` join success and error states in `apps/web/src/routes/__tests__/game.$gameId.test.tsx`.

### Implementation for User Story 2

- [ ] T024 [US2] Implement `joinRoom` flow in `apps/web/src/server/discord-rooms.ts` to verify tokens, ensure guild membership, assign roles, fetch voice join payload, and return deep link plus session data.
- [ ] T025 [P] [US2] Define join request/response schemas in `apps/web/src/server/schemas.ts` including error codes and voice session payload.
- [ ] T026 [US2] Update `apps/web/src/routes/game.$gameId.tsx` to parse the invite token, enforce Discord auth, call `joinRoom`, and surface loading/error messaging.
- [ ] T027 [P] [US2] Create `JoinRoomStatus` component in `apps/web/src/components/discord/JoinRoomStatus.tsx` for deep link, retry, and error messaging.
- [ ] T028 [US2] Integrate join status UI and voice session handling into `apps/web/src/components/GameRoom.tsx`.
- [ ] T029 [US2] Persist invite join state (token, deep link, status) via `apps/web/src/lib/session-storage.ts` for reconnect/resume scenarios.

**Checkpoint**: Invitees can reliably join rooms through the web app with accurate Discord state synchronization.

---

## Phase 5: User Story 3 - Operational controls & cleanup (Priority: P2)

**Goal**: As an operator, I can monitor and clean up private rooms with feature gating, logging, and automated teardown when rooms become empty.

**Independent Test**: Feature flag toggles room endpoints, logs include token `jti`/channel IDs, and cleanup routines remove roles/channels after rooms empty via gateway events.

### Implementation for User Story 3

- [ ] T030 [P] [US3] Add structured logging and Discord error translation in `apps/web/src/server/discord-rooms.ts` for create/join/refresh flows using the error map utility.
- [ ] T031 [US3] Apply `ENABLE_PRIVATE_ROOMS` feature flag checks in `apps/web/src/server/discord-rooms.ts` and `apps/web/src/routes/index.tsx`.
- [ ] T032 [US3] Enhance cleanup helpers in `apps/web/src/server/discord-rooms.ts` to remove roles and channels when tokens expire or voice channels empty out.
- [ ] T033 [US3] Update `packages/discord-gateway-worker/src/gateway.ts` to detect empty voice channels and invoke the cleanup server function.
- [ ] T034 [US3] Document operational runbook updates and remediation steps in `specs/015-discord-private-voice-rooms/runbook.md`.

**Checkpoint**: Operators can enable/disable the feature, trace issues, and rely on automated cleanup.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation and quality checks after feature stories land.

- [ ] T035 [P] Capture manual QA scenarios and edge cases in `specs/015-discord-private-voice-rooms/manual-qa.md`.
- [ ] T036 [P] Update `packages/discord-integration/README.md` with new REST helpers and usage examples for private rooms.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → No prerequisites.
- **Foundational (Phase 2)** → Depends on Phase 1; blocks all user stories.
- **User Story 1 (Phase 3)** → Depends on Phase 2 completion.
- **User Story 2 (Phase 4)** → Depends on Phase 2; can start once US1 schemas stabilize.
- **User Story 3 (Phase 5)** → Depends on Phases 2–4 for runtime hooks.
- **Polish (Phase 6)** → Runs after desired user stories are complete.

### User Story Dependencies

- **US1 (Creator Invite)** → Independent after Foundational.
- **US2 (Invitee Join)** → Consumes tokens/structures from US1; coordinate on schema stability.
- **US3 (Operations)** → Builds on create/join flows plus gateway events for cleanup.

### Within Each User Story

- Implement or update tests before server/UI changes.
- Land backend schema changes before touching React routes/components.
- Ensure session storage changes land before relying on persisted invite state.

### Parallel Opportunities

- Token tests (T011) and permission builder tests (T012) can run alongside Discord REST client updates.
- Share panel UI (T019) and join status UI (T027) can progress in parallel once schemas are defined.
- Gateway worker cleanup (T033) can proceed while documentation tasks (T034–T036) wrap up.

---

## Parallel Example: User Story 2

```bash
# Run server invariant tests while implementing join UI
task: "T022 [P] [US2] Add integration tests for joinRoom invariants"
task: "T027 [P] [US2] Create JoinRoomStatus component in apps/web/src/components/discord/JoinRoomStatus.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup and Foundational phases.
2. Deliver US1 create/share flow and validate invite token lifecycle end-to-end.
3. Ship MVP behind feature flag for creator testing.

### Incremental Delivery
1. US1 provides shareable invites.
2. US2 unlocks invite consumption and full gameplay.
3. US3 hardens operations and cleanup prior to broad rollout.

### Parallel Team Strategy
- Backend engineer focuses on token service (T003–T008) while frontend engineer prototypes invite UI (T019–T020) once schemas land.
- Second backend engineer can tackle join flow tests (T022) and implementation (T024) alongside frontend route updates (T026–T029).
- Operations-focused engineer handles logging/cleanup (T030–T033) while documentation tasks (T034–T036) progress.
