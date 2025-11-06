# Tasks: WebRTC Video Streaming Between Players

**Input**: Design documents from `/specs/001-webrtc-video-streaming/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not requested in specification - tests are optional per constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `apps/web/src/` (React frontend + TanStack Start backend)
- Server functions: `apps/web/src/server/handlers/`
- React hooks: `apps/web/src/hooks/`
- React components: `apps/web/src/components/`
- Utilities: `apps/web/src/lib/webrtc/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and type definitions

- [X] T001 Create WebRTC library directory structure at apps/web/src/lib/webrtc/
- [X] T002 [P] Create type definitions file apps/web/src/lib/webrtc/types.ts with PeerConnectionState enum and SignalingMessageType
- [X] T003 [P] Create signaling message types file apps/web/src/lib/webrtc/signaling.ts with SignalingPayload interfaces

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core signaling infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create server function apps/web/src/server/handlers/webrtc-signaling.server.ts with sendSignalingMessage createServerFn
- [X] T005 [P] Implement signaling message validation in apps/web/src/server/handlers/webrtc-signaling.server.ts (validate roomId, to, message type, payload structure)
- [X] T006 [P] Implement backend routing logic in apps/web/src/server/handlers/webrtc-signaling.server.ts (route messages via SSE manager to target players)
- [X] T007 Create signaling hook apps/web/src/hooks/useWebRTCSignaling.ts with SSE subscription for receiving signaling messages
- [X] T008 [P] Implement sendOffer, sendAnswer, sendIceCandidate functions in apps/web/src/hooks/useWebRTCSignaling.ts using createServerFn
- [X] T009 [P] Implement SSE message filtering in apps/web/src/hooks/useWebRTCSignaling.ts (filter by roomId and from player, ignore self)

**Checkpoint**: Foundation ready - signaling infrastructure complete, user story implementation can now begin

---

## Phase 3: User Story 1 - Establish Video Connection with Other Players (Priority: P1) 🎯 MVP

**Goal**: When a player joins a game room, their webcam stream automatically connects and is visible to all other players. When other players join, their webcam streams appear in the player's view.

**Independent Test**: Two players join the same game room and verify each player sees the other's webcam feed in their respective video grid.

### Implementation for User Story 1

- [X] T010 [US1] Create peer connection manager apps/web/src/lib/webrtc/peer-connection.ts with RTCPeerConnection wrapper class
- [X] T011 [US1] Implement createPeerConnection function in apps/web/src/lib/webrtc/peer-connection.ts with STUN server configuration (stun:stun.l.google.com:19302)
- [X] T012 [US1] Implement addLocalStream method in apps/web/src/lib/webrtc/peer-connection.ts to add MediaStream tracks to peer connection
- [X] T013 [US1] Implement createOffer method in apps/web/src/lib/webrtc/peer-connection.ts to generate and set local description
- [X] T014 [US1] Implement handleOffer method in apps/web/src/lib/webrtc/peer-connection.ts to set remote description and create answer
- [X] T015 [US1] Implement handleAnswer method in apps/web/src/lib/webrtc/peer-connection.ts to set remote description
- [X] T016 [US1] Implement handleIceCandidate method in apps/web/src/lib/webrtc/peer-connection.ts to add ICE candidates to peer connection
- [X] T017 [US1] Implement ontrack handler in apps/web/src/lib/webrtc/peer-connection.ts to capture remote MediaStream
- [X] T018 [US1] Create useWebRTC hook apps/web/src/hooks/useWebRTC.ts with peer connection management for all players in room
- [X] T019 [US1] Implement initializePeerConnections function in apps/web/src/hooks/useWebRTC.ts to create connections for all remote players
- [X] T020 [US1] Implement offer/answer exchange logic in apps/web/src/hooks/useWebRTC.ts integrating with useWebRTCSignaling hook
- [X] T021 [US1] Implement ICE candidate exchange logic in apps/web/src/hooks/useWebRTC.ts for each peer connection
- [X] T022 [US1] Implement getLocalMediaStream function in apps/web/src/hooks/useWebRTC.ts to request camera/microphone permissions (FR-005)
- [X] T023 [US1] Integrate useWebRTC hook in apps/web/src/components/GameRoom.tsx to initialize connections when players join room

**Checkpoint**: At this point, User Story 1 should be fully functional - players can establish video connections and see each other's streams

---

## Phase 4: User Story 4 - View All Players in Grid Layout (Priority: P1) 🎯 MVP

**Goal**: Each player's webcam stream is displayed in a grid layout with clear visual indicators showing player names, connection status, and audio/video state.

**Independent Test**: Join a room with multiple players and verify all streams are displayed in a properly organized grid with player names and status indicators.

### Implementation for User Story 4

- [X] T024 [US4] Modify apps/web/src/components/VideoStreamGrid.tsx to accept remote streams prop from useWebRTC hook
- [X] T025 [US4] Implement remote stream video element rendering in apps/web/src/components/VideoStreamGrid.tsx for each player with active peer connection
- [X] T026 [US4] Connect remote MediaStream from peer connections to video elements in apps/web/src/components/VideoStreamGrid.tsx using ref and srcObject
- [X] T027 [US4] Integrate connection state indicators in apps/web/src/components/VideoStreamGrid.tsx showing connected/connecting/disconnected status per player (FR-009)
- [X] T028 [US4] Ensure grid layout displays all players correctly (up to 4 players) in apps/web/src/components/VideoStreamGrid.tsx

**Checkpoint**: At this point, User Stories 1 AND 4 should work together - players see all other players' streams in grid layout

---

## Phase 5: User Story 2 - Handle Connection Failures and Reconnections (Priority: P2)

**Goal**: System gracefully handles network interruptions, peer disconnections, and connection failures. Players are notified of connection issues and streams automatically attempt to reconnect.

**Independent Test**: Simulate network conditions (disabling network adapter, changing WiFi) and verify connections recover automatically with appropriate status indicators.

### Implementation for User Story 2

- [ ] T029 [US2] Implement connection state tracking in apps/web/src/lib/webrtc/peer-connection.ts mapping RTCPeerConnection.iceConnectionState to application states (disconnected, connecting, connected, failed, reconnecting)
- [ ] T030 [US2] Implement oniceconnectionstatechange handler in apps/web/src/lib/webrtc/peer-connection.ts to update connection state
- [ ] T031 [US2] Implement automatic reconnection logic in apps/web/src/hooks/useWebRTC.ts when connection state changes to disconnected (FR-010)
- [ ] T032 [US2] Implement 30-second timeout for ICE failures in apps/web/src/hooks/useWebRTC.ts showing "connection failed" error after timeout (FR-018)
- [ ] T033 [US2] Add retry button UI in apps/web/src/components/VideoStreamGrid.tsx for failed connections allowing manual reconnection attempt
- [ ] T034 [US2] Implement reconnection on signaling service reconnection in apps/web/src/hooks/useWebRTC.ts to re-establish all peer connections when SSE reconnects
- [ ] T035 [US2] Update connection status indicators in apps/web/src/components/VideoStreamGrid.tsx to show "reconnecting" state during automatic reconnection attempts

**Checkpoint**: At this point, User Stories 1, 2, and 4 should work - connections handle failures and reconnect automatically

---

## Phase 6: User Story 3 - Control Video and Audio Streams (Priority: P2)

**Goal**: Players can mute/unmute their audio and enable/disable their video feed independently. These changes are reflected in real-time for all other players in the room.

**Independent Test**: Single player toggles audio/video controls and verifies other players see state changes immediately in their UI.

### Implementation for User Story 3

- [ ] T036 [US3] Implement toggleVideo function in apps/web/src/hooks/useWebRTC.ts to enable/disable local video track (reuse existing VideoStreamGrid video toggle button per FR-007)
- [ ] T037 [US3] Implement toggleAudio function in apps/web/src/hooks/useWebRTC.ts to mute/unmute local audio track (reuse existing VideoStreamGrid audio mute button per FR-008)
- [ ] T038 [US3] Implement stream state synchronization via signaling in apps/web/src/hooks/useWebRTC.ts to broadcast video/audio state changes to all peers
- [ ] T039 [US3] Implement remote stream state update handler in apps/web/src/hooks/useWebRTC.ts to receive and apply state changes from other players
- [ ] T040 [US3] Update apps/web/src/components/VideoStreamGrid.tsx to display "video off" indicator when remote player disables video
- [ ] T041 [US3] Update apps/web/src/components/VideoStreamGrid.tsx to display muted audio indicator when remote player mutes audio (reuse existing audio status indicators per FR-009)
- [ ] T042 [US3] Implement camera switching with track replacement in apps/web/src/hooks/useWebRTC.ts using RTCRtpSender.replaceTrack() API (FR-015)
- [ ] T043 [US3] Integrate camera switching with existing camera selection popover in apps/web/src/components/VideoStreamGrid.tsx to replace tracks in all peer connections when camera changes

**Checkpoint**: At this point, all user stories should work - players can control their video/audio and see other players' state changes

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, cleanup, edge cases, and improvements affecting multiple user stories

- [ ] T044 [P] Implement permission denial handling in apps/web/src/hooks/useWebRTC.ts showing "camera unavailable" or "microphone unavailable" status with retry button (FR-017)
- [ ] T045 [P] Implement WebRTC browser compatibility check in apps/web/src/hooks/useWebRTC.ts showing "WebRTC not supported" status for unsupported browsers
- [ ] T046 [P] Implement cleanup function in apps/web/src/hooks/useWebRTC.ts to close all peer connections and stop media tracks when player leaves room (FR-016)
- [ ] T047 [P] Implement cleanup in apps/web/src/components/GameRoom.tsx to call useWebRTC cleanup on component unmount or player leave
- [ ] T048 [P] Implement stream removal from grid in apps/web/src/components/VideoStreamGrid.tsx when peer connection closes or player leaves (FR-011)
- [ ] T049 [P] Add error handling for track replacement failures in apps/web/src/hooks/useWebRTC.ts when switching cameras
- [ ] T050 [P] Verify all connection state transitions work correctly per data-model.md state machine
- [ ] T051 [P] Add logging for WebRTC connection events in apps/web/src/lib/webrtc/peer-connection.ts for debugging
- [ ] T052 [P] Validate signaling message contracts match apps/web/src/server/handlers/webrtc-signaling.server.ts per contracts/signaling-api.md
- [ ] T053 [P] Run quickstart.md validation checklist for manual testing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1) and User Story 4 (P1) can proceed in parallel after Foundational
  - User Story 2 (P2) depends on User Story 1 (needs peer connections)
  - User Story 3 (P2) depends on User Story 1 (needs peer connections and streams)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core connection establishment
- **User Story 4 (P1)**: Can start after Foundational (Phase 2) - Depends on User Story 1 for streams to display
- **User Story 2 (P2)**: Depends on User Story 1 - Needs peer connections to handle failures
- **User Story 3 (P2)**: Depends on User Story 1 - Needs peer connections and streams to control

### Within Each User Story

- Core peer connection logic before hook integration
- Hook implementation before component integration
- Component updates after hook is ready
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel (different files)
- **Phase 2**: T005, T006, T008, T009 can run in parallel (different functions in same files, but no conflicts)
- **Phase 3 (US1)**: T011-T017 can be implemented sequentially (peer connection manager) then T018-T023 sequentially (hook integration)
- **Phase 4 (US4)**: T024-T028 can be implemented sequentially (component modifications)
- **Phase 5 (US2)**: T029-T035 can be implemented sequentially (error handling layers)
- **Phase 6 (US3)**: T036-T043 can be implemented sequentially (control features)
- **Phase 7**: All tasks marked [P] can run in parallel (different concerns)

---

## Parallel Example: User Story 1

```bash
# Sequential implementation recommended for US1:
# 1. First implement peer connection manager (T010-T017)
Task: "Create peer connection manager apps/web/src/lib/webrtc/peer-connection.ts"
Task: "Implement createPeerConnection function..."
Task: "Implement addLocalStream method..."
# ... continue through T017

# 2. Then implement hook integration (T018-T023)
Task: "Create useWebRTC hook apps/web/src/hooks/useWebRTC.ts"
Task: "Implement initializePeerConnections function..."
# ... continue through T023
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 4 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Establish connections)
4. Complete Phase 4: User Story 4 (Display in grid)
5. **STOP and VALIDATE**: Test both stories independently - players can see each other's video in grid
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Players can establish connections
3. Add User Story 4 → Test independently → Players see streams in grid (MVP!)
4. Add User Story 2 → Test independently → Connections handle failures gracefully
5. Add User Story 3 → Test independently → Players can control video/audio
6. Add Polish → Final validation
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (connection establishment)
   - Developer B: Prepare for User Story 4 (after US1 complete)
3. After US1 complete:
   - Developer A: User Story 2 (error handling)
   - Developer B: User Story 4 (grid display)
4. After US4 complete:
   - Developer A: User Story 3 (controls)
   - Developer B: Polish phase tasks
5. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files or different functions, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- User Story 1 + User Story 4 together form the MVP
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Reuse existing VideoStreamGrid UI components per specification requirements

