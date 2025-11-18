# Tasks: Cloudflare Durable Objects PeerJS Server

**Input**: Design documents from `/specs/001-cloudflare-peerjs-server/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in the specification, so test tasks are omitted. Focus is on implementation and manual testing per quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Project structure: `apps/cloudflare-peerjs-server/` (new Cloudflare Workers service)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project directory at apps/cloudflare-peerjs-server/
- [x] T002 Initialize package.json with TypeScript, Vitest, Miniflare, and Wrangler dependencies
- [x] T003 [P] Create tsconfig.json with Cloudflare Workers target configuration
- [x] T004 [P] Create wrangler.toml with Durable Objects binding configuration
- [x] T005 [P] Create vitest.config.ts for unit and integration testing
- [x] T006 [P] Create .gitignore for node_modules, dist, .wrangler, .mf
- [x] T007 Create project structure: src/, tests/unit/, tests/integration/, tests/contract/
- [x] T008 [P] Add npm scripts: dev, build, deploy, test, test:watch, lint, typecheck

**Checkpoint**: Project structure ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create PeerJS protocol message type definitions in apps/cloudflare-peerjs-server/src/protocol/messages.ts
- [x] T010 [P] Implement message validator with Zod schemas in apps/cloudflare-peerjs-server/src/protocol/validator.ts
- [x] T011 [P] Create structured logger utility in apps/cloudflare-peerjs-server/src/lib/logger.ts
- [x] T012 [P] Implement rate limiter class in apps/cloudflare-peerjs-server/src/lib/rate-limiter.ts
- [x] T013 Create Peer interface and registry in apps/cloudflare-peerjs-server/src/lib/peer-registry.ts
- [x] T014 Create Worker entry point skeleton in apps/cloudflare-peerjs-server/src/index.ts with HTTP request routing
- [x] T015 [P] Implement health check endpoint handler in apps/cloudflare-peerjs-server/src/handlers/health.ts
- [x] T016 [P] Implement metrics endpoint handler (stub) in apps/cloudflare-peerjs-server/src/handlers/health.ts
- [x] T017 Add CORS headers configuration in apps/cloudflare-peerjs-server/src/index.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic Peer Connection Signaling (Priority: P1) 🎯 MVP

**Goal**: Enable two peers to establish WebRTC connections through the signaling server by relaying offers, answers, and ICE candidates

**Independent Test**: Connect two PeerJS clients to the server, have one send an offer, verify the other receives it and can respond with an answer

### Implementation for User Story 1

- [x] T018 [P] [US1] Create GameRoomCoordinator Durable Object class skeleton in apps/cloudflare-peerjs-server/src/durable-objects/GameRoomCoordinator.ts
- [x] T019 [US1] Implement WebSocket upgrade handler in GameRoomCoordinator.fetch() method
- [x] T020 [US1] Implement webSocketMessage() handler for incoming messages in GameRoomCoordinator
- [x] T021 [US1] Implement peer registration on WebSocket connection (send OPEN message)
- [x] T022 [P] [US1] Implement HEARTBEAT message handler in apps/cloudflare-peerjs-server/src/handlers/heartbeat.ts
- [x] T023 [P] [US1] Implement message router for OFFER/ANSWER/CANDIDATE in apps/cloudflare-peerjs-server/src/protocol/router.ts
- [x] T024 [US1] Integrate message router into webSocketMessage() handler
- [x] T025 [US1] Implement message validation and error responses for invalid messages
- [x] T026 [US1] Add peer-to-peer message relay logic (src → dst routing)
- [x] T027 [US1] Update Worker index.ts to route /peerjs requests to GameRoomCoordinator Durable Object
- [x] T028 [US1] Add query parameter parsing (key, id, token) in WebSocket upgrade handler
- [x] T029 [US1] Add structured logging for connection events and message relay

**Checkpoint**: Two peers can connect and exchange signaling messages (OFFER, ANSWER, CANDIDATE)

---

## Phase 4: User Story 2 - Connection State Management (Priority: P2)

**Goal**: Maintain accurate peer state, detect disconnections, clean up stale connections, and implement WebSocket Hibernation API

**Independent Test**: Connect a peer, verify it appears in the registry, disconnect it, confirm the server removes it and notifies other peers

### Implementation for User Story 2

- [x] T030 [P] [US2] Implement webSocketClose() handler in GameRoomCoordinator
- [x] T031 [P] [US2] Implement webSocketError() handler in GameRoomCoordinator
- [x] T032 [US2] Add peer cleanup logic (remove from registry, notify other peers)
- [x] T033 [US2] Implement LEAVE message broadcast to all other peers in room
- [x] T034 [US2] Implement EXPIRE message for timeout scenarios
- [x] T035 [US2] Add heartbeat timeout detection (5 seconds) with periodic check
- [x] T036 [US2] Implement WebSocket Hibernation API configuration in GameRoomCoordinator constructor
- [x] T037 [US2] Add hibernation state tracking (lastActivityAt timestamp)
- [ ] T038 [US2] Test hibernation and reactivation with Miniflare (manual test per quickstart.md)
- [x] T039 [US2] Add logging for disconnection events and state cleanup

**Checkpoint**: Server accurately tracks peer state, cleans up disconnections, and hibernates during inactivity

---

## Phase 5: User Story 3 - Multi-Peer Room Coordination (Priority: P2)

**Goal**: Support 2-4 concurrent peers in a room with mesh topology coordination and room capacity enforcement

**Independent Test**: Connect 4 peers to the same room, initiate connections between all peers, verify all 6 peer-to-peer connections succeed

### Implementation for User Story 3

- [x] T040 [P] [US3] Add maxPeers constant (4) to GameRoomCoordinator
- [x] T041 [US3] Implement room capacity check on new WebSocket connections
- [x] T042 [US3] Add room-full error response (429 status) when capacity reached
- [x] T043 [US3] Implement peer count tracking in GameRoomCoordinator
- [x] T044 [US3] Add validation to ensure messages only route to peers in the same room
- [x] T045 [US3] Implement independent connection tracking (no interference between peer pairs)
- [x] T046 [US3] Add logging for room capacity events and multi-peer coordination
- [ ] T047 [US3] Test with 4 concurrent peers using wscat or PeerJS client (manual test per quickstart.md)

**Checkpoint**: Server supports 2-4 concurrent peers with proper capacity enforcement and mesh coordination

---

## Phase 6: User Story 4 - Global Edge Deployment (Priority: P3)

**Goal**: Deploy to Cloudflare Workers edge network with production configuration and monitoring

**Independent Test**: Deploy to Cloudflare, connect peers from different regions, verify sub-200ms signaling latency

### Implementation for User Story 4

- [x] T048 [P] [US4] Update wrangler.toml with production environment configuration
- [x] T049 [P] [US4] Configure custom domain in wrangler.toml (if applicable)
- [x] T050 [P] [US4] Add production CORS configuration for Spell Coven web app domain
- [x] T051 [US4] Implement secure WebSocket (WSS) support in production
- [ ] T052 [US4] Deploy to Cloudflare Workers using wrangler deploy
- [ ] T053 [US4] Verify Durable Object instantiation in edge location closest to first peer
- [ ] T054 [US4] Test latency from multiple geographic regions (manual test)
- [ ] T055 [US4] Configure Cloudflare dashboard monitoring and alerts
- [x] T056 [US4] Add production logging configuration for debugging
- [ ] T057 [US4] Update Spell Coven web app environment variables to point to production endpoint

**Checkpoint**: Server deployed globally with sub-200ms latency and production monitoring

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T058 [P] Add comprehensive error handling for all edge cases (malformed messages, network partitions)
- [x] T059 [P] Implement rate limiting enforcement (100 msg/sec per peer) across all message types
- [x] T060 [P] Add detailed structured logging for all operations (connection, disconnection, errors)
- [x] T061 [P] Create README.md with deployment instructions and architecture overview
- [ ] T062 [P] Validate quickstart.md instructions with fresh local setup
- [x] T063 Code cleanup and refactoring for consistency
- [x] T064 [P] Add TypeScript strict mode compliance checks
- [ ] T065 [P] Run linting and formatting across all files
- [x] T066 Performance optimization: minimize CPU time per message (<10ms target)
- [x] T067 [P] Add metrics collection for connection count, message rate, error rate
- [x] T068 Security hardening: validate peer IDs, prevent spoofing
- [ ] T069 [P] Update monorepo documentation to include new Cloudflare Workers service

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P2): Can start after Foundational - Builds on US1 but independently testable
  - User Story 3 (P2): Can start after Foundational - Builds on US1+US2 but independently testable
  - User Story 4 (P3): Depends on US1-US3 completion (deployment phase)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundation only - MVP can be delivered after this phase
- **User Story 2 (P2)**: Foundation only - Can work in parallel with US3 if staffed
- **User Story 3 (P2)**: Foundation only - Can work in parallel with US2 if staffed
- **User Story 4 (P3)**: Requires US1-US3 complete (deployment and production configuration)

### Within Each User Story

- Protocol/message handling before Durable Object implementation
- Core signaling logic before state management
- State management before capacity enforcement
- Local testing before production deployment

### Parallel Opportunities

**Phase 1 (Setup)**: T003, T004, T005, T006, T008 can run in parallel

**Phase 2 (Foundational)**: T010, T011, T012, T015, T016 can run in parallel

**Phase 3 (US1)**: T018, T022, T023 can run in parallel (different files)

**Phase 4 (US2)**: T030, T031 can run in parallel (different handlers)

**Phase 5 (US3)**: T040 can run in parallel with T041-T042 (different concerns)

**Phase 6 (US4)**: T048, T049, T050 can run in parallel (configuration files)

**Phase 7 (Polish)**: T058, T059, T060, T061, T062, T064, T065, T067, T068, T069 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch foundational tasks together:
Task T018: "Create GameRoomCoordinator Durable Object class skeleton"
Task T022: "Implement HEARTBEAT message handler"
Task T023: "Implement message router for OFFER/ANSWER/CANDIDATE"

# Then integrate sequentially:
Task T019: "Implement WebSocket upgrade handler"
Task T020: "Implement webSocketMessage() handler"
Task T024: "Integrate message router into webSocketMessage()"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T017) - CRITICAL
3. Complete Phase 3: User Story 1 (T018-T029)
4. **STOP and VALIDATE**: Test with two PeerJS clients per quickstart.md
5. Deploy locally with Miniflare and verify WebRTC connection establishment

**Result**: Minimum viable signaling server that enables basic peer-to-peer connections

### Incremental Delivery

1. **MVP (US1)**: Basic signaling → Test → Deploy locally
2. **+US2**: Add state management → Test disconnection handling → Deploy
3. **+US3**: Add multi-peer support → Test with 4 peers → Deploy
4. **+US4**: Deploy to production → Test global latency → Monitor
5. **Polish**: Optimize, harden, document

Each phase adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers:

1. **Together**: Complete Setup (Phase 1) + Foundational (Phase 2)
2. **Once Foundational is done**:
   - Developer A: User Story 1 (T018-T029)
   - Developer B: User Story 2 (T030-T039) - starts after US1 core is done
   - Developer C: User Story 3 (T040-T047) - starts after US1+US2 core is done
3. Stories integrate and test independently

---

## Task Summary

**Total Tasks**: 69

**By Phase**:
- Phase 1 (Setup): 8 tasks
- Phase 2 (Foundational): 9 tasks
- Phase 3 (US1 - P1): 12 tasks
- Phase 4 (US2 - P2): 10 tasks
- Phase 5 (US3 - P2): 8 tasks
- Phase 6 (US4 - P3): 10 tasks
- Phase 7 (Polish): 12 tasks

**By User Story**:
- US1 (Basic Signaling): 12 tasks
- US2 (State Management): 10 tasks
- US3 (Multi-Peer): 8 tasks
- US4 (Global Deployment): 10 tasks

**Parallel Opportunities**: 29 tasks marked [P] can run in parallel within their phases

**MVP Scope**: Phases 1-3 (29 tasks) deliver minimum viable product

**Independent Test Criteria**:
- US1: Two peers exchange signaling messages successfully
- US2: Peer disconnection detected and cleaned up within 5 seconds
- US3: Four peers coordinate connections in mesh topology
- US4: Sub-200ms latency from multiple geographic regions

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Manual testing per quickstart.md (no automated tests requested in spec)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Focus on protocol compatibility with existing PeerJS clients (FR-020)
