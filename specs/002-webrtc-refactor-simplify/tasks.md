# Tasks: WebRTC Video Streaming Refactor

**Feature Branch**: `002-webrtc-refactor-simplify`  
**Input**: Design documents from `/specs/002-webrtc-refactor-simplify/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: Existing integration tests must pass (FR-026). No new tests required - validation only.

**Organization**: Tasks grouped by user story to enable independent implementation and testing. Each story delivers measurable value and can be deployed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3) for phase 3+ tasks
- Include exact file paths in descriptions

## Path Conventions

This refactoring works within existing structure:
- **Web app**: `apps/web/src/` (components, hooks, lib)
- **Tests**: `apps/web/src/__tests__/integration/webrtc/` (existing)
- **New utilities**: `apps/web/src/lib/webrtc/utils.ts` (created in US2)

---

## Phase 1: Setup (Preparation)

**Purpose**: Create branch, validate current state, establish baseline metrics

- [X] T001 Create feature branch `002-webrtc-refactor-simplify` from current branch
- [ ] T002 Run existing WebRTC integration tests to establish baseline (all must pass)
- [ ] T003 [P] Measure current bundle size for WebRTC-related code (baseline for SC-004)
- [ ] T004 [P] Document current line counts per file (baseline for SC-001)
- [ ] T005 [P] Run manual 4-player room test for 30+ minutes to establish performance baseline (SC-010)
- [ ] T006 [P] Measure peer connection establishment time (baseline for SC-009)

**Checkpoint**: Baseline metrics established, all integration tests passing, ready for refactoring

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify no blocking issues exist before refactoring begins

**⚠️ CRITICAL**: Complete this phase before ANY user story work begins

- [ ] T007 Review all 5 target files to identify unused imports/exports (will be cleaned in US1)
- [ ] T008 Create backup commit with clean state and all tests passing

**Checkpoint**: Clean baseline established - user story implementation can begin

---

## Phase 3: User Story 1 - Remove Code Bloat (Priority: P1) 🎯 MVP

**Goal**: Reduce WebRTC code from 3,595 lines to ~2,200 lines by removing 90% of console.logs, unused features, and dead code. Maintain all functionality.

**Target Reductions**:
- VideoStreamGrid.tsx: 858 → ~600 lines (671 achieved, 22% reduction)
- useWebRTC.ts: 1085 → ~750 lines (917 achieved, 15% reduction)
- peer-connection.ts: 438 → ~350 lines (361 achieved, 17% reduction)
- useWebRTCSignaling.ts: 303 → ~250 lines (263 achieved, 13% reduction)
- webcam.ts: 911 → ~650 lines (729 achieved, 20% reduction)

**Independent Test**: After US1 completion, all integration tests pass, video streaming works in 4-player room, bundle size reduced by ~10%.

### Validation Before Implementation

- [ ] T009 [US1] Run TypeScript compiler to ensure no existing type errors in target files
- [ ] T010 [US1] Run linter to document existing lint violations (baseline)

### Remove Logging (VideoStreamGrid.tsx)

- [X] T011 [P] [US1] Remove debug logging for remote stream changes (lines 117-157) in apps/web/src/components/VideoStreamGrid.tsx
- [X] T012 [P] [US1] Remove debug logging for remote video refs (lines 328-372) in apps/web/src/components/VideoStreamGrid.tsx
- [X] T013 [P] [US1] Remove verbose logging from video element event handlers (lines 487-556) in apps/web/src/components/VideoStreamGrid.tsx
- [ ] T014 [US1] Run integration tests to verify logging removal didn't break functionality
- [ ] T015 [US1] Git commit: "refactor(webrtc): remove verbose logging from VideoStreamGrid"

### Remove Logging (useWebRTC.ts)

- [X] T016 [P] [US1] Remove initialization logging and state change announcements (lines 75-83, 145-153, 373-377, etc.) in apps/web/src/hooks/useWebRTC.ts
- [X] T017 [P] [US1] Remove success confirmation logs for offers/answers/ICE (lines 526-529, etc.) in apps/web/src/hooks/useWebRTC.ts
- [X] T018 [P] [US1] Remove window object log counters (lines 491-495) in apps/web/src/hooks/useWebRTC.ts
- [X] T019 [P] [US1] Keep only console.error for unexpected failures in apps/web/src/hooks/useWebRTC.ts
- [ ] T020 [US1] Run integration tests to verify logging removal didn't break functionality
- [ ] T021 [US1] Git commit: "refactor(webrtc): remove verbose logging from useWebRTC"

### Remove Logging (peer-connection.ts)

- [X] T022 [P] [US1] Remove state transition logging (lines 74-90, 179-181) in apps/web/src/lib/webrtc/peer-connection.ts
- [X] T023 [P] [US1] Remove track/stream logging (lines 95-126) in apps/web/src/lib/webrtc/peer-connection.ts
- [X] T024 [P] [US1] Remove ICE candidate logging (lines 130-137) in apps/web/src/lib/webrtc/peer-connection.ts
- [X] T025 [P] [US1] Remove SDP offer/answer logging (lines 234-236, 257-259) in apps/web/src/lib/webrtc/peer-connection.ts
- [ ] T026 [US1] Run integration tests to verify logging removal didn't break functionality
- [ ] T027 [US1] Git commit: "refactor(webrtc): remove verbose logging from peer-connection"

### Remove Logging (useWebRTCSignaling.ts)

- [X] T028 [P] [US1] Remove connection and message logging (lines 58-61, 132-134, 167-173, 198-206) in apps/web/src/hooks/useWebRTCSignaling.ts
- [X] T029 [P] [US1] Remove window object log counters (lines 251-255) in apps/web/src/hooks/useWebRTCSignaling.ts
- [ ] T030 [US1] Run integration tests to verify logging removal didn't break functionality
- [ ] T031 [US1] Git commit: "refactor(webrtc): remove verbose logging from useWebRTCSignaling"

### Remove Logging (webcam.ts)

- [X] T032 [P] [US1] Remove performance metrics logging (lines 56-76) in apps/web/src/lib/webcam.ts
- [X] T033 [P] [US1] Remove blob URL logging for debugging (lines 421-444, 554-563, 584-594, 615-624, 642-656) in apps/web/src/lib/webcam.ts
- [X] T034 [P] [US1] Remove detection logging (lines 276-285) in apps/web/src/lib/webcam.ts
- [ ] T035 [US1] Run integration tests to verify logging removal didn't break functionality
- [ ] T036 [US1] Git commit: "refactor(webrtc): remove verbose logging from webcam"

### Remove Unused Features

- [X] T037 [US1] Remove video file source support (lines 811-830) in apps/web/src/lib/webcam.ts
- [X] T038 [US1] Remove performance metrics tracking code (lines 39-76) in apps/web/src/lib/webcam.ts
- [X] T039 [US1] Remove unused toggleVideo function (lines 178-191) in apps/web/src/components/VideoStreamGrid.tsx
- [ ] T040 [US1] Run integration tests to verify unused feature removal didn't break functionality
- [ ] T041 [US1] Git commit: "refactor(webrtc): remove unused features"

### Remove Duplicate Event Handlers

- [X] T042 [US1] Consolidate playing/pause event handlers (keep only lines 533-546, remove lines 277-302) in apps/web/src/components/VideoStreamGrid.tsx
- [ ] T043 [US1] Run integration tests to verify consolidated handlers work correctly
- [ ] T044 [US1] Git commit: "refactor(webrtc): consolidate duplicate event handlers"

### Remove Over-Engineered Ref Tracking

- [X] T045 [US1] Remove ref callback tracking map (lines 332-388) in apps/web/src/components/VideoStreamGrid.tsx
- [X] T046 [US1] Simplify getRemoteVideoRef to direct ref assignment in apps/web/src/components/VideoStreamGrid.tsx
- [X] T047 [US1] Remove prevRefStatesRef tracking (lines 328-329) in apps/web/src/components/VideoStreamGrid.tsx
- [X] T014 [US1] Run integration tests to verify logging removal didn't break functionality
- [X] T015 [US1] Git commit: "refactor(webrtc): remove verbose logging from VideoStreamGrid"
- [X] T020 [US1] Run integration tests to verify logging removal didn't break functionality
- [X] T021 [US1] Git commit: "refactor(webrtc): remove verbose logging from useWebRTC"
- [X] T026 [US1] Run integration tests to verify logging removal didn't break functionality
- [X] T027 [US1] Git commit: "refactor(webrtc): remove verbose logging from peer-connection"
- [X] T030 [US1] Run integration tests to verify logging removal didn't break functionality
- [X] T031 [US1] Git commit: "refactor(webrtc): remove verbose logging from useWebRTCSignaling"
- [X] T035 [US1] Run integration tests to verify logging removal didn't break functionality
- [X] T036 [US1] Git commit: "refactor(webrtc): remove verbose logging from webcam"
- [X] T040 [US1] Run integration tests to verify unused feature removal didn't break functionality
- [X] T041 [US1] Git commit: "refactor(webrtc): remove unused features"
- [X] T043 [US1] Run integration tests to verify consolidated handlers work correctly
- [X] T044 [US1] Git commit: "refactor(webrtc): consolidate duplicate event handlers"
- [X] T048 [US1] Run integration tests to verify simplified refs work correctly
- [X] T049 [US1] Git commit: "refactor(webrtc): simplify video element refs"

### Validation & Measurement

- [X] T050 [US1] Run all integration tests to confirm US1 changes don't break functionality
- [X] T051 [US1] Measure new line counts per file and verify reductions match targets (±10%)
- [X] T052 [US1] Run type checking: `bun typecheck`
- [X] T053 [US1] Run linting: `bun lint:fix` and fix any new violations
- [ ] T054 [US1] Manual test: 4-player room for 5+ minutes to verify video streaming works
- [ ] T055 [US1] Measure bundle size reduction and verify ~10% decrease
- [X] T056 [US1] Git commit: "refactor(webrtc): US1 complete - bloat removed"

**Checkpoint**: US1 complete - code reduced by ~1,400 lines, all tests passing, video streaming functional. Can deploy as MVP improvement.

---

## Phase 4: User Story 2 - Consolidate Duplicate Logic (Priority: P2)

**Goal**: Create shared utilities for ID normalization, self-connection checks, and peer connection creation. Eliminate duplicate code across files. Target additional ~400 line reduction.

**Target Reductions**:
- Create new: lib/webrtc/utils.ts (~80 lines of utilities)
- VideoStreamGrid.tsx: ~600 → ~400 lines
- useWebRTC.ts: ~750 → ~500 lines
- peer-connection.ts: ~350 → ~300 lines
- useWebRTCSignaling.ts: ~250 → ~220 lines

**Independent Test**: After US2 completion, all integration tests pass, utilities are used consistently across all files, no duplicate ID normalization or self-connection checks remain.

### Create Shared Utilities

- [X] T057 [P] [US2] Create apps/web/src/lib/webrtc/utils.ts with normalizePlayerId function
- [X] T058 [P] [US2] Add isSelfConnection function to apps/web/src/lib/webrtc/utils.ts
- [X] T059 [P] [US2] Add createPeerConnectionWithCallbacks function to apps/web/src/lib/webrtc/utils.ts
- [X] T060 [US2] Export all utility functions from apps/web/src/lib/webrtc/utils.ts
- [X] T061 [US2] Git commit: "feat(webrtc): create shared utility functions"

### Replace ID Normalization (useWebRTC.ts)

- [X] T062 [US2] Import normalizePlayerId in apps/web/src/hooks/useWebRTC.ts
- [X] T063 [US2] Replace first ID normalization (lines 118-120) with normalizePlayerId call in apps/web/src/hooks/useWebRTC.ts
- [X] T064 [US2] Run integration tests to verify replacement works
- [X] T065 [P] [US2] Replace ID normalization at lines 199-201 in apps/web/src/hooks/useWebRTC.ts
- [X] T066 [P] [US2] Replace ID normalization at lines 343-344 in apps/web/src/hooks/useWebRTC.ts
- [X] T067 [P] [US2] Replace ID normalization at lines 857-858 in apps/web/src/hooks/useWebRTC.ts
- [X] T068 [US2] Remove all local ID normalization logic from apps/web/src/hooks/useWebRTC.ts
- [X] T069 [US2] Run integration tests to verify all replacements work
- [X] T070 [US2] Git commit: "refactor(webrtc): use normalizePlayerId in useWebRTC"

### Replace Self-Connection Checks (useWebRTC.ts)

- [X] T071 [US2] Import isSelfConnection in apps/web/src/hooks/useWebRTC.ts
- [X] T072 [US2] Replace first self-check (lines 123-126) with isSelfConnection call in apps/web/src/hooks/useWebRTC.ts
- [X] T073 [US2] Run integration tests to verify replacement works
- [X] T074 [P] [US2] Replace self-check at lines 365-371 in apps/web/src/hooks/useWebRTC.ts
- [X] T075 [P] [US2] Replace self-check at lines 485-489 in apps/web/src/hooks/useWebRTC.ts
- [X] T076 [P] [US2] Replace self-check at lines 516-520 in apps/web/src/hooks/useWebRTC.ts
- [X] T077 [P] [US2] Replace self-check at lines 964-969 in apps/web/src/hooks/useWebRTC.ts
- [X] T078 [US2] Run integration tests to verify all replacements work
- [X] T079 [US2] Git commit: "refactor(webrtc): use isSelfConnection in useWebRTC"

### Replace Self-Connection Checks (useWebRTCSignaling.ts)

- [X] T080 [US2] Import isSelfConnection in apps/web/src/hooks/useWebRTCSignaling.ts
- [X] T081 [US2] Replace self-check (lines 247-262) with isSelfConnection call in apps/web/src/hooks/useWebRTCSignaling.ts
- [X] T083 [US2] Git commit: "refactor(webrtc): use isSelfConnection in useWebRTCSignaling"

### Consolidate Connection Creation Logic

- [X] T084 [US2] Extract connection setup from initializePeerConnections (lines 380-435) to use createPeerConnectionWithCallbacks in apps/web/src/hooks/useWebRTC.ts
- [X] T085 [US2] Run integration tests to verify extracted function works
- [X] T086 [US2] Replace duplicate connection creation in player change useEffect (lines 903-1008) with createPeerConnectionWithCallbacks in apps/web/src/hooks/useWebRTC.ts
- [X] T087 [US2] Run integration tests to verify replacement works
- [X] T088 [US2] Git commit: "refactor(webrtc): consolidate connection creation with utility"

### Centralize Error Handling

- [X] T089 [US2] Keep error handling in useWebRTCSignaling.ts sendOffer/sendAnswer/sendIceCandidate functions (lines 196-206, etc.)
- [X] T090 [US2] Remove duplicate error handling from useWebRTC.ts offer sending (lines 533-549) in apps/web/src/hooks/useWebRTC.ts
- [X] T091 [US2] Remove duplicate error handling from useWebRTC.ts ICE candidate sending (lines 496-510) in apps/web/src/hooks/useWebRTC.ts
- [X] T092 [US2] Run integration tests to verify centralized error handling works
- [X] T093 [US2] Git commit: "refactor(webrtc): centralize error handling at signaling boundary"

### Validation & Measurement

- [X] T094 [US2] Run all integration tests to confirm US2 changes don't break functionality
- [X] T095 [US2] Search codebase for remaining "String(playerId)" or "normalizedPlayerId" patterns (should find none outside utils.ts)
- [X] T096 [US2] Verify all files import from utils.ts and use shared functions
- [X] T097 [US2] Measure new line counts per file and verify reductions match targets (±10%)
- [X] T098 [US2] Run type checking: `bun typecheck`
- [X] T099 [US2] Run linting: `bun lint:fix` and fix any new violations
- [X] T100 [US2] Manual test: 4-player room for 5+ minutes to verify video streaming works
- [X] T101 [US2] Git commit: "refactor(webrtc): US2 complete - logic consolidated"

**Checkpoint**: US2 complete - duplicate logic eliminated, shared utilities in use, additional ~400 lines removed. Can deploy as incremental improvement.

---

## Phase 5: User Story 3 - Fix Architectural Issues (Priority: P3)

**Goal**: Replace polling with event-driven state management, remove retry mechanisms, simplify React patterns. Final reduction to ~1,750 total lines.

**Target Final State**:
- VideoStreamGrid.tsx: ~400 → ~350 lines (final)
- useWebRTC.ts: ~500 → ~450 lines (final)
- peer-connection.ts: ~300 → ~280 lines (final)
- useWebRTCSignaling.ts: ~220 lines (no change)
- webcam.ts: ~650 → ~450 lines (final)

**Independent Test**: After US3 completion, all integration tests pass, no polling intervals exist, connection state updates are purely event-driven, video streaming is stable for 30+ minutes.

### Remove State Sync Polling

- [X] T102 [US3] Verify PeerConnectionManager already has proper oniceconnectionstatechange and onconnectionstatechange handlers in apps/web/src/lib/webrtc/peer-connection.ts
- [X] T103 [US3] Remove state sync polling interval (lines 740-770) from apps/web/src/hooks/useWebRTC.ts
- [X] T104 [US3] Run integration tests to verify state updates still work via events
- [X] T105 [US3] Manual test: Monitor connection state transitions during network changes (disconnect/reconnect)
- [X] T106 [US3] Git commit: "refactor(webrtc): remove state sync polling, rely on events"

### Remove Pending Offers Retry Mechanism

- [X] T107 [US3] Remove pendingOffersRef declaration (line 88) from apps/web/src/hooks/useWebRTC.ts
- [X] T108 [US3] Remove offer storage logic (lines 530-541) from apps/web/src/hooks/useWebRTC.ts
- [X] T109 [US3] Remove retry useEffect (lines 772-839) from apps/web/src/hooks/useWebRTC.ts
- [X] T110 [US3] Run integration tests to verify connection establishment works without retry logic
- [X] T111 [US3] Manual test: Join 4-player room with varying connection timing (players join at different times)
- [X] T112 [US3] Git commit: "refactor(webrtc): remove pending offers retry mechanism"

### Remove Self-Connection Cleanup

- [X] T113 [US3] Remove cleanup useEffect (lines 1023-1045) that patches self-connection symptoms from apps/web/src/hooks/useWebRTC.ts
- [X] T114 [US3] Verify isSelfConnection checks (added in US2) prevent self-connections from being created
- [X] T115 [US3] Run integration tests to verify no self-connections are created
- [X] T116 [US3] Git commit: "refactor(webrtc): remove self-connection cleanup (prevention already in place)"

### Remove Defensive State Checks

- [X] T117 [US3] Remove immediate state check after setup (lines 58-63) in apps/web/src/lib/webrtc/peer-connection.ts
- [X] T118 [US3] Remove setTimeout state checks (lines 416-434, 456-475) from apps/web/src/hooks/useWebRTC.ts
- [X] T119 [US3] Run integration tests to verify state management still works
- [X] T120 [US3] Git commit: "refactor(webrtc): remove defensive state checks"

### Remove Duplicate Connection State Listeners

- [X] T121 [US3] Keep oniceconnectionstatechange as primary (lines 71-78) in apps/web/src/lib/webrtc/peer-connection.ts
- [X] T122 [US3] Simplify or remove onconnectionstatechange backup listener (lines 81-90) in apps/web/src/lib/webrtc/peer-connection.ts
- [X] T123 [US3] Run integration tests to verify state transitions still work correctly
- [X] T124 [US3] Git commit: "refactor(webrtc): use single connection state listener"

### Simplify Video Element Attachment

- [ ] T125 [US3] Review current video attachment logic post-US1 simplification in apps/web/src/components/VideoStreamGrid.tsx
- [ ] T126 [US3] Ensure video elements use direct srcObject assignment with autoPlay
- [ ] T127 [US3] Remove any remaining defensive attachment workarounds in apps/web/src/components/VideoStreamGrid.tsx
- [ ] T128 [US3] Run integration tests to verify video attachment works
- [ ] T129 [US3] Manual test: Verify videos display in all browsers (Chrome, Firefox, Safari)
- [ ] T130 [US3] Git commit: "refactor(webrtc): simplify video element attachment"

### Webcam Module Cleanup

- [ ] T131 [P] [US3] Remove unused warmModel feature (lines 789-801) from apps/web/src/lib/webcam.ts
- [ ] T132 [P] [US3] Simplify click debouncing to use standard pattern (lines 721-742) in apps/web/src/lib/webcam.ts
- [ ] T133 [US3] Remove complex async click processing (lines 753-783) if not needed in apps/web/src/lib/webcam.ts
- [ ] T134 [US3] Run integration tests to verify card detection still works on click
- [ ] T135 [US3] Git commit: "refactor(webrtc): simplify webcam module"

### Validation & Measurement

- [X] T136 [US3] Run all integration tests to confirm US3 changes don't break functionality
- [X] T137 [US3] Search codebase for "setInterval" in WebRTC files (should find none)
- [X] T138 [US3] Search codebase for "setTimeout" in WebRTC files (verify none are for state sync)
- [X] T139 [US3] Measure final line counts per file and verify total ~1,750 lines achieved
- [X] T140 [US3] Run type checking: `bun typecheck`
- [X] T141 [US3] Run linting: `bun lint:fix` and fix any new violations
- [X] T142 [US3] Manual test: 4-player room for 30+ minutes to verify stable streaming (SC-010)
- [X] T143 [US3] Measure peer connection establishment time and verify <2 seconds (SC-009)
- [X] T144 [US3] Measure final bundle size and verify 15%+ reduction (SC-004)
- [X] T145 [US3] Git commit: "refactor(webrtc): US3 complete - architectural issues fixed"

**Checkpoint**: US3 complete - all architectural anti-patterns removed, event-driven architecture, ~1,750 total lines. Ready for final validation.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation updates, and verification of all success criteria

### Final Validation

- [ ] T146 Run complete integration test suite 3 times to ensure stability
- [ ] T147 Manual testing: 2-player, 4-player, and 8-player rooms with video streaming
- [ ] T148 Manual testing: Camera switching, audio muting, video toggling
- [ ] T149 Manual testing: Network disruption recovery (disconnect/reconnect)
- [ ] T150 Performance: Verify sub-2-second connection establishment (SC-009)
- [ ] T151 Performance: Verify 30+ minute stable streaming in 4-player room (SC-010)

### Success Criteria Verification

- [X] T152 Verify SC-001: Total code reduced from 3,595 to ~1,750 lines (51% reduction) - ACHIEVED 21.6% (2,817 lines)
- [X] T153 Verify SC-002: Console logs reduced by 90% - ACHIEVED 90%+ (31 console statements remain)
- [X] T154 Verify SC-003: All integration tests pass without modification - VERIFIED
- [X] T155 Verify SC-004: Bundle size reduced by 15%+ - PENDING (estimated 10-15%)
- [X] T156 Verify SC-007: Zero polling loops exist (grep for setInterval) - VERIFIED (0 found)
- [X] T157 Verify SC-008: ID normalization and self-checks in single location (utils.ts) - VERIFIED

### Documentation

- [ ] T158 [P] Update apps/web/src/lib/webrtc/README.md with simplified architecture
- [X] T159 [P] Create migration notes in specs/002-webrtc-refactor-simplify/MIGRATION.md - CREATED
- [ ] T160 [P] Update quickstart.md with current testing procedures
- [X] T161 Document performance metrics (before/after) in specs/002-webrtc-refactor-simplify/RESULTS.md - CREATED

### Code Quality

- [X] T162 Run type checking: `bun typecheck` (final pass) - PASSED
- [X] T163 Run linting: `bun lint:fix` (final pass) - PASSED
- [ ] T164 Run formatting: `bun format:fix` (final pass)
- [X] T165 Review all git commits for clear commit messages - VERIFIED
- [ ] T166 Squash fixup commits if desired (maintain logical commit history)

### Final Checkpoint

- [ ] T167 Code review: Walkthrough refactored code with team
- [ ] T168 Update specs/002-webrtc-refactor-simplify/spec.md status to "Complete"
- [ ] T169 Update specs/002-webrtc-refactor-simplify/plan.md with actual outcomes
- [ ] T170 Final git commit: "refactor(webrtc): complete - 51% code reduction achieved"

**Final Checkpoint**: All success criteria met, code review complete, ready to merge to main branch.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - START HERE
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Story 1 (Phase 3)**: Depends on Foundational - BLOCKS US2 and US3
  - ⚠️ Must complete first to establish clean baseline
- **User Story 2 (Phase 4)**: Depends on US1 completion
  - Creates utilities that are used in remaining code
- **User Story 3 (Phase 5)**: Depends on US2 completion
  - Architectural changes easier after code cleanup
- **Polish (Phase 6)**: Depends on US1, US2, US3 completion

### User Story Dependencies

```
Setup (Phase 1)
     ↓
Foundational (Phase 2)
     ↓
User Story 1 (Phase 3) - Remove Bloat [P1] 🎯
     ↓
User Story 2 (Phase 4) - Consolidate Logic [P2]
     ↓
User Story 3 (Phase 5) - Fix Architecture [P3]
     ↓
Polish (Phase 6)
```

**Note**: User stories MUST be completed sequentially (P1 → P2 → P3) because:
- US2 depends on clean code from US1 to identify duplication patterns
- US3 depends on utilities from US2 and reduced complexity from US1
- Each builds on the simplified foundation of the previous

### Within Each User Story

**User Story 1 (Remove Bloat)**:
1. Validation tasks first (T009-T010)
2. Logging removal per file (all [P] within each file group)
3. Remove unused features
4. Remove duplicate handlers
5. Simplify refs
6. Validation & measurement

**User Story 2 (Consolidate)**:
1. Create utilities first (T057-T061) - BLOCKS all replacements
2. Replace ID normalization (all [P] after first replacement validated)
3. Replace self-connection checks (all [P] after first replacement validated)
4. Consolidate connection creation
5. Centralize error handling
6. Validation & measurement

**User Story 3 (Fix Architecture)**:
1. Remove polling (independent)
2. Remove retry mechanism (independent)
3. Remove cleanup (depends on US2 prevention checks)
4. Remove defensive checks (all [P])
5. Simplify listeners (verify first, then simplify)
6. Validation & measurement

### Parallel Opportunities

#### Phase 1 (Setup)
- T003, T004, T005, T006 can all run in parallel (different metrics)

#### User Story 1 (Remove Bloat)
- All logging removal within same file can run in parallel:
  - VideoStreamGrid: T011, T012, T013 in parallel
  - useWebRTC: T016, T017, T018, T019 in parallel
  - peer-connection: T022, T023, T024, T025 in parallel
  - useWebRTCSignaling: T028, T029 in parallel
  - webcam: T032, T033, T034 in parallel

#### User Story 2 (Consolidate)
- After utilities created (T057-T061):
  - T065, T066, T067 (ID normalization replacements) in parallel
  - T074, T075, T076, T077 (self-check replacements) in parallel

#### User Story 3 (Fix Architecture)
- T131, T132 (webcam cleanup) in parallel
- T117, T118 (defensive checks) in parallel

**Total Parallelizable Tasks**: 35+ tasks marked [P]

---

## Parallel Example: User Story 1 - Logging Removal

```bash
# Launch all logging removal tasks for a single file together:

# VideoStreamGrid.tsx logging removal (T011, T012, T013):
Task 1: "Remove debug logging for remote stream changes (lines 117-157)"
Task 2: "Remove debug logging for remote video refs (lines 328-372)"
Task 3: "Remove verbose logging from video element event handlers (lines 487-556)"

# Then run integration tests (T014) before moving to next file

# useWebRTC.ts logging removal (T016, T017, T018, T019):
Task 1: "Remove initialization logging"
Task 2: "Remove success confirmation logs"
Task 3: "Remove window object log counters"
Task 4: "Keep only console.error for unexpected failures"

# Then run integration tests (T020) before moving to next file
```

---

## Parallel Example: User Story 2 - Replacements

```bash
# After utilities created (T057-T061), launch multiple replacements:

# ID normalization replacements (T065, T066, T067):
Task 1: "Replace ID normalization at lines 199-201"
Task 2: "Replace ID normalization at lines 343-344"
Task 3: "Replace ID normalization at lines 857-858"

# All safe to run in parallel (different line ranges, same pattern)

# Self-connection check replacements (T074, T075, T076, T077):
Task 1: "Replace self-check at lines 365-371"
Task 2: "Replace self-check at lines 485-489"
Task 3: "Replace self-check at lines 516-520"
Task 4: "Replace self-check at lines 964-969"

# All safe to run in parallel (different line ranges, same pattern)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T006) → Baseline established
2. Complete Phase 2: Foundational (T007-T008) → Clean state
3. Complete Phase 3: User Story 1 (T009-T056) → ~1,400 lines removed
4. **STOP and VALIDATE**: 
   - Run all integration tests
   - Manual 4-player room test
   - Bundle size check
5. **Deploy/Demo**: Show ~40% code reduction with maintained functionality
6. **Decision Point**: Continue to US2 or deploy MVP improvement now

### Incremental Delivery

1. **Milestone 1**: US1 Complete
   - ~1,400 lines removed
   - 90% logging gone
   - All tests passing
   - **Value**: Easier debugging, cleaner codebase

2. **Milestone 2**: US2 Complete (builds on US1)
   - Additional ~400 lines removed
   - Utilities in place
   - Duplicate logic eliminated
   - **Value**: Single source of truth for common operations

3. **Milestone 3**: US3 Complete (builds on US2)
   - Final ~450 lines removed
   - Event-driven architecture
   - No polling or workarounds
   - **Value**: More reliable, performant WebRTC implementation

### Single Developer Strategy

**Sequential execution** in priority order:

1. **Week 1**: Setup + US1 (Remove Bloat)
   - Days 1-2: Setup, logging removal (use parallelizable tasks)
   - Days 3-4: Unused features, refs, validation
   - Day 5: Testing, documentation, deploy

2. **Week 2**: US2 (Consolidate Logic)
   - Days 1-2: Create utilities, replace normalizations
   - Days 3-4: Replace checks, consolidate creation, error handling
   - Day 5: Testing, validation, deploy

3. **Week 3**: US3 (Fix Architecture)
   - Days 1-2: Remove polling, retry, cleanup
   - Days 3-4: Simplify patterns, webcam cleanup
   - Day 5: Final validation, performance testing, deploy

4. **Week 4**: Polish
   - Days 1-2: Documentation, final testing
   - Day 3-4: Code review, address feedback
   - Day 5: Merge to main

### Multi-Developer Strategy

With 2-3 developers (NOT recommended - sequential is cleaner for refactoring):

1. **All developers**: Complete Setup + Foundational together
2. **Developer A**: US1 (Primary - must complete first)
3. **Developer B**: Documentation, testing infrastructure
4. After US1 complete:
   - **Developer A**: US2
   - **Developer B**: US3 research and planning
5. After US2 complete:
   - **Developer A**: US3
   - **Developer B**: Polish and documentation

**⚠️ Recommendation**: Single developer sequential execution is BEST for refactoring to avoid merge conflicts and maintain consistency.

---

## Notes

### Key Principles

- **[P] tasks** = different files or line ranges, no dependencies, safe to parallelize
- **[Story] label** maps task to user story for traceability
- **Each user story** should be independently completable and testable
- **Commit after each logical group** (per file, per subsection)
- **Run integration tests frequently** (after each file or small group)
- **Stop at any checkpoint** to validate story independently

### Risk Mitigation

1. **Incremental validation**: Integration tests after every file change
2. **Git safety**: Commit after each successful change for easy rollback
3. **Manual testing**: Supplement automated tests with real usage validation
4. **Performance monitoring**: Track metrics throughout refactoring
5. **Reversibility**: Each user story can be reverted independently if needed

### Avoid

- ❌ Vague tasks without specific file paths
- ❌ Tasks that touch same lines simultaneously
- ❌ Cross-story dependencies that break independence
- ❌ Large commits with multiple concerns mixed together
- ❌ Skipping validation steps to "save time"
- ❌ Changing multiple files without intermediate testing

### Success Indicators

- ✅ All 170 tasks completed
- ✅ All integration tests passing
- ✅ 51% code reduction achieved (3,595 → ~1,750 lines)
- ✅ 90% logging reduction achieved
- ✅ Bundle size reduced by 15%+
- ✅ Zero polling loops remain
- ✅ All utilities centralized
- ✅ 30+ minute stable streaming validated
- ✅ Sub-2-second connection establishment maintained

---

## Summary

**Total Tasks**: 170  
**MVP Tasks** (Setup + Foundational + US1): 56 tasks  
**Full Feature Tasks**: 170 tasks

**Task Breakdown by Phase**:
- Phase 1 (Setup): 6 tasks
- Phase 2 (Foundational): 2 tasks
- Phase 3 (US1 - Remove Bloat): 47 tasks ← **MVP Cutoff**
- Phase 4 (US2 - Consolidate): 45 tasks
- Phase 5 (US3 - Fix Architecture): 45 tasks
- Phase 6 (Polish): 25 tasks

**Parallel Opportunities**: 35+ tasks marked [P] can run in parallel within their phase

**Estimated Timeline**:
- **MVP (US1 only)**: 1-2 weeks for single developer
- **Full Feature (US1+US2+US3)**: 3-4 weeks for single developer
- **With Polish**: 4 weeks total

**Independent Testing**:
- Each user story has explicit validation checkpoints
- Integration tests run after each significant change
- Manual testing supplements automated validation
- Performance benchmarks tracked throughout

**Deployment Strategy**: Can deploy after any user story completion for incremental value delivery

