# Discord API Integration - Feature Descriptions

**Overview**: Integrate Discord's API to provide chat messaging and webcam streaming infrastructure for Spell Coven's remote MTG play platform. This leverages Discord's existing voice channels, video streaming, and text chat capabilities as the backend communication layer.

**Implementation Strategy**: Split into 4 phases for incremental delivery and testing.

---

## Phase 1: Discord Authentication & Basic Connection

### Feature Description for `/speckit.specify`

**Feature Name**: Discord OAuth2 Authentication and Gateway Connection

**User Value**: MTG players can authenticate with their Discord accounts and establish a secure connection to Discord's real-time messaging infrastructure, enabling them to use Discord as the communication backend for game sessions.

**Core Capabilities**:

1. **Discord OAuth2 Login Flow**
   - Implement Discord OAuth2 authorization code flow in browser
   - Request permissions: `identify`, `guilds`, `messages.read`
   - Handle OAuth callback and token exchange
   - Display user's Discord profile (username, avatar) in Spell Coven UI

2. **Token Management**
   - Store Discord access tokens in localStorage with automatic refresh
   - Use short-lived access tokens (1-2 hours) with refresh token flow
   - Clear tokens on explicit logout
   - Implement strict Content Security Policy to mitigate XSS risks
   - Handle token expiration gracefully with automatic refresh

3. **Discord Gateway WebSocket Connection**
   - Establish WebSocket connection to Discord Gateway from browser
   - Implement heartbeat mechanism for connection keep-alive
   - Handle reconnection logic with exponential backoff
   - Display connection status in UI (connected/disconnecting/reconnecting)
   - Receive and parse Discord Gateway events

4. **User Presence**
   - Display user's Discord online status
   - Show user's current Discord servers/guilds
   - Handle presence updates in real-time

**Technical Requirements**:
- Create `@repo/discord-integration` package for Discord API client
- Use `discord-api-types` for TypeScript types
- Implement WebSocket connection manager with reconnection logic
- Create React hooks: `useDiscordAuth()`, `useDiscordConnection()`, `useDiscordUser()`
- Build UI components: DiscordLoginButton, DiscordUserProfile, ConnectionStatus

**Success Criteria**:
- Users can authenticate via Discord OAuth2 within 10 seconds
- WebSocket connection establishes within 5 seconds of authentication
- Connection automatically reconnects within 30 seconds of network failure
- Token refresh happens automatically without user intervention
- Connection status is clearly visible to users

**Edge Cases**:
- User denies OAuth permissions
- Network failures during authentication
- Token refresh fails (requires re-authentication)
- Discord API rate limits during connection
- User revokes app permissions from Discord settings

**Constitutional Alignment**:
- ✓ Browser-First: All OAuth and WebSocket connections run client-side
- ✓ User-Centric: Familiar Discord login, clear connection status
- ✓ Data Contracts: Define token storage schema and Gateway event types

---

## Phase 2: Discord Text Chat Integration

### Feature Description for `/speckit.specify`

**Feature Name**: Discord Text Channel Messaging

**User Value**: MTG players can send and receive text messages through Discord channels directly from the Spell Coven interface, enabling game coordination, card discussions, and social interaction without switching between applications.

**Core Capabilities**:

1. **Channel Selection**
   - Display list of user's accessible Discord text channels
   - Filter channels by server/guild
   - Allow users to select active channel for game session
   - Show channel name and server context in UI

2. **Message Display**
   - Receive real-time messages from selected Discord channel via Gateway
   - Display messages in Spell Coven chat UI with Discord formatting
   - Show message author (username, avatar, role colors)
   - Support Discord markdown (bold, italic, code blocks)
   - Display timestamps in user's local timezone
   - Handle message edits and deletions

3. **Message Sending**
   - Send text messages to Discord channel from Spell Coven UI
   - Support basic Discord markdown formatting
   - Handle Discord rate limits with message queuing
   - Show message send status (sending/sent/failed)
   - Retry failed messages with user confirmation

4. **Rich Embeds for Game Events**
   - Send card lookup results as Discord embeds (card image, name, mana cost, oracle text)
   - Broadcast game state updates (life totals, turn changes) as formatted messages
   - Support custom embed colors and formatting for different event types

**Technical Requirements**:
- Extend `@repo/discord-integration` with message handling
- Implement Discord REST API client for sending messages
- Create React hooks: `useDiscordChannel()`, `useDiscordMessages()`, `useSendMessage()`
- Build UI components: ChannelSelector, MessageList, MessageInput, MessageEmbed
- Define message schema for game events with version field
- Implement rate limit handling with exponential backoff

**Success Criteria**:
- Messages appear in Spell Coven UI within 1 second of being sent in Discord
- Messages sent from Spell Coven appear in Discord within 2 seconds
- Rate limits are handled gracefully without message loss
- Card lookup embeds display correctly in both Spell Coven and Discord
- Users can switch between channels without losing message history

**Edge Cases**:
- User lacks permission to send messages in selected channel
- Discord API rate limits exceeded (queue and retry)
- Message content violates Discord's content policy
- Channel is deleted while user is viewing it
- Large message history (pagination and lazy loading)
- Emoji and custom Discord emotes rendering

**Dependencies**:
- Requires Phase 1 (authentication and Gateway connection)

**Constitutional Alignment**:
- ✓ Browser-First: All message operations via client-side REST API calls
- ✓ Data Contracts: Versioned schema for game event embeds
- ✓ User-Centric: Real-time messaging with clear send status

---

## Phase 3: Discord Voice Channel & Room Management

### Feature Description for `/speckit.specify`

**Feature Name**: Discord Voice Channel Integration and Game Room Coordination

**User Value**: MTG players can create and join game sessions mapped to Discord voice channels, with automatic room setup, player presence tracking, and voice communication infrastructure provided by Discord.

**Core Capabilities**:

1. **Voice Channel Selection**
   - Display list of user's accessible Discord voice channels
   - Show current voice channel occupancy (who's in the channel)
   - Allow users to join/leave voice channels from Spell Coven UI
   - Display voice connection status (connecting/connected/disconnected)

2. **Game Room Creation**
   - Create new Discord voice channel for game session
   - Create paired text channel for game coordination
   - Set channel permissions (private/invite-only or public)
   - Store game metadata in channel topic (format, power level, player count)
   - Generate shareable invite link for game session

3. **Room Metadata Management**
   - Define JSON schema for game room metadata (version, format, power level, max players)
   - Store metadata in Discord channel topic or pinned message
   - Sync metadata updates to Discord in real-time
   - Validate metadata on room join
   - Display room metadata in Spell Coven UI

4. **Player Presence Tracking**
   - Track which players are in voice channel
   - Display player list with Discord avatars and usernames
   - Show voice state (muted, deafened, speaking)
   - Handle players joining/leaving during game
   - Support spectator mode (in text channel but not voice)

5. **Room Lifecycle Management**
   - Implement room states: lobby → in-game → completed
   - Handle room cleanup after game completion
   - Archive game history to text channel (optional)
   - Delete temporary channels or mark as archived

**Technical Requirements**:
- Extend `@repo/discord-integration` with voice channel management
- Implement Discord Voice State tracking via Gateway events
- Create React hooks: `useDiscordVoiceChannel()`, `useGameRoom()`, `useRoomMetadata()`
- Build UI components: VoiceChannelSelector, RoomCreator, PlayerList, RoomMetadata
- Define room metadata schema with semantic versioning
- Implement channel creation/deletion via Discord REST API

**Success Criteria**:
- Users can create game room with Discord voice channel in <15 seconds
- Room metadata syncs to Discord within 2 seconds of updates
- Player presence updates appear in UI within 3 seconds
- Invite links work correctly for both Discord and Spell Coven
- Room cleanup completes within 10 seconds of game end

**Edge Cases**:
- User lacks permission to create channels in server
- Voice channel reaches Discord's capacity limit
- Metadata exceeds Discord channel topic character limit (1024 chars)
- Room creator leaves before game starts
- Network failure during room creation
- Multiple users try to create room simultaneously

**Dependencies**:
- Requires Phase 1 (authentication and Gateway connection)
- Requires Phase 2 (text chat for game coordination)

**Constitutional Alignment**:
- ✓ Browser-First: Channel management via client-side REST API
- ✓ Data Contracts: Versioned room metadata schema with validation
- ✓ User-Centric: Simple room creation with clear player presence

---

## Phase 4: Discord Video Streaming Integration

### Feature Description for `/speckit.specify`

**Feature Name**: Discord Video Streaming for Webcam Feeds

**User Value**: MTG players can stream their overhead webcam views of playmats through Discord's video infrastructure, enabling remote opponents to see their physical cards in real-time without requiring custom WebRTC servers.

**Core Capabilities**:

1. **Discord RTC Connection**
   - Establish Discord RTC (Real-Time Communication) connection for video
   - Use Discord's voice/video WebSocket protocol
   - Handle RTC connection lifecycle (connect/disconnect/reconnect)
   - Display video connection status in UI

2. **Webcam Stream Setup**
   - Enumerate available webcam devices
   - Allow user to select camera for streaming
   - Configure video quality settings (resolution, framerate, bitrate)
   - Preview local webcam feed before streaming
   - Start/stop video stream to Discord voice channel

3. **Multi-Stream Reception**
   - Receive video streams from other players in voice channel
   - Display 2-4 simultaneous video feeds in grid layout
   - Support different view modes (grid, spotlight, focus on active player)
   - Handle stream quality adaptation based on bandwidth
   - Show player name overlay on each video feed

4. **Stream Quality Management**
   - Adapt video quality based on network conditions
   - Support Discord's video quality tiers (720p for Nitro users, 480p standard)
   - Display bandwidth usage and stream health metrics
   - Allow manual quality adjustment
   - Handle graceful degradation on poor connections

5. **Integration with Card Recognition**
   - Capture frames from Discord video stream for card recognition
   - Run CLIP model on received video feeds (not just local camera)
   - Display card identification results for all players' cameras
   - Optimize frame capture rate to balance recognition speed and performance

**Technical Requirements**:
- Extend `@repo/discord-integration` with RTC connection handling
- Implement Discord Voice/Video protocol (UDP + WebSocket)
- Use WebRTC MediaStream API for camera access
- Create React hooks: `useDiscordVideo()`, `useVideoStream()`, `useRemoteStreams()`
- Build UI components: CameraSelector, VideoGrid, StreamControls, QualityIndicator
- Integrate with existing card recognition pipeline
- Handle video codec negotiation (VP8/VP9/H.264)

**Success Criteria**:
- Video stream starts within 10 seconds of user clicking "Start Video"
- Stream latency <200ms under normal network conditions
- Support 2-4 simultaneous 720p streams without frame drops
- Card recognition works on remote video feeds with >80% accuracy
- Automatic quality adaptation maintains smooth playback on varying bandwidth
- Video streams survive network interruptions with auto-reconnect

**Edge Cases**:
- User's camera is already in use by another application
- Browser denies camera permissions
- Discord voice channel doesn't support video (server boost level)
- Network bandwidth insufficient for multiple video streams
- Discord RTC connection fails (fallback to voice-only)
- Video codec not supported by browser
- Stream quality too low for card recognition

**Technical Challenges**:
- Discord's RTC protocol is not fully documented (may require reverse engineering)
- Discord.js library may not support video streaming from browser
- Alternative: Use Discord's "Go Live" screen share feature instead of camera
- Fallback: Implement custom WebRTC if Discord video proves infeasible

**Dependencies**:
- Requires Phase 1 (authentication and Gateway connection)
- Requires Phase 3 (voice channel and room management)
- Integrates with existing card recognition system (Phase 1 of main app)

**Constitutional Alignment**:
- ✓ Browser-First: RTC connections established client-side
- ⚠ Complexity: Discord video protocol may require significant reverse engineering
- ✓ User-Centric: Leverages Discord's proven video infrastructure
- ⚠ Privacy: Requires internet connectivity; not fully offline-capable

**Risk Assessment**:
- **HIGH RISK**: Discord's video streaming protocol may not be accessible from browser JavaScript
- **Mitigation**: Research Discord.js capabilities and Discord Gateway documentation before committing to this phase
- **Fallback Plan**: Implement custom WebRTC peer-to-peer video as originally planned in Phase 2 roadmap

---

## Implementation Order Recommendation

1. **Phase 1** (1-2 weeks): Foundation for all Discord features
2. **Phase 2** (1 week): Immediate user value with text chat
3. **Phase 3** (1-2 weeks): Game room coordination and voice
4. **Phase 4** (2-3 weeks): Video streaming - **Research feasibility first**

**Note**: Phase 4 has significant technical risk. Consider implementing custom WebRTC as a parallel track or fallback option.

---

## Cross-Phase Considerations

### Package Structure
- `@repo/discord-integration`: Core Discord API client, WebSocket manager, REST client
- `apps/web`: UI components and React hooks for Discord features
- Shared types in `@repo/discord-integration/types`

### Data Contracts
- **Discord Token Schema**: `{ accessToken: string, refreshToken: string, expiresAt: number, version: "1.0" }`
- **Room Metadata Schema**: `{ version: "1.0", format: string, powerLevel: number, maxPlayers: number, createdAt: string }`
- **Game Event Schema**: `{ version: "1.0", type: string, data: object, timestamp: string }`

### Testing Strategy
- Unit tests for Discord API client and WebSocket manager
- Integration tests with Discord's staging environment (if available)
- Manual testing with real Discord accounts and servers
- Load testing for rate limit handling

### Security Considerations
- Implement Content Security Policy headers
- Validate all Discord API responses
- Sanitize user input before sending to Discord
- Handle Discord rate limits to avoid account suspension
- Document Discord's data retention and privacy policies for users

### Self-Hosting Option
- Users can create their own Discord bot and application
- Provide configuration UI for custom Discord app credentials
- Document Discord Developer Portal setup process
- Maintain fallback to custom WebRTC for users who prefer not to use Discord
