# Tasks: Discord API Integration for Remote MTG Play

**Input**: Design documents from `/specs/013-discord-api-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are OPTIONAL and not included per constitution (tests optional unless explicitly requested).

**Organization**: Tasks grouped by user story (P1-P6) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1, US2, US3, US4, US5, US6)
- Include exact file paths

## Path Conventions
- **New package**: `packages/discord-integration/src/`
- **Web app updates**: `apps/web/src/`

---

## Phase 1: Setup

- [x] T001 Create `packages/discord-integration/` directory structure
- [x] T002 Initialize package.json with discord-api-types, zod
- [x] T003 [P] Create tsconfig.json extending base config
- [x] T004 [P] Create README.md documenting SoC principles
- [x] T005 [P] Create directories: `src/{clients,managers,utils,types}/`
- [x] T006 [P] Create `src/index.ts` for exports
- [x] T007 Add `@repo/discord-integration` to `apps/web/package.json`
- [x] T008 [P] Add `VITE_DISCORD_CLIENT_ID` to `apps/web/.env.development`
- [x] T009 [P] Update `pnpm-workspace.yaml` if needed

---

## Phase 2: Foundational (BLOCKS ALL USER STORIES)

- [x] T010 [P] Define DiscordToken schema in `types/auth.ts`
- [x] T011 [P] Define DiscordUser schema in `types/auth.ts`
- [x] T012 [P] Define PKCEChallenge type in `types/auth.ts`
- [x] T013 [P] Define GatewayEvent types in `types/gateway.ts`
- [x] T014 [P] Define VoiceState schema in `types/gateway.ts`
- [x] T015 [P] Define DiscordChannel schema in `types/messages.ts`
- [x] T016 [P] Define DiscordMessage schema in `types/messages.ts`
- [x] T017 [P] Define RoomMetadata schema in `types/rooms.ts`
- [x] T018 [P] Define GameRoom schema in `types/rooms.ts`
- [x] T019 [P] Create validation utilities in `utils/validators.ts`
- [x] T020 [P] Create message formatters in `utils/formatters.ts`
- [x] T021 [P] Create Discord config in `apps/web/src/config/discord.ts`
- [x] T022 Export all types from `src/index.ts`

---

## Phase 3: US1 - Discord Authentication Gate (P1) 🎯 MVP

**Goal**: Users authenticate with Discord, see profile in header

**Test**: Create game, complete OAuth, verify profile appears

- [x] T023 [P] [US1] Implement DiscordOAuthClient in `clients/DiscordOAuthClient.ts`
- [x] T024 [P] [US1] Implement generatePKCE() using crypto.subtle
- [x] T025 [P] [US1] Implement getAuthUrl() with PKCE parameters
- [x] T026 [P] [US1] Implement exchangeCodeForToken()
- [x] T027 [P] [US1] Implement refreshToken()
- [x] T028 [P] [US1] Implement fetchUser()
- [x] T029 [US1] Add OAuthError handling
- [x] T030 [US1] Export DiscordOAuthClient
- [x] T031 [P] [US1] Create useDiscordAuth() in `apps/web/src/hooks/useDiscordAuth.ts`
- [x] T032 [US1] Implement token storage in localStorage
- [x] T033 [US1] Implement auto token refresh (5 min buffer)
- [x] T034 [US1] Implement logout function
- [x] T035 [P] [US1] Create useDiscordUser() in `hooks/useDiscordUser.ts`
- [x] T036 [P] [US1] Create DiscordAuthModal in `components/discord/DiscordAuthModal.tsx`
- [x] T037 [P] [US1] Create DiscordLoginButton in `components/discord/DiscordLoginButton.tsx`
- [x] T038 [P] [US1] Create DiscordUserProfile in `components/discord/DiscordUserProfile.tsx`
- [x] T039 [US1] Update LandingPage to intercept Create/Join Game
- [x] T040 [US1] Show DiscordAuthModal when unauthenticated
- [x] T041 [US1] Update header with DiscordUserProfile
- [x] T042 [US1] Create callback route in `routes/auth/discord/callback.tsx`
- [x] T043 [US1] Implement code exchange in callback
- [x] T044 [US1] Handle OAuth errors with retry
- [x] T045 [US1] Redirect after successful auth

---

## Phase 4: US2 - Connection Status (P2)

**Goal**: Show Discord Gateway connection status

**Test**: Authenticate, observe indicator, simulate network interruption

- [ ] T046 [P] [US2] Implement DiscordGatewayClient in `clients/DiscordGatewayClient.ts`
- [ ] T047 [P] [US2] Implement connect() for WebSocket
- [ ] T048 [P] [US2] Implement heartbeat mechanism
- [ ] T049 [P] [US2] Implement disconnect()
- [ ] T050 [P] [US2] Implement reconnection with exponential backoff
- [ ] T051 [P] [US2] Implement event emitters for state changes
- [ ] T052 [P] [US2] Implement Gateway event parsing
- [ ] T053 [US2] Add GatewayConnection state management
- [ ] T054 [US2] Export DiscordGatewayClient
- [ ] T055 [US2] Create useDiscordConnection() in `hooks/useDiscordConnection.ts`
- [ ] T056 [US2] Implement Gateway lifecycle management
- [ ] T057 [US2] Subscribe to connection state changes
- [ ] T058 [US2] Trigger connection on auth, disconnect on logout
- [ ] T059 [US2] Create ConnectionStatus in `components/discord/ConnectionStatus.tsx`
- [ ] T060 [US2] Display states: Connected, Reconnecting, Error
- [ ] T061 [US2] Add manual retry button
- [ ] T062 [US2] Integrate ConnectionStatus into header

---

## Phase 5: US3 - Text Chat (P3)

**Goal**: Send/receive messages through Discord channels

**Test**: Select channel, send messages, verify in Discord

- [ ] T063 [P] [US3] Implement DiscordRestClient in `clients/DiscordRestClient.ts`
- [ ] T064 [P] [US3] Implement getChannels()
- [ ] T065 [P] [US3] Implement getMessages()
- [ ] T066 [P] [US3] Implement sendMessage()
- [ ] T067 [P] [US3] Implement createEmbed()
- [ ] T068 [US3] Implement rate limit handling with queue
- [ ] T069 [US3] Add retry logic
- [ ] T070 [US3] Export DiscordRestClient
- [ ] T071 [US3] Create messageStore in `apps/web/src/stores/messageStore.ts`
- [ ] T072 [US3] Implement cache invalidation
- [ ] T073 [US3] Implement message queue
- [ ] T074 [P] [US3] Create useDiscordChannel() in `hooks/useDiscordChannel.ts`
- [ ] T075 [P] [US3] Create useDiscordMessages() in `hooks/useDiscordMessages.ts`
- [ ] T076 [P] [US3] Create useSendMessage() in `hooks/useSendMessage.ts`
- [ ] T077 [US3] Subscribe to MESSAGE_CREATE events
- [ ] T078 [US3] Handle MESSAGE_UPDATE and MESSAGE_DELETE
- [ ] T079 [P] [US3] Create ChannelSelector in `components/discord/ChannelSelector.tsx`
- [ ] T080 [P] [US3] Create MessageList in `components/discord/MessageList.tsx`
- [ ] T081 [P] [US3] Create MessageInput in `components/discord/MessageInput.tsx`
- [ ] T082 [US3] Display messages with author info
- [ ] T083 [US3] Support Discord markdown
- [ ] T084 [US3] Display send status
- [ ] T085 [US3] Add retry button for failed messages
- [ ] T086 [US3] Handle permission errors

---

## Phase 6: US4 - Game Event Embeds (P4)

**Goal**: Send rich embeds for card lookups and game events

**Test**: Trigger card lookup, verify embed in both interfaces

- [ ] T087 [P] [US4] Define GameEventEmbed schema in `types/messages.ts`
- [ ] T088 [P] [US4] Define embed types with union
- [ ] T089 [P] [US4] Create MessageEmbed in `components/discord/MessageEmbed.tsx`
- [ ] T090 [US4] Implement card lookup embed
- [ ] T091 [US4] Implement life total embed
- [ ] T092 [US4] Implement turn change embed
- [ ] T093 [US4] Add color coding
- [ ] T094 [US4] Integrate with card recognition
- [ ] T095 [US4] Integrate with game state tracking
- [ ] T096 [US4] Test mobile app compatibility

---

## Phase 7: US5 - Voice Channels (P5)

**Goal**: Create/join game sessions with Discord voice channels

**Test**: Create game, create channel, verify metadata and participant list

- [ ] T097 [P] [US5] Implement VoiceStateManager in `managers/VoiceStateManager.ts`
- [ ] T098 [P] [US5] Subscribe to VOICE_STATE_UPDATE
- [ ] T099 [P] [US5] Maintain voice state cache
- [ ] T100 [P] [US5] Emit voice state change events
- [ ] T101 [US5] Export VoiceStateManager
- [ ] T102 [P] [US5] Add createVoiceChannel() to DiscordRestClient
- [ ] T103 [P] [US5] Add deleteChannel()
- [ ] T104 [P] [US5] Add updateChannelTopic()
- [ ] T105 [P] [US5] Add getVoiceChannels()
- [ ] T106 [P] [US5] Add getChannelMembers()
- [ ] T107 [US5] Create roomStore in `apps/web/src/stores/roomStore.ts`
- [ ] T108 [US5] Create voiceStore in `stores/voiceStore.ts`
- [ ] T109 [US5] Implement room lifecycle states
- [ ] T110 [P] [US5] Create useDiscordVoiceChannel() in `hooks/useDiscordVoiceChannel.ts`
- [ ] T111 [P] [US5] Create useGameRoom() in `hooks/useGameRoom.ts`
- [ ] T112 [P] [US5] Create useRoomMetadata() in `hooks/useRoomMetadata.ts`
- [ ] T113 [P] [US5] Create usePlayerPresence() in `hooks/usePlayerPresence.ts`
- [ ] T114 [US5] Implement room creation with metadata
- [ ] T115 [US5] Implement room joining with validation
- [ ] T116 [US5] Handle metadata size validation
- [ ] T117 [P] [US5] Create VoiceChannelSelector in `components/discord/VoiceChannelSelector.tsx`
- [ ] T118 [P] [US5] Create RoomCreator in `components/discord/RoomCreator.tsx`
- [ ] T119 [P] [US5] Create PlayerList in `components/discord/PlayerList.tsx`
- [ ] T120 [P] [US5] Create RoomMetadata in `components/discord/RoomMetadata.tsx`
- [ ] T121 [US5] Display channel occupancy
- [ ] T122 [US5] Show voice state indicators
- [ ] T123 [US5] Generate invite links
- [ ] T124 [US5] Handle permission errors
- [ ] T125 [US5] Implement room cleanup

---

## Phase 8: US6 - Video Streaming (P6) ⚠️ HIGH RISK

**Goal**: Stream webcams through Discord with card recognition

**Test**: Start video, verify for other players, confirm card recognition

- [ ] T126 [P] [US6] Research Discord RTC protocol
- [ ] T127 [P] [US6] Implement DiscordRtcClient in `clients/DiscordRtcClient.ts`
- [ ] T128 [P] [US6] Implement connect()
- [ ] T129 [P] [US6] Implement startVideo()
- [ ] T130 [P] [US6] Implement stopVideo()
- [ ] T131 [P] [US6] Implement setQuality()
- [ ] T132 [P] [US6] Implement codec negotiation
- [ ] T133 [US6] Emit remote stream events
- [ ] T134 [US6] Export DiscordRtcClient
- [ ] T135 [P] [US6] Implement VideoQualityAdapter in `managers/VideoQualityAdapter.ts`
- [ ] T136 [P] [US6] Monitor bandwidth/packet loss
- [ ] T137 [P] [US6] Implement auto quality adaptation
- [ ] T138 [US6] Support Discord quality tiers
- [ ] T139 [US6] Export VideoQualityAdapter
- [ ] T140 [P] [US6] Define VideoStream schema in `types/gateway.ts`
- [ ] T141 [P] [US6] Define RtcConnection schema
- [ ] T142 [P] [US6] Define StreamQuality type
- [ ] T143 [P] [US6] Create useDiscordVideo() in `hooks/useDiscordVideo.ts`
- [ ] T144 [P] [US6] Create useVideoStream() in `hooks/useVideoStream.ts`
- [ ] T145 [P] [US6] Create useRemoteStreams() in `hooks/useRemoteStreams.ts`
- [ ] T146 [P] [US6] Create useStreamQuality() in `hooks/useStreamQuality.ts`
- [ ] T147 [US6] Enumerate webcam devices
- [ ] T148 [US6] Handle camera permissions
- [ ] T149 [P] [US6] Create CameraSelector in `components/discord/CameraSelector.tsx`
- [ ] T150 [P] [US6] Create VideoGrid in `components/discord/VideoGrid.tsx`
- [ ] T151 [P] [US6] Create StreamControls in `components/discord/StreamControls.tsx`
- [ ] T152 [P] [US6] Create QualityIndicator in `components/discord/QualityIndicator.tsx`
- [ ] T153 [US6] Display webcam preview
- [ ] T154 [US6] Support view modes
- [ ] T155 [US6] Display player overlays
- [ ] T156 [US6] Handle camera errors
- [ ] T157 [US6] Handle codec incompatibility
- [ ] T158 [P] [US6] Create VideoFrameAdapter in `apps/web/src/lib/card-recognition/VideoFrameAdapter.ts`
- [ ] T159 [US6] Capture frames for recognition
- [ ] T160 [US6] Run recognition on remote feeds
- [ ] T161 [US6] Display card results
- [ ] T162 [US6] Optimize frame capture rate
- [ ] T163 [US6] Document RTC limitations
- [ ] T164 [US6] Implement fallback error message
- [ ] T165 [US6] OR implement custom WebRTC fallback

---

## Phase 9: Polish

- [ ] T166 [P] Update README in `packages/discord-integration/`
- [ ] T167 [P] Update README in `apps/web/`
- [ ] T168 [P] Add JSDoc comments
- [ ] T169 [P] Verify Zod error messages
- [ ] T170 [P] Add CSP headers
- [ ] T171 [P] Implement input sanitization
- [ ] T172 [P] Add error logging
- [ ] T173 [P] Verify auto token refresh
- [ ] T174 [P] Test reconnection behavior
- [ ] T175 [P] Verify error messages
- [ ] T176 Run quickstart.md validation
- [ ] T177 Run `pnpm check-types`
- [ ] T178 Run `pnpm lint`
- [ ] T179 Run `pnpm format`
- [ ] T180 Verify constitutional compliance

---

## Summary

- **Total**: 180 tasks
- **Setup**: 9 tasks
- **Foundational**: 13 tasks (BLOCKS all stories)
- **US1 (P1)**: 23 tasks 🎯 MVP
- **US2 (P2)**: 17 tasks
- **US3 (P3)**: 24 tasks
- **US4 (P4)**: 10 tasks
- **US5 (P5)**: 29 tasks
- **US6 (P6)**: 40 tasks (HIGH RISK)
- **Polish**: 15 tasks

**MVP**: Complete Setup + Foundational + US1 (45 tasks)

**Dependencies**: US1 → US2 → US3 → US4; US2 → US5 → US6

See plan.md and IMPLEMENTATION_GUIDE.md for architecture details.
