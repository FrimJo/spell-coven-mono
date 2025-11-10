# Tasks: PeerJS WebRTC Migration

**Input**: Design documents from `/specs/001-peerjs-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included based on the specification requirement to maintain existing test coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (TanStack Start monorepo)**: `apps/web/src/`, `apps/web/tests/`
- All paths are absolute from repository root

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [ ] T001 Install PeerJS dependency (peerjs@^1.5.4) via pnpm
- [ ] T002 [P] Install PeerJS type definitions (@types/peerjs) as dev dependency
- [ ] T003 [P] Review existing Discord integration in apps/web/src/hooks/useVoiceChannelMembersFromEvents.ts to understand player presence detection

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create TypeScript types for PeerJS integration in apps/web/src/types/peerjs.ts (ConnectionState, PeerTrackState, PeerJSError types)
- [ ] T005 [P] Create utility functions for connection retry logic in apps/web/src/lib/peerjs/retry.ts (exponential backoff: 0s, 2s, 4s)
- [ ] T006 [P] Create utility functions for connection timeout handling in apps/web/src/lib/peerjs/timeout.ts (10-second timeout)
- [ ] T007 [P] Create error handling utilities in apps/web/src/lib/peerjs/errors.ts (PeerJSError class, error type mapping)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic Video Streaming Works (Priority: P1) 🎯 MVP

**Goal**: Players can see and hear each other's video streams in a game room using the new PeerJS implementation, with the same functionality as the current system.

**Independent Test**: Can be fully tested by having 2-4 players join a game room and verifying they can see each other's video feeds. Delivers immediate value as a working replacement for the current system.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T008 [P] [US1] Create test file for usePeerJS hook in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T009 [P] [US1] Write test: "initializes peer with local player ID" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T010 [P] [US1] Write test: "handles incoming call and adds remote stream" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T011 [P] [US1] Write test: "creates outgoing call when remote player joins" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T012 [P] [US1] Write test: "manages local media stream lifecycle" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T013 [P] [US1] Write test: "toggles video enabled/disabled state" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T014 [P] [US1] Write test: "toggles audio muted/unmuted state" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T015 [P] [US1] Write test: "switches camera device while maintaining connection" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T016 [P] [US1] Write test: "cleans up connections when component unmounts" in apps/web/tests/hooks/usePeerJS.test.ts

### Implementation for User Story 1

- [ ] T017 [US1] Create usePeerJS hook skeleton in apps/web/src/hooks/usePeerJS.ts with interface matching contracts/usePeerJS-hook.ts
- [ ] T018 [US1] Implement peer initialization logic in apps/web/src/hooks/usePeerJS.ts (create Peer instance with localPlayerId)
- [ ] T019 [US1] Implement local media stream management in apps/web/src/hooks/usePeerJS.ts (getUserMedia with 4K constraints)
- [ ] T020 [US1] Implement incoming call handler in apps/web/src/hooks/usePeerJS.ts (peer.on('call') event)
- [ ] T021 [US1] Implement outgoing call creation in apps/web/src/hooks/usePeerJS.ts (peer.call() for remote players)
- [ ] T022 [US1] Implement remote stream tracking in apps/web/src/hooks/usePeerJS.ts (Map of peerId to MediaStream)
- [ ] T023 [US1] Implement connection state tracking in apps/web/src/hooks/usePeerJS.ts (Map of peerId to ConnectionState)
- [ ] T024 [US1] Implement video toggle functionality in apps/web/src/hooks/usePeerJS.ts (enable/disable video track)
- [ ] T025 [US1] Implement audio toggle functionality in apps/web/src/hooks/usePeerJS.ts (mute/unmute audio track)
- [ ] T026 [US1] Implement camera device switching in apps/web/src/hooks/usePeerJS.ts (stop old stream, start new stream)
- [ ] T027 [US1] Implement track state broadcasting in apps/web/src/hooks/usePeerJS.ts (notify peers of video/audio changes)
- [ ] T028 [US1] Implement cleanup logic in apps/web/src/hooks/usePeerJS.ts (destroy peer, close calls, release streams)
- [ ] T029 [US1] Update GameRoom component in apps/web/src/components/GameRoom.tsx to use usePeerJS instead of useWebRTC
- [ ] T030 [US1] Update VideoStreamGrid component in apps/web/src/components/VideoStreamGrid.tsx to use remoteStreams Map and peerTrackStates
- [ ] T031 [US1] Verify all tests pass for User Story 1

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - basic video streaming works for 2-4 players

---

## Phase 4: User Story 2 - Connection Reliability Maintained (Priority: P2)

**Goal**: Players experience stable video connections with automatic reconnection when network issues occur, matching or exceeding current system reliability.

**Independent Test**: Can be tested by simulating network interruptions (throttling, brief disconnects) and verifying the system recovers automatically without user intervention.

### Tests for User Story 2

- [ ] T032 [P] [US2] Write test: "retries connection 3 times with exponential backoff" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T033 [P] [US2] Write test: "times out connection after 10 seconds" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T034 [P] [US2] Write test: "automatically reconnects after brief network interruption" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T035 [P] [US2] Write test: "removes peer when connection drops completely" in apps/web/tests/hooks/usePeerJS.test.ts
- [ ] T036 [P] [US2] Write test: "re-establishes connections when player rejoins" in apps/web/tests/hooks/usePeerJS.test.ts

### Implementation for User Story 2

- [ ] T037 [US2] Integrate retry logic from apps/web/src/lib/peerjs/retry.ts into usePeerJS hook connection establishment
- [ ] T038 [US2] Integrate timeout logic from apps/web/src/lib/peerjs/timeout.ts into usePeerJS hook connection establishment
- [ ] T039 [US2] Implement connection failure detection in apps/web/src/hooks/usePeerJS.ts (peer.on('error'), call.on('error'))
- [ ] T040 [US2] Implement automatic reconnection logic in apps/web/src/hooks/usePeerJS.ts (retry on transient failures)
- [ ] T041 [US2] Implement connection cleanup on permanent failure in apps/web/src/hooks/usePeerJS.ts (remove from maps after max retries)
- [ ] T042 [US2] Implement peer rejoin detection in apps/web/src/hooks/usePeerJS.ts (watch remotePlayerIds changes)
- [ ] T043 [US2] Add error state management in apps/web/src/hooks/usePeerJS.ts (track and expose errors to UI)
- [ ] T044 [US2] Add connection quality indicators in apps/web/src/components/VideoStreamGrid.tsx (show connection state per peer)
- [ ] T045 [US2] Verify all tests pass for User Story 2

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - video streaming is reliable with automatic recovery

---

## Phase 5: User Story 3 - Reduced Codebase Complexity (Priority: P3)

**Goal**: Developers can maintain and extend the WebRTC functionality with significantly less code and complexity compared to the current custom implementation.

**Independent Test**: Can be measured by comparing lines of code, number of files, and complexity metrics between old and new implementations. Success means 70-80% code reduction while maintaining functionality.

### Implementation for User Story 3

- [ ] T046 [P] [US3] Remove old useWebRTC hook from apps/web/src/hooks/useWebRTC.ts
- [ ] T047 [P] [US3] Remove old useWebRTCSignaling hook from apps/web/src/hooks/useWebRTCSignaling.ts
- [ ] T048 [P] [US3] Remove custom peer connection manager from apps/web/src/lib/webrtc/peer-connection.ts
- [ ] T049 [P] [US3] Remove custom signaling types from apps/web/src/lib/webrtc/signaling.ts
- [ ] T050 [P] [US3] Remove custom WebRTC types from apps/web/src/lib/webrtc/types.ts
- [ ] T051 [P] [US3] Remove custom WebRTC utilities from apps/web/src/lib/webrtc/utils.ts
- [ ] T052 [P] [US3] Remove server-side signaling handler from apps/web/src/server/handlers/webrtc-signaling.server.ts
- [ ] T053 [US3] Remove apps/web/src/lib/webrtc directory if empty
- [ ] T054 [US3] Measure code reduction: count lines in new implementation vs old implementation
- [ ] T055 [US3] Measure file reduction: count files in new implementation vs old implementation
- [ ] T056 [US3] Document simplified architecture in apps/web/src/hooks/usePeerJS.ts (add comprehensive JSDoc comments)
- [ ] T057 [US3] Create developer onboarding documentation in specs/001-peerjs-migration/DEVELOPER_GUIDE.md

**Checkpoint**: All user stories should now be independently functional - codebase is dramatically simplified

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [ ] T058 [P] Add comprehensive error messages for all PeerJS error types in apps/web/src/lib/peerjs/errors.ts
- [ ] T059 [P] Add browser compatibility detection in apps/web/src/hooks/usePeerJS.ts (check WebRTC support)
- [ ] T060 [P] Add permission denial handling in apps/web/src/hooks/usePeerJS.ts (camera/mic permissions)
- [ ] T061 [P] Add network quality monitoring in apps/web/src/hooks/usePeerJS.ts (track connection stats)
- [ ] T062 [P] Add performance logging for connection establishment time in apps/web/src/hooks/usePeerJS.ts
- [ ] T063 [P] Add performance logging for connection success rate in apps/web/src/hooks/usePeerJS.ts
- [ ] T064 Update README or documentation with PeerJS migration notes
- [ ] T065 Run full test suite to ensure no regressions
- [ ] T066 Perform code review and refactoring for code quality
- [ ] T067 Run quickstart.md validation (manual testing with 2-4 players)
- [ ] T068 Verify all success criteria from spec.md are met (70-80% code reduction, <3s connection time, 95%+ success rate)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P2): Can start after Foundational - Depends on User Story 1 completion (builds on basic streaming)
  - User Story 3 (P3): Can start after User Story 1 completion - Removes old code after new code works
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on User Story 1 completion - Adds reliability to basic streaming
- **User Story 3 (P3)**: Depends on User Story 1 completion - Cannot remove old code until new code works

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Hook implementation before component updates
- Core functionality before error handling
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks (T001-T003) can run in parallel
- All Foundational tasks marked [P] (T005-T007) can run in parallel
- All tests for User Story 1 marked [P] (T008-T016) can run in parallel
- All tests for User Story 2 marked [P] (T032-T036) can run in parallel
- All file removal tasks in User Story 3 marked [P] (T046-T052) can run in parallel
- All Polish tasks marked [P] (T058-T063) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Create test file for usePeerJS hook in apps/web/tests/hooks/usePeerJS.test.ts"
Task: "Write test: initializes peer with local player ID"
Task: "Write test: handles incoming call and adds remote stream"
Task: "Write test: creates outgoing call when remote player joins"
Task: "Write test: manages local media stream lifecycle"
Task: "Write test: toggles video enabled/disabled state"
Task: "Write test: toggles audio muted/unmuted state"
Task: "Write test: switches camera device while maintaining connection"
Task: "Write test: cleans up connections when component unmounts"
```

---

## Parallel Example: User Story 3

```bash
# Launch all file removal tasks together:
Task: "Remove old useWebRTC hook from apps/web/src/hooks/useWebRTC.ts"
Task: "Remove old useWebRTCSignaling hook from apps/web/src/hooks/useWebRTCSignaling.ts"
Task: "Remove custom peer connection manager from apps/web/src/lib/webrtc/peer-connection.ts"
Task: "Remove custom signaling types from apps/web/src/lib/webrtc/signaling.ts"
Task: "Remove custom WebRTC types from apps/web/src/lib/webrtc/types.ts"
Task: "Remove custom WebRTC utilities from apps/web/src/lib/webrtc/utils.ts"
Task: "Remove server-side signaling handler from apps/web/src/server/handlers/webrtc-signaling.server.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T007) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T008-T031)
4. **STOP and VALIDATE**: Test User Story 1 independently with 2-4 players
5. Deploy to staging for validation

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! - Basic streaming works)
3. Add User Story 2 → Test independently → Deploy/Demo (Reliability added)
4. Add User Story 3 → Test independently → Deploy/Demo (Cleanup complete)
5. Add Polish → Final validation → Production deployment

### Sequential Strategy (Recommended for this migration)

Since User Story 2 builds on User Story 1, and User Story 3 removes old code:

1. Complete Setup + Foundational together (T001-T007)
2. Complete User Story 1 fully (T008-T031) → Validate basic streaming works
3. Complete User Story 2 fully (T032-T045) → Validate reliability improvements
4. Complete User Story 3 fully (T046-T057) → Validate code cleanup
5. Complete Polish (T058-T068) → Final validation and deployment

---

## Task Summary

**Total Tasks**: 68

**Tasks per User Story**:
- Setup: 3 tasks
- Foundational: 4 tasks
- User Story 1 (Basic Video Streaming): 24 tasks (9 tests + 15 implementation)
- User Story 2 (Connection Reliability): 14 tasks (5 tests + 9 implementation)
- User Story 3 (Reduced Complexity): 12 tasks
- Polish: 11 tasks

**Parallel Opportunities**:
- Setup: 2 parallel tasks (T002, T003)
- Foundational: 3 parallel tasks (T005, T006, T007)
- User Story 1 Tests: 9 parallel tasks (T008-T016)
- User Story 2 Tests: 5 parallel tasks (T032-T036)
- User Story 3 Cleanup: 7 parallel tasks (T046-T052)
- Polish: 6 parallel tasks (T058-T063)

**Independent Test Criteria**:
- User Story 1: Have 2-4 players join a game room and verify they can see each other's video feeds
- User Story 2: Simulate network interruptions and verify automatic recovery
- User Story 3: Measure code reduction (70-80%) and file reduction (40-60%)

**Suggested MVP Scope**: User Story 1 only (T001-T031) - Delivers working video streaming with PeerJS

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Big bang deployment strategy: thorough staging validation required before production
- No fallback mechanism: ensure comprehensive testing before deployment
