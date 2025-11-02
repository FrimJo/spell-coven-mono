# Tasks: Discord Gateway Real-Time Event System

**Input**: Design documents from `/specs/017-discord-gateway-real/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are OPTIONAL per project constitution - not included in this task list

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Monorepo structure**: `apps/web/`, `packages/discord-integration/`, `packages/discord-gateway/`
- TypeScript with TanStack Start framework
- Server code: `apps/web/src/server/`, client code: `apps/web/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification of existing infrastructure

**Note**: Most infrastructure already exists. This phase verifies and updates existing components.

- [x] T001 Verify TypeScript 5.7 and Node.js 22.20 versions match plan.md requirements
- [x] T002 [P] Verify @repo/discord-integration package exports all required types in packages/discord-integration/src/types/events.ts
- [x] T003 [P] Verify @repo/discord-gateway package exports DiscordGatewayClient in packages/discord-gateway/src/index.ts
- [x] T004 [P] Verify WebSocket route exists at apps/web/src/routes/api/ws.ts
- [x] T005 [P] Verify WebSocket manager exists at apps/web/src/server/managers/ws-manager.ts
- [x] T006 Update environment variables documentation with all required secrets in apps/web/.env.example

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core enhancements that MUST be complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Add room cleanup timer types to apps/web/src/server/types/game-room.ts
- [x] T008 [P] Add session refresh types to apps/web/src/server/types/session.ts
- [x] T009 [P] Add rate limit queue types to apps/web/src/server/types/rate-limit.ts
- [x] T010 Update Zod schemas for 4-player limit in apps/web/src/server/schemas/schemas.ts
- [x] T011 Update Zod schemas for 24-hour token expiry in apps/web/src/server/schemas/schemas.ts
- [x] T012 [P] Create rate limit queue manager in apps/web/src/server/managers/rate-limit-manager.ts
- [x] T013 [P] Create room cleanup manager in apps/web/src/server/managers/room-cleanup-manager.ts
- [x] T014 Update JWT token generation to use 24-hour expiry in apps/web/src/server/room-tokens.server.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Real-Time Voice Channel Monitoring (Priority: P1) 🎯 MVP

**Goal**: Enable real-time voice channel monitoring so users can see when other players join or leave instantly (within 300ms)

**Independent Test**: Have multiple users join/leave a Discord voice channel and verify the player list updates instantly without page refresh

### Implementation for User Story 1

- [x] T015 [P] [US1] Verify voice.joined event payload schema in packages/discord-integration/src/types/events.ts
- [x] T016 [P] [US1] Verify voice.left event payload schema in packages/discord-integration/src/types/events.ts
- [x] T017 [US1] Verify WebSocket message broadcasting in apps/web/src/server/managers/ws-manager.ts handles voice events
- [x] T018 [US1] Verify useVoiceChannelEvents hook in apps/web/src/hooks/useVoiceChannelEvents.ts handles reconnection
- [x] T019 [US1] Verify useVoiceChannelMembersFromEvents hook in apps/web/src/hooks/useVoiceChannelMembersFromEvents.ts updates member list
- [x] T020 [US1] Update GameRoom component in apps/web/src/components/GameRoom.tsx to use verified hooks
- [x] T021 [US1] Add latency monitoring to WebSocket events in apps/web/src/server/managers/ws-manager.ts
- [x] T022 [US1] Add structured logging for voice events in apps/web/src/server/managers/ws-manager.ts
- [x] T023 [US1] Verify VoiceDropoutModal component in apps/web/src/components/VoiceDropoutModal.tsx shows on disconnect

**Checkpoint**: At this point, User Story 1 should be fully functional - users see real-time voice channel updates within 300ms

---

## Phase 4: User Story 2 - Automatic Voice Channel Connection (Priority: P1)

**Goal**: Automatically connect users to voice channel when they join a game room, removing manual setup friction

**Independent Test**: Create a game room or join via invite link, verify user is automatically placed in Discord voice channel without manual action

### Implementation for User Story 2

- [x] T024 [P] [US2] Update createRoom server function in apps/web/src/server/handlers/discord-rooms.server.ts to enforce 4-player limit
- [x] T025 [P] [US2] Update createRoom to set userLimit: 4 on Discord voice channel creation
- [x] T026 [US2] Update joinRoom server function in apps/web/src/server/handlers/discord-rooms.server.ts to verify room capacity
- [x] T027 [US2] Add room full error handling in apps/web/src/server/handlers/discord-rooms.server.ts
- [x] T028 [US2] Update game route in apps/web/src/routes/game.$gameId.tsx to handle room full errors
- [x] T029 [US2] Add "Room Full" UI state to GameRoom component in apps/web/src/components/GameRoom.tsx
- [x] T030 [US2] Verify automatic role assignment in joinRoom function
- [x] T031 [US2] Add connection timeout handling (2-second target) in apps/web/src/server/handlers/discord-rooms.server.ts
- [x] T032 [US2] Add retry logic for failed voice channel connections in apps/web/src/components/GameRoom.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users see real-time updates AND are automatically connected

---

## Phase 5: User Story 3 - Persistent Gateway Connection (Priority: P2)

**Goal**: Maintain stable Discord Gateway connection with automatic recovery, ensuring uninterrupted real-time updates

**Independent Test**: Simulate Discord Gateway disconnections and verify automatic reconnection with exponential backoff, maintaining event delivery within SLA

### Implementation for User Story 3

- [x] T033 [P] [US3] Verify exponential backoff reconnection in packages/discord-gateway/src/gateway.ts (1s → 2s → 4s → 8s → 16s)
- [x] T034 [P] [US3] Verify max 5 reconnection attempts in packages/discord-gateway/src/gateway.ts
- [x] T035 [US3] Verify session resumption logic in packages/discord-gateway/src/gateway.ts
- [x] T036 [US3] Add connection state tracking to apps/web/src/server/init/discord-gateway-init.server.ts
- [x] T037 [US3] Add heartbeat monitoring to packages/discord-gateway/src/gateway.ts
- [x] T038 [US3] Add reconnection event logging in packages/discord-gateway/src/gateway.ts
- [x] T039 [US3] Add operator notification on max reconnection attempts in apps/web/src/server/init/discord-gateway-init.server.ts
- [x] T040 [US3] Add connection state metrics to structured logging

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should work - real-time updates, auto-connection, AND reliable reconnection

---

## Phase 6: User Story 4 - Room Creation and Management (Priority: P2)

**Goal**: Enable private voice channel creation with role-based access control and automatic cleanup

**Independent Test**: Create a game room, verify private Discord voice channel is created with appropriate permissions, confirm only users with invite token can access it

### Implementation for User Story 4

- [x] T041 [P] [US4] Update invite token generation to use 24-hour expiry in apps/web/src/server/room-tokens.server.ts
- [x] T042 [P] [US4] Update invite token validation to check 24-hour expiry in apps/web/src/server/room-tokens.server.ts
- [x] T043 [US4] Add expired token error handling in apps/web/src/routes/game.$gameId.tsx
- [x] T044 [US4] Implement room cleanup background job in apps/web/src/server/managers/room-cleanup-manager.ts
- [x] T045 [US4] Add 1-hour inactivity timer tracking to room registry in apps/web/src/server/managers/room-cleanup-manager.ts
- [x] T046 [US4] Add cleanup job scheduler (runs every 5 minutes) in apps/web/src/server/init/discord-gateway-init.server.ts
- [x] T047 [US4] Implement 30-second warning notification before cleanup in apps/web/src/server/managers/room-cleanup-manager.ts
- [x] T048 [US4] Add Discord channel deletion on cleanup in apps/web/src/server/managers/room-cleanup-manager.ts
- [x] T049 [US4] Add Discord role deletion on cleanup in apps/web/src/server/managers/room-cleanup-manager.ts
- [x] T050 [US4] Broadcast room.deleted event on cleanup in apps/web/src/server/managers/room-cleanup-manager.ts
- [x] T051 [US4] Add manual room close handler in apps/web/src/server/handlers/discord-rooms.server.ts
- [x] T052 [US4] Update GameRoom component to handle room.deleted events in apps/web/src/components/GameRoom.tsx

**Checkpoint**: At this point, User Stories 1-4 should work - real-time updates, auto-connection, reliable reconnection, AND room management with cleanup

---

## Phase 7: User Story 5 - Event Broadcasting to Multiple Users (Priority: P3)

**Goal**: Ensure all users receive real-time updates with synchronized state, even with multiple concurrent connections

**Independent Test**: Have 10+ users connected to the same game room and verify all users receive voice channel events within 300ms

### Implementation for User Story 5

- [x] T053 [P] [US5] Add connection count tracking to apps/web/src/server/managers/ws-manager.ts
- [x] T054 [P] [US5] Add event ordering guarantees to apps/web/src/server/managers/ws-manager.ts
- [x] T055 [US5] Implement slow connection detection in apps/web/src/server/managers/ws-manager.ts
- [x] T056 [US5] Add backpressure handling (1MB buffer limit) in apps/web/src/routes/api/ws.ts
- [x] T057 [US5] Add connection close on buffer exceeded in apps/web/src/routes/api/ws.ts
- [x] T058 [US5] Implement event broadcast optimization for multiple recipients in apps/web/src/server/managers/ws-manager.ts
- [x] T059 [US5] Add broadcast latency monitoring in apps/web/src/server/managers/ws-manager.ts
- [x] T060 [US5] Add reconnection state synchronization in apps/web/src/hooks/useVoiceChannelEvents.ts
- [x] T061 [US5] Verify 500ms variance limit for member list sync across clients

**Checkpoint**: All user stories should now be independently functional with optimized multi-user broadcasting

---

## Phase 8: Session Management Enhancements

**Goal**: Implement silent session refresh with fallback to login redirect

**Purpose**: Cross-cutting enhancement that improves all user stories

- [x] T062 [P] Create session refresh utility in apps/web/src/server/auth/session-refresh.server.ts
- [x] T063 [P] Add OAuth2 token refresh logic in apps/web/src/server/auth/session-refresh.server.ts
- [x] T064 Add silent refresh attempt on session expiry in apps/web/src/server/middleware/auth-middleware.server.ts
- [x] T065 Add login redirect with return URL on refresh failure in apps/web/src/server/middleware/auth-middleware.server.ts
- [x] T066 Update OAuth callback to handle return URL from state parameter in apps/web/src/routes/auth/discord/callback.tsx
- [x] T067 Add session expiry handling to WebSocket authentication in apps/web/src/routes/api/ws.ts
- [x] T068 Add session refresh logging in apps/web/src/server/auth/session-refresh.server.ts

---

## Phase 9: Rate Limit Handling

**Goal**: Implement request queue with exponential backoff for Discord API rate limits

**Purpose**: Cross-cutting enhancement that improves reliability across all user stories

- [x] T069 [P] Implement request queue in apps/web/src/server/managers/rate-limit-manager.ts
- [x] T070 [P] Add exponential backoff logic (1s → 2s → 4s → 8s → 16s) in apps/web/src/server/managers/rate-limit-manager.ts
- [x] T071 Add max 5 retry attempts to rate limit manager
- [x] T072 Add Discord rate limit header parsing in apps/web/src/server/managers/rate-limit-manager.ts
- [x] T073 Integrate rate limit manager with Discord API calls in packages/discord-integration/src/clients/rest-client.ts
- [x] T074 Add rate limit event logging in apps/web/src/server/managers/rate-limit-manager.ts
- [x] T075 Add rate limit metrics to structured logging

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T076 [P] Update quickstart.md with final implementation details
- [x] T077 [P] Add performance monitoring dashboard queries for <300ms p95 latency
- [x] T078 [P] Add uptime monitoring for 99.9% target
- [x] T079 [P] Verify all secrets are server-side only (security audit checklist)
- [x] T080 [P] Add structured logging for all Discord events
- [x] T081 [P] Add error tracking for all failure modes
- [x] T082 Code cleanup: Remove any SSE references if found (WebSocket is used)
- [x] T083 Update technical documentation to clarify WebSocket vs SSE decision
- [x] T084 Verify all Zod schemas match data-model.md specifications
- [x] T085 Run type checking: `pnpm check-types`
- [x] T086 Run linting: `pnpm lint`
- [x] T087 Run formatting: `pnpm format`
- [x] T088 Verify all environment variables documented in .env.example
- [x] T089 Run quickstart.md validation scenarios
- [x] T090 Update README.md with feature documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P1 → P2 → P2 → P3)
- **Session Management (Phase 8)**: Can start after Foundational - enhances all stories
- **Rate Limiting (Phase 9)**: Can start after Foundational - enhances all stories
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Enhances US1 but independently testable

### Within Each User Story

- Verification tasks before implementation
- Type definitions before logic
- Core implementation before integration
- Error handling after core logic
- Logging after functionality
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Type definition tasks within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members
- Session Management (Phase 8) and Rate Limiting (Phase 9) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch verification tasks for User Story 1 together:
Task: "Verify voice.joined event payload schema in packages/discord-integration/src/types/events.ts"
Task: "Verify voice.left event payload schema in packages/discord-integration/src/types/events.ts"

# These can run simultaneously since they touch different aspects:
Task: "Add latency monitoring to WebSocket events"
Task: "Add structured logging for voice events"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only - Both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Real-Time Voice Channel Monitoring)
4. Complete Phase 4: User Story 2 (Automatic Voice Channel Connection)
5. **STOP and VALIDATE**: Test both P1 stories independently
6. Deploy/demo if ready

**Rationale**: Both P1 stories are critical for core user experience. US1 provides real-time visibility, US2 removes friction. Together they form a complete MVP.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo
3. Add User Story 2 → Test independently → Deploy/Demo (MVP complete!)
4. Add User Story 3 → Test independently → Deploy/Demo (reliability enhancement)
5. Add User Story 4 → Test independently → Deploy/Demo (room management)
6. Add User Story 5 → Test independently → Deploy/Demo (multi-user optimization)
7. Add Session Management (Phase 8) → Enhances all stories
8. Add Rate Limiting (Phase 9) → Enhances reliability
9. Each increment adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Real-Time Monitoring)
   - Developer B: User Story 2 (Auto-Connection)
   - Developer C: User Story 3 (Gateway Reliability)
   - Developer D: User Story 4 (Room Management)
3. Stories complete and integrate independently
4. Developer E: Session Management (Phase 8) in parallel with stories
5. Developer F: Rate Limiting (Phase 9) in parallel with stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Most infrastructure already exists - tasks focus on enhancements
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run type checking and linting frequently per constitution
- Use Context7 MCP for up-to-date npm package documentation
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

## Task Count Summary

- **Total Tasks**: 90
- **Setup**: 6 tasks
- **Foundational**: 8 tasks (BLOCKS all stories)
- **User Story 1 (P1)**: 9 tasks - Real-Time Voice Channel Monitoring
- **User Story 2 (P1)**: 9 tasks - Automatic Voice Channel Connection
- **User Story 3 (P2)**: 8 tasks - Persistent Gateway Connection
- **User Story 4 (P2)**: 12 tasks - Room Creation and Management
- **User Story 5 (P3)**: 9 tasks - Event Broadcasting to Multiple Users
- **Session Management**: 7 tasks (cross-cutting)
- **Rate Limiting**: 7 tasks (cross-cutting)
- **Polish**: 15 tasks

**Parallel Opportunities**: 35 tasks marked [P] can run in parallel within their phase

**MVP Scope**: Phases 1-4 (User Stories 1 & 2) = 32 tasks for complete MVP
