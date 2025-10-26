# Tasks: Discord Gateway Service

**Input**: Design documents from `/specs/014-discord-gateway-service/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT included in this task list as they were not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Gateway Worker**: `packages/discord-gateway-worker/src/`
- **TanStack Start Backend**: `apps/web/app/`
- **Client Libraries**: `packages/discord-integration/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create Gateway Worker package structure at packages/discord-gateway-worker/
- [ ] T002 Initialize Gateway Worker package.json with dependencies (ws, discord-api-types, node:crypto, node:fetch)
- [ ] T003 [P] Create TanStack Start server utilities directory at apps/web/app/server/
- [ ] T004 [P] Add jose dependency to apps/web/package.json for JWT verification
- [ ] T005 [P] Create TypeScript types file at packages/discord-gateway-worker/src/types.ts
- [ ] T006 [P] Create environment configuration template at packages/discord-gateway-worker/.env.example
- [ ] T007 [P] Create environment configuration template at apps/web/.env.example (add Discord vars)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Implement HMAC signature generation in packages/discord-gateway-worker/src/hmac.ts
- [ ] T009 Implement HMAC signature verification in apps/web/app/server/hmac.ts
- [ ] T010 [P] Implement JWT verification using JWKS in apps/web/app/server/jwt.ts
- [ ] T011 [P] Create WebSocket manager with registry in apps/web/app/server/ws-manager.ts
- [ ] T012 [P] Create Discord REST API helpers in apps/web/app/server/discord.ts
- [ ] T013 [P] Implement message envelope schema with Zod in packages/discord-gateway-worker/src/types.ts
- [ ] T014 [P] Create event payload schemas (RoomCreated, RoomDeleted, VoiceJoined, VoiceLeft) in packages/discord-gateway-worker/src/types.ts
- [ ] T015 Implement Discord Gateway client connection logic in packages/discord-gateway-worker/src/gateway.ts
- [ ] T016 Implement heartbeat mechanism with watchdog in packages/discord-gateway-worker/src/gateway.ts
- [ ] T017 Implement session resume capability in packages/discord-gateway-worker/src/gateway.ts
- [ ] T018 Implement exponential backoff reconnection in packages/discord-gateway-worker/src/gateway.ts
- [ ] T019 Implement hub client for posting events in packages/discord-gateway-worker/src/hub-client.ts
- [ ] T020 Create Gateway Worker entry point with health check endpoint in packages/discord-gateway-worker/src/index.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Create Discord Voice Channels (Priority: P1) 🎯 MVP

**Goal**: Enable players to create Discord voice channels for game sessions via REST API

**Independent Test**: 
1. Start Gateway Worker and TanStack Start backend
2. Call POST /api/create-room with valid JWT
3. Verify channel created in Discord guild
4. Verify room.created event broadcast to WebSocket clients

### Implementation for User Story 1

- [ ] T021 [P] [US1] Create CreateRoomRequest schema with Zod in apps/web/app/server/schemas.ts
- [ ] T022 [P] [US1] Create CreateRoomResponse schema with Zod in apps/web/app/server/schemas.ts
- [ ] T023 [US1] Implement POST /api/create-room route in apps/web/app/routes/api/create-room.ts
- [ ] T024 [US1] Add JWT verification middleware to create-room route
- [ ] T025 [US1] Implement Discord createVoiceChannel REST API call in create-room route
- [ ] T026 [US1] Broadcast room.created event to WebSocket clients in create-room route
- [ ] T027 [US1] Add error handling and validation to create-room route
- [ ] T028 [US1] Add logging for room creation operations
- [ ] T029 [US1] Configure CHANNEL_CREATE event forwarding in packages/discord-gateway-worker/src/gateway.ts
- [ ] T030 [US1] Add room.created event broadcasting in packages/discord-gateway-worker/src/hub-client.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - players can create voice channels

---

## Phase 4: User Story 2 - End Discord Voice Channels (Priority: P1)

**Goal**: Enable players to delete Discord voice channels when game sessions finish

**Independent Test**:
1. Create a voice channel using US1
2. Call DELETE /api/end-room/:channelId with valid JWT
3. Verify channel deleted in Discord guild
4. Verify room.deleted event broadcast to WebSocket clients

### Implementation for User Story 2

- [ ] T031 [P] [US2] Create DeleteRoomResponse schema with Zod in apps/web/app/server/schemas.ts
- [ ] T032 [US2] Implement DELETE /api/end-room/$channelId route in apps/web/app/routes/api/end-room.$channelId.ts
- [ ] T033 [US2] Add JWT verification middleware to end-room route
- [ ] T034 [US2] Implement Discord deleteChannel REST API call in end-room route
- [ ] T035 [US2] Broadcast room.deleted event to WebSocket clients in end-room route
- [ ] T036 [US2] Add error handling for non-existent channels and permission errors
- [ ] T037 [US2] Add logging for room deletion operations
- [ ] T038 [US2] Configure CHANNEL_DELETE event forwarding in packages/discord-gateway-worker/src/gateway.ts
- [ ] T039 [US2] Add room.deleted event broadcasting in packages/discord-gateway-worker/src/hub-client.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - full room lifecycle management

---

## Phase 5: User Story 3 - Real-time Voice Join/Leave Notifications (Priority: P1)

**Goal**: Enable players to receive real-time notifications when users join/leave voice channels

**Independent Test**:
1. Connect WebSocket client with valid JWT to /api/ws
2. Join a Discord voice channel in Discord client
3. Verify voice.joined event received by WebSocket client
4. Leave the voice channel
5. Verify voice.left event received by WebSocket client

### Implementation for User Story 3

- [ ] T040 [P] [US3] Create WSAuthMessage schema with Zod in apps/web/app/server/schemas.ts
- [ ] T041 [P] [US3] Create VoiceState schema with Zod in apps/web/app/server/schemas.ts
- [ ] T042 [US3] Implement WebSocket endpoint at apps/web/app/routes/api/ws.ts
- [ ] T043 [US3] Add WebSocket authentication handler in ws route
- [ ] T044 [US3] Implement WebSocket connection registration in ws-manager
- [ ] T045 [US3] Implement WebSocket disconnection cleanup in ws-manager
- [ ] T046 [US3] Add backpressure handling (close clients with large bufferedAmount) in ws-manager
- [ ] T047 [US3] Implement WebSocket auto-reconnect logic documentation in quickstart.md
- [ ] T048 [US3] Configure VOICE_STATE_UPDATE event subscription in packages/discord-gateway-worker/src/gateway.ts
- [ ] T049 [US3] Implement voice.joined event detection and forwarding in packages/discord-gateway-worker/src/gateway.ts
- [ ] T050 [US3] Implement voice.left event detection and forwarding in packages/discord-gateway-worker/src/gateway.ts
- [ ] T051 [US3] Filter events to PRIMARY_GUILD_ID only in packages/discord-gateway-worker/src/gateway.ts
- [ ] T052 [US3] Add logging for voice state change events

**Checkpoint**: All core real-time features now functional - players can see who joins/leaves voice channels

---

## Phase 6: User Story 4 - DiscordRestClient Implementation (Priority: P2)

**Goal**: Provide complete Discord REST API client for developers

**Independent Test**:
1. Import DiscordRestClient from packages/discord-integration
2. Create instance with bot token
3. Call createVoiceChannel() and verify channel created
4. Call deleteChannel() and verify channel deleted
5. Verify rate limiting and retry logic works

### Implementation for User Story 4

- [ ] T053 [P] [US4] Create DiscordRestClient class in packages/discord-integration/src/clients/DiscordRestClient.ts
- [ ] T054 [P] [US4] Create Zod schemas for REST API requests in packages/discord-integration/src/types/rest-schemas.ts
- [ ] T055 [P] [US4] Create Zod schemas for REST API responses in packages/discord-integration/src/types/rest-schemas.ts
- [ ] T056 [US4] Implement createVoiceChannel() method with Zod validation
- [ ] T057 [US4] Implement deleteChannel() method with Zod validation
- [ ] T058 [US4] Implement sendMessage() method with Zod validation (for future text chat)
- [ ] T059 [US4] Implement getChannels() method with Zod validation (for future UI)
- [ ] T060 [US4] Implement rate limit detection (429 responses) in DiscordRestClient
- [ ] T061 [US4] Implement exponential backoff retry logic (max 3 retries) in DiscordRestClient
- [ ] T062 [US4] Add audit log reasons to all requests in DiscordRestClient
- [ ] T063 [US4] Add error handling and clear error messages in DiscordRestClient
- [ ] T064 [US4] Add logging for all Discord REST API operations
- [ ] T065 [US4] Export DiscordRestClient from packages/discord-integration/src/index.ts

**Checkpoint**: DiscordRestClient fully implemented and ready for use by developers

---

## Phase 7: User Story 5 - DiscordRtcClient Implementation (Priority: P2)

**Goal**: Provide complete Discord RTC client for voice/video streaming

**Independent Test**:
1. Import DiscordRtcClient from packages/discord-integration
2. Create instance and connect to voice channel
3. Send audio stream and verify audio transmitted
4. Send video stream (webcam) and verify video transmitted
5. Receive audio/video from other users
6. Verify VP8 codec used for video, Opus for audio

### Implementation for User Story 5

- [ ] T066 [P] [US5] Create DiscordRtcClient class in packages/discord-integration/src/clients/DiscordRtcClient.ts
- [ ] T067 [P] [US5] Create types for RTC connection state in packages/discord-integration/src/types/rtc-types.ts
- [ ] T068 [P] [US5] Create types for media streams (audio/video) in packages/discord-integration/src/types/rtc-types.ts
- [ ] T069 [US5] Implement connect(channelId) method for joining voice channels
- [ ] T070 [US5] Implement disconnect() method for leaving voice channels
- [ ] T071 [US5] Establish UDP connection for media transport in DiscordRtcClient
- [ ] T072 [US5] Implement sendAudio(stream) method with Opus codec (48kHz)
- [ ] T073 [US5] Implement sendVideo(stream) method with VP8 codec (primary)
- [ ] T074 [US5] Add VP9 and H.264 fallback codec support for video
- [ ] T075 [US5] Implement onAudio(callback) event handler for receiving audio
- [ ] T076 [US5] Implement onVideo(callback) event handler for receiving video
- [ ] T077 [US5] Handle voice state updates from Discord Gateway
- [ ] T078 [US5] Implement xsalsa20_poly1305 encryption for audio/video
- [ ] T079 [US5] Configure audio format (Opus frames, 20ms, stereo/mono)
- [ ] T080 [US5] Configure video format (720p/1080p, VP8 encoding)
- [ ] T081 [US5] Add error handling for connection failures
- [ ] T082 [US5] Add logging for RTC operations
- [ ] T083 [US5] Export DiscordRtcClient from packages/discord-integration/src/index.ts

**Checkpoint**: DiscordRtcClient fully implemented - players can stream webcams showing board state

---

## Phase 8: Internal Events Endpoint (Cross-Cutting)

**Goal**: Secure internal webhook endpoint for Gateway Worker to post events to TanStack Start

**Independent Test**:
1. Gateway Worker detects Discord event
2. Gateway Worker posts to /api/internal/events with HMAC signature
3. TanStack Start verifies HMAC and broadcasts to WebSocket clients
4. Verify replay protection (reject signatures >60s old)

### Implementation

- [ ] T084 [P] Create InternalEvent schema with Zod in apps/web/app/server/schemas.ts
- [ ] T085 Implement POST /api/internal/events route in apps/web/app/routes/api/internal/events.ts
- [ ] T086 Add HMAC signature verification to internal events route
- [ ] T087 Add timestamp verification (reject >60s) for replay protection
- [ ] T088 Implement event broadcasting to WebSocket clients in internal events route
- [ ] T089 Add error handling for invalid signatures and malformed payloads
- [ ] T090 Add logging for all internal event posts and verification failures

**Checkpoint**: Secure internal communication established between Gateway Worker and TanStack Start

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T091 [P] Add comprehensive logging configuration (LOG_LEVEL env var) to Gateway Worker
- [ ] T092 [P] Add comprehensive logging configuration (LOG_LEVEL env var) to TanStack Start
- [ ] T093 [P] Create deployment documentation in packages/discord-gateway-worker/README.md
- [ ] T094 [P] Create API documentation in apps/web/docs/discord-api.md
- [ ] T095 [P] Update quickstart.md with complete local development setup instructions
- [ ] T096 [P] Add health check endpoint documentation to Gateway Worker README
- [ ] T097 [P] Document environment variables in both .env.example files
- [ ] T098 [P] Add CORS configuration to TanStack Start for WEB_ORIGIN
- [ ] T099 [P] Add rate limiting considerations documentation
- [ ] T100 [P] Document multi-guild expansion path in Future Enhancements section
- [ ] T101 Validate quickstart.md instructions end-to-end
- [ ] T102 Code review and refactoring for consistency
- [ ] T103 Security audit (bot token exposure, HMAC verification, JWT validation)
- [ ] T104 Performance validation (WebSocket latency <100ms, REST API <500ms)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1, US2, US3 are P1 priority (MVP scope)
  - US4, US5 are P2 priority (can be done after MVP)
  - User stories can proceed in parallel if staffed
- **Internal Events (Phase 8)**: Can be done in parallel with user stories (cross-cutting)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent of US1 but complements it
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Independent of US1/US2
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent library implementation
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - Independent library implementation
- **Internal Events (Phase 8)**: Required for US3 to work end-to-end, but can be implemented in parallel

### Within Each User Story

- Schemas before route implementations
- Route implementations before event forwarding
- Core implementation before error handling and logging
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Schemas within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members
- Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch schemas together:
Task: "Create CreateRoomRequest schema with Zod in apps/web/app/server/schemas.ts"
Task: "Create CreateRoomResponse schema with Zod in apps/web/app/server/schemas.ts"

# Then implement route (depends on schemas):
Task: "Implement POST /api/create-room route in apps/web/app/routes/api/create-room.ts"
```

## Parallel Example: User Story 5

```bash
# Launch type definitions together:
Task: "Create types for RTC connection state in packages/discord-integration/src/types/rtc-types.ts"
Task: "Create types for media streams (audio/video) in packages/discord-integration/src/types/rtc-types.ts"

# Then implement client methods in parallel:
Task: "Implement sendAudio(stream) method with Opus codec (48kHz)"
Task: "Implement sendVideo(stream) method with VP8 codec (primary)"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Create rooms)
4. Complete Phase 4: User Story 2 (Delete rooms)
5. Complete Phase 5: User Story 3 (Real-time events)
6. Complete Phase 8: Internal Events (Required for US3)
7. **STOP and VALIDATE**: Test all three user stories independently
8. Deploy/demo if ready

**MVP Scope**: 104 tasks (T001-T052, T084-T090, T091-T104)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (Basic room creation)
3. Add User Story 2 → Test independently → Deploy/Demo (Full room lifecycle)
4. Add User Story 3 → Test independently → Deploy/Demo (Real-time events - MVP complete!)
5. Add User Story 4 → Test independently → Deploy/Demo (REST client library)
6. Add User Story 5 → Test independently → Deploy/Demo (RTC client library with video)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Create rooms)
   - Developer B: User Story 2 (Delete rooms)
   - Developer C: User Story 3 (Real-time events)
   - Developer D: User Story 4 (REST client)
   - Developer E: User Story 5 (RTC client)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Gateway Worker must be deployed separately from TanStack Start
- Bot token MUST never be exposed to browser
- HMAC signatures MUST be verified for all internal events
- WebSocket clients MUST implement auto-reconnect with exponential backoff
- Video codec priority: VP8 (primary), VP9/H.264 (fallbacks)
- Audio codec: Opus @ 48kHz (Discord standard)

---

## Task Count Summary

- **Total Tasks**: 104
- **Setup (Phase 1)**: 7 tasks
- **Foundational (Phase 2)**: 13 tasks
- **User Story 1 (Phase 3)**: 10 tasks
- **User Story 2 (Phase 4)**: 9 tasks
- **User Story 3 (Phase 5)**: 13 tasks
- **User Story 4 (Phase 6)**: 13 tasks
- **User Story 5 (Phase 7)**: 18 tasks
- **Internal Events (Phase 8)**: 7 tasks
- **Polish (Phase 9)**: 14 tasks

**MVP Scope** (US1, US2, US3 + Infrastructure): ~52 core tasks
**Full Implementation** (All user stories): 104 tasks
