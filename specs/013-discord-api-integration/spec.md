# Feature Specification: Discord API Integration for Remote MTG Play

**Feature Branch**: `013-discord-api-integration`  
**Created**: 2025-10-21  
**Status**: Draft  
**Input**: User description: "Discord API Integration for Remote MTG Play - OAuth2 authentication, text chat, voice channels, and video streaming using Discord as communication backend"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discord Authentication Gate (Priority: P1)

A Magic: The Gathering player visits Spell Coven to play remotely with friends. They click "Create Game" and are prompted to authenticate with Discord. After connecting their Discord account, they see their Discord profile in the header and can proceed to create or join games.

**Why this priority**: Authentication is the foundation for all Discord integration features. Without it, no communication features can work. This delivers immediate value by establishing user identity and enabling access to Discord's infrastructure.

**Independent Test**: Can be fully tested by attempting to create a game, completing Discord OAuth flow, and verifying the user's Discord profile appears in the UI. Delivers the value of secure user authentication and visual confirmation of connection.

**Acceptance Scenarios**:

1. **Given** user is not authenticated, **When** they click "Create Game", **Then** a modal appears explaining Discord is required with a "Connect with Discord" button
2. **Given** user clicks "Connect with Discord", **When** they complete Discord OAuth authorization, **Then** they are redirected back to Spell Coven with their Discord profile visible in the header
3. **Given** user is authenticated, **When** they click "Create Game" or "Join Game", **Then** they proceed directly without seeing the auth modal
4. **Given** user denies Discord permissions, **When** OAuth flow completes, **Then** an error message appears with option to retry
5. **Given** user's access token expires, **When** they perform an action requiring authentication, **Then** the token refreshes automatically without user intervention

---

### User Story 2 - Real-Time Connection Status (Priority: P2)

After authenticating, the player sees a connection status indicator showing they are connected to Discord's real-time messaging infrastructure. If their network drops, they see a "Reconnecting..." status, and when connection restores, they see "Connected" again.

**Why this priority**: Connection status provides transparency and confidence that the communication layer is working. This prevents confusion when messages or video might not be working due to connection issues.

**Independent Test**: Can be tested by authenticating, observing the connection indicator, simulating network interruption (throttling), and verifying reconnection behavior. Delivers value of connection transparency.

**Acceptance Scenarios**:

1. **Given** user completes authentication, **When** WebSocket connection establishes, **Then** connection status shows "Connected" within 5 seconds
2. **Given** user has active connection, **When** network is interrupted, **Then** status changes to "Reconnecting..." and attempts reconnection with exponential backoff
3. **Given** connection is lost, **When** network restores, **Then** connection re-establishes within 30 seconds and status shows "Connected"
4. **Given** connection fails after multiple retries, **When** maximum retry attempts reached, **Then** user sees error message with manual retry button

---

### User Story 3 - Discord Text Chat Integration (Priority: P3)

During a game, players can send and receive text messages through Discord channels directly from the Spell Coven interface. They select a Discord text channel, see message history, and can send messages that appear in both Spell Coven and Discord.

**Why this priority**: Text chat enables game coordination, card discussions, and social interaction without switching applications. This is the first communication feature that provides tangible gameplay value.

**Independent Test**: Can be tested by authenticating, selecting a Discord channel, sending messages from Spell Coven, and verifying they appear in Discord and vice versa. Delivers value of integrated communication.

**Acceptance Scenarios**:

1. **Given** user is authenticated, **When** they open channel selector, **Then** they see a list of accessible Discord text channels grouped by server
2. **Given** user selects a channel, **When** channel loads, **Then** recent message history appears within 2 seconds
3. **Given** user types a message, **When** they press send, **Then** message appears in Spell Coven within 1 second and in Discord within 2 seconds
4. **Given** another user sends a message in Discord, **When** message is received, **Then** it appears in Spell Coven chat within 1 second
5. **Given** user sends messages rapidly, **When** Discord rate limit is approached, **Then** messages are queued and sent automatically without loss
6. **Given** user lacks permission to send in channel, **When** they attempt to send, **Then** clear error message explains permission issue

---

### User Story 4 - Game Event Embeds (Priority: P4)

When a player looks up a card or a significant game event occurs (life total change, turn change), the system sends a rich embed to the Discord channel with card images, formatted text, and color-coded information that appears in both Spell Coven and Discord.

**Why this priority**: Rich embeds enhance the gameplay experience by providing visual card references and game state updates in a professional format. This builds on text chat to create a more immersive experience.

**Independent Test**: Can be tested by triggering a card lookup or game event and verifying the embed appears correctly in both interfaces. Delivers value of enhanced game information sharing.

**Acceptance Scenarios**:

1. **Given** user performs card lookup, **When** card is identified, **Then** rich embed with card image, name, mana cost, and oracle text appears in chat
2. **Given** life total changes, **When** update is broadcast, **Then** formatted message with player name and new life total appears in channel
3. **Given** turn changes, **When** new turn begins, **Then** embed with turn number and active player appears in channel
4. **Given** embed is sent, **When** viewed in Discord mobile app, **Then** embed renders correctly with all formatting preserved

---

### User Story 5 - Voice Channel Selection and Room Creation (Priority: P5)

A player creates a new game session and selects an existing Discord voice channel or creates a new one. The system stores game metadata (format, power level, max players) in the channel topic and generates a shareable invite link. Other players can join the voice channel and see who else is present.

**Why this priority**: Voice channels provide the infrastructure for voice communication and serve as the organizational unit for game sessions. This enables players to coordinate who is in the game and provides voice chat capability.

**Independent Test**: Can be tested by creating a game, selecting or creating a voice channel, storing metadata, and verifying other users can join and see participant list. Delivers value of game room organization and voice communication.

**Acceptance Scenarios**:

1. **Given** user creates a game, **When** they select voice channel option, **Then** they see list of accessible voice channels with current occupancy
2. **Given** user creates new voice channel, **When** they provide game settings, **Then** channel is created with metadata in topic within 15 seconds
3. **Given** game room exists, **When** another player joins voice channel, **Then** their avatar and username appear in player list within 3 seconds
4. **Given** player is in voice channel, **When** they mute or deafen, **Then** their voice state indicator updates in real-time
5. **Given** user lacks permission to create channels, **When** they attempt to create, **Then** clear error message suggests using existing channel or contacting server admin

---

### User Story 6 - Video Streaming for Card Recognition (Priority: P6)

Players stream their overhead webcam views through Discord's video infrastructure. Each player sees 2-4 video feeds in a grid layout showing opponents' playmats. The card recognition system processes frames from these video streams to identify cards on all visible playmats.

**Why this priority**: Video streaming is the core value proposition of Spell Coven - enabling remote physical MTG play. This completes the integration by leveraging Discord's video infrastructure instead of custom WebRTC servers.

**Independent Test**: Can be tested by starting video stream, verifying it appears for other players, and confirming card recognition works on remote video feeds. Delivers value of complete remote play experience.

**Acceptance Scenarios**:

1. **Given** user is in voice channel, **When** they click "Start Video", **Then** their webcam stream begins within 10 seconds
2. **Given** user's video is streaming, **When** another player joins, **Then** they see the video feed within 5 seconds
3. **Given** multiple players are streaming, **When** viewing game, **Then** all video feeds display in grid layout without frame drops
4. **Given** network bandwidth decreases, **When** quality adaptation triggers, **Then** video quality adjusts automatically to maintain smooth playback
5. **Given** card is visible in video stream, **When** card recognition runs, **Then** card is identified with >80% accuracy
6. **Given** user's camera is in use by another app, **When** they attempt to start video, **Then** clear error message explains the conflict

---

### Edge Cases

- **What happens when user doesn't have a Discord account?** Modal displays message directing them to discord.com to create an account before they can use Spell Coven
- **What happens when user revokes app permissions from Discord settings?** Next API call fails with 401 error, system detects this and prompts user to re-authenticate
- **What happens when Discord API rate limits are exceeded?** Requests are queued with exponential backoff, user sees "Sending..." status, and messages/actions complete when rate limit window resets
- **What happens when selected Discord channel is deleted while user is viewing it?** System detects channel deletion via Gateway event, displays error message, and prompts user to select a different channel
- **What happens when voice channel reaches Discord's capacity limit?** User attempting to join sees error message indicating channel is full and suggesting they create a new channel or wait for space
- **What happens when metadata exceeds Discord channel topic character limit (1024 chars)?** System validates metadata size before sending, truncates if necessary with warning, or stores overflow in pinned message
- **What happens when room creator leaves before game starts?** Room ownership transfers to next player in channel, or room is marked as abandoned after timeout
- **What happens when network fails during room creation?** Creation request times out, user sees error message with retry button, partial resources are cleaned up
- **What happens when Discord's video protocol is not accessible from browser?** System falls back to displaying error message and suggests using Discord's native app for video, or implements custom WebRTC as fallback
- **What happens when user's browser denies camera permissions?** Clear error message explains camera access is required and provides instructions to enable permissions in browser settings
- **What happens when video codec is not supported by browser?** System detects codec incompatibility during negotiation and either falls back to supported codec or displays compatibility error

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication & Connection (Phase 1)

- **FR-001**: System MUST authenticate users via Discord OAuth2 with PKCE (Proof Key for Code Exchange) flow for secure client-side authentication
- **FR-002**: System MUST request OAuth2 scopes: `identify` (user profile), `guilds` (server list), `messages.read` (text chat), `rpc` (voice/video), `rpc.voice.read` (voice state)
- **FR-003**: System MUST intercept "Create Game" and "Join Game" actions to check authentication status before proceeding
- **FR-004**: System MUST display Discord authentication modal when unauthenticated user attempts to create or join game
- **FR-005**: System MUST handle OAuth callback at `/auth/discord/callback` route and exchange authorization code for access token
- **FR-006**: System MUST display user's Discord profile (username and avatar) in application header when authenticated
- **FR-007**: System MUST store access tokens and refresh tokens in browser localStorage with expiration timestamps
- **FR-008**: System MUST automatically refresh access tokens before expiration without user intervention
- **FR-009**: System MUST establish WebSocket connection to Discord Gateway within 5 seconds of authentication
- **FR-010**: System MUST implement heartbeat mechanism to maintain Gateway connection with configurable interval
- **FR-011**: System MUST handle Gateway disconnections with automatic reconnection using exponential backoff (max 30 seconds)
- **FR-012**: System MUST display connection status indicator showing states: connected, disconnecting, reconnecting, error
- **FR-013**: System MUST clear all stored tokens and disconnect Gateway on explicit user logout

#### Text Chat (Phase 2)

- **FR-014**: System MUST retrieve and display list of user's accessible Discord text channels grouped by server
- **FR-015**: System MUST allow users to select active Discord channel for game session
- **FR-016**: System MUST receive real-time messages from selected channel via Gateway WebSocket
- **FR-017**: System MUST display messages with author information (username, avatar, role colors) and timestamps in user's local timezone
- **FR-018**: System MUST support Discord markdown formatting (bold, italic, code blocks) in message display
- **FR-019**: System MUST handle message edits and deletions received via Gateway events
- **FR-020**: System MUST send text messages to Discord channel via REST API
- **FR-021**: System MUST implement rate limit handling with message queuing to prevent API throttling
- **FR-022**: System MUST display message send status (sending, sent, failed) to user
- **FR-023**: System MUST allow retry of failed messages with user confirmation
- **FR-024**: System MUST create rich embeds for card lookup results including card image, name, mana cost, and oracle text
- **FR-025**: System MUST broadcast game state updates (life totals, turn changes) as formatted Discord messages
- **FR-026**: System MUST support custom embed colors and formatting for different event types

#### Voice Channels & Room Management (Phase 3)

- **FR-027**: System MUST retrieve and display list of user's accessible Discord voice channels with current occupancy
- **FR-028**: System MUST allow users to join and leave voice channels from application interface
- **FR-029**: System MUST create new Discord voice channels for game sessions when user has appropriate permissions
- **FR-030**: System MUST create paired text channels alongside voice channels for game coordination
- **FR-031**: System MUST store game metadata (format, power level, max players, version) in channel topic or pinned message
- **FR-032**: System MUST validate game metadata against defined schema before storage
- **FR-033**: System MUST sync metadata updates to Discord in real-time (within 2 seconds)
- **FR-034**: System MUST generate shareable invite links for game sessions
- **FR-035**: System MUST track which players are in voice channel via Gateway VOICE_STATE_UPDATE events
- **FR-036**: System MUST display player list with Discord avatars, usernames, and voice state (muted, deafened, speaking)
- **FR-037**: System MUST handle players joining and leaving during game with real-time updates
- **FR-038**: System MUST support spectator mode (users in text channel but not voice channel)
- **FR-039**: System MUST implement room lifecycle states: lobby, in-game, completed
- **FR-040**: System MUST handle room cleanup after game completion (archive or delete channels)

#### Video Streaming (Phase 4)

- **FR-041**: System MUST establish Discord RTC (Real-Time Communication) connection for video streaming
- **FR-042**: System MUST enumerate available webcam devices and allow user to select camera
- **FR-043**: System MUST provide video quality settings (resolution, framerate, bitrate) configuration
- **FR-044**: System MUST display preview of local webcam feed before streaming begins
- **FR-045**: System MUST start and stop video stream to Discord voice channel on user command
- **FR-046**: System MUST receive video streams from other players in voice channel via RTC connection
- **FR-047**: System MUST display 2-4 simultaneous video feeds in grid layout
- **FR-048**: System MUST support different view modes (grid, spotlight, focus on active player)
- **FR-049**: System MUST adapt video quality based on network bandwidth conditions
- **FR-050**: System MUST support Discord's video quality tiers (720p for Nitro users, 480p standard)
- **FR-051**: System MUST display bandwidth usage and stream health metrics to user
- **FR-052**: System MUST allow manual quality adjustment by user
- **FR-053**: System MUST capture frames from Discord video streams for card recognition processing
- **FR-054**: System MUST run card recognition on received video feeds from all players
- **FR-055**: System MUST display card identification results for all visible playmats
- **FR-056**: System MUST optimize frame capture rate to balance recognition speed and performance

#### Security & Error Handling

- **FR-057**: System MUST implement Content Security Policy headers to mitigate XSS risks
- **FR-058**: System MUST validate all Discord API responses before processing
- **FR-059**: System MUST sanitize user input before sending to Discord API
- **FR-060**: System MUST handle OAuth authorization denial with clear error message and retry option
- **FR-061**: System MUST handle network failures during authentication with retry capability
- **FR-062**: System MUST detect token refresh failures and prompt re-authentication
- **FR-063**: System MUST detect when user revokes app permissions and prompt re-authentication
- **FR-064**: System MUST handle permission errors (e.g., cannot send messages, cannot create channels) with clear explanations
- **FR-065**: System MUST handle Discord API errors (rate limits, service outages) gracefully with user-friendly messages

### Key Entities

- **Discord Token**: Represents OAuth2 authentication credentials including access token (short-lived, 1-2 hours), refresh token (long-lived), expiration timestamp, token type, and granted scopes. Stored in browser localStorage with schema version for future evolution.

- **Discord User**: Represents authenticated user's Discord profile including unique user ID, username, discriminator, avatar URL, and account flags. Retrieved via Discord API after authentication.

- **Gateway Connection**: Represents WebSocket connection to Discord Gateway including connection state (connected, disconnecting, reconnecting, error), session ID, sequence number for event ordering, heartbeat interval, and last heartbeat timestamp.

- **Discord Channel**: Represents a text or voice channel including unique channel ID, channel name, channel type (text, voice, category), parent server/guild ID, user permissions in channel, and current occupancy for voice channels.

- **Game Room**: Represents a game session mapped to Discord voice channel including room ID (maps to Discord channel ID), game metadata (format, power level, max players), room state (lobby, in-game, completed), creation timestamp, and list of participant Discord user IDs.

- **Room Metadata**: Structured data stored in Discord channel topic or pinned message including schema version (for evolution), game format (Commander, Standard, etc.), power level (1-10 scale), maximum player count, creation timestamp, and optional custom settings.

- **Discord Message**: Represents a text message in Discord channel including unique message ID, author user ID, message content with markdown, timestamp, edit timestamp (if edited), embeds (rich content), and message type (default, reply, system).

- **Game Event Embed**: Rich embed message for game events including embed type (card lookup, life total change, turn change), embed color (color-coded by event type), card data (for card lookups), game state data (for state updates), and timestamp.

- **Voice State**: Represents user's state in voice channel including user ID, channel ID, muted status (self-mute and server-mute), deafened status (self-deafen and server-deafen), speaking indicator, and video streaming status.

- **Video Stream**: Represents video feed from player's webcam including stream ID, source user ID, video resolution, framerate, bitrate, codec information, and stream health metrics (packet loss, latency).

- **RTC Connection**: Represents Discord Real-Time Communication connection for video/voice including connection state, UDP endpoint information, encryption key, supported codecs, and quality adaptation settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

#### Authentication & Onboarding

- **SC-001**: Users can complete Discord OAuth authentication flow in under 10 seconds from clicking "Connect with Discord" to seeing their profile in the header
- **SC-002**: 95% of authentication attempts succeed on first try without errors
- **SC-003**: Token refresh happens automatically without user awareness or interruption in 100% of cases where token is still valid

#### Connection Reliability

- **SC-004**: WebSocket Gateway connection establishes within 5 seconds of authentication completion
- **SC-005**: Connection automatically reconnects within 30 seconds of network failure in 95% of cases
- **SC-006**: Connection remains stable for entire game session (2+ hours) without manual reconnection in 90% of sessions

#### Text Chat Performance

- **SC-007**: Messages sent from Spell Coven appear in Discord within 2 seconds
- **SC-008**: Messages sent from Discord appear in Spell Coven within 1 second
- **SC-009**: System handles Discord rate limits without message loss in 100% of cases
- **SC-010**: Card lookup embeds display correctly in both Spell Coven and Discord in 100% of cases

#### Room Management

- **SC-011**: Users can create game room with Discord voice channel in under 15 seconds
- **SC-012**: Room metadata syncs to Discord within 2 seconds of updates
- **SC-013**: Player presence updates (join/leave/voice state changes) appear in UI within 3 seconds
- **SC-014**: Invite links work correctly for both Discord and Spell Coven in 100% of cases

#### Video Streaming

- **SC-015**: Video stream starts within 10 seconds of user clicking "Start Video"
- **SC-016**: Stream latency remains under 200ms under normal network conditions (>5 Mbps, <50ms ping)
- **SC-017**: System supports 2-4 simultaneous 720p video streams without frame drops on modern hardware
- **SC-018**: Card recognition achieves >80% accuracy on remote video feeds with adequate lighting and camera positioning
- **SC-019**: Automatic quality adaptation maintains smooth playback (>24 fps) across varying bandwidth conditions

#### User Experience

- **SC-020**: 90% of users successfully complete their first game session without technical support
- **SC-021**: Connection status is clearly visible and understood by users (verified through user testing)
- **SC-022**: Error messages provide clear actionable guidance in 100% of failure scenarios
- **SC-023**: Users can switch between Discord channels without losing message history or connection state

#### System Reliability

- **SC-024**: System handles Discord API rate limits gracefully without user-visible errors in 100% of cases
- **SC-025**: System recovers from network interruptions without data loss in 95% of cases
- **SC-026**: System detects and handles permission errors with clear user guidance in 100% of cases
