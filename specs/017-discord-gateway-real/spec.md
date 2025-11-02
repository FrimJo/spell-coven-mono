# Feature Specification: Discord Gateway Real-Time Event System

**Feature Branch**: `017-discord-gateway-real`  
**Created**: 2025-01-02  
**Status**: Draft  
**Input**: User description: "Discord Gateway Real-time Event System"

## Clarifications

### Session 2025-01-02

- Q: What is the expiry duration for invite tokens? → A: 24 hours
- Q: What is the maximum number of players per game room? → A: 4 players
- Q: When should abandoned rooms be automatically cleaned up? → A: After 1 hour of inactivity
- Q: How should the system handle session expiry while user is in a game room? → A: Silent refresh attempt, fallback to login redirect
- Q: How should the system handle Discord API rate limits during high-traffic periods? → A: Queue requests with exponential backoff retry

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Real-Time Voice Channel Monitoring (Priority: P1)

As a game room participant, I need to see when other players join or leave the Discord voice channel in real-time, so I know who is currently available to play with me.

**Why this priority**: Core functionality that enables the multiplayer experience. Without real-time voice channel monitoring, users cannot see who is in their game room, making coordination impossible.

**Independent Test**: Can be fully tested by having multiple users join/leave a Discord voice channel and verifying the player list updates instantly (within 300ms) without page refresh. Delivers immediate value by showing live presence.

**Acceptance Scenarios**:

1. **Given** a user is viewing a game room, **When** another player joins the Discord voice channel, **Then** the new player appears in the player list within 300ms
2. **Given** multiple players are in a voice channel, **When** one player leaves, **Then** that player is removed from the player list within 300ms
3. **Given** a user's connection drops, **When** they reconnect to the game room, **Then** they see the current list of players in the voice channel
4. **Given** a user is disconnected from voice, **When** the disconnect is detected, **Then** a modal appears prompting them to rejoin

---

### User Story 2 - Automatic Voice Channel Connection (Priority: P1)

As a game room creator or invited player, I want to be automatically connected to the voice channel when I join the game room, so I don't have to manually find and join the Discord channel.

**Why this priority**: Critical for user experience. Manual voice channel joining creates friction and confusion, especially for new users unfamiliar with Discord.

**Independent Test**: Can be tested by creating a game room or joining via invite link, then verifying the user is automatically placed in the Discord voice channel without manual action. Delivers immediate value by removing setup friction.

**Acceptance Scenarios**:

1. **Given** a user creates a new game room, **When** the room is created, **Then** the user is automatically connected to the private voice channel
2. **Given** a user receives an invite link, **When** they click the link and authenticate, **Then** they are automatically connected to the game's voice channel
3. **Given** a user joins a game room, **When** the connection attempt fails, **Then** an error message is displayed with retry options
4. **Given** a user is already in another voice channel, **When** they join a game room, **Then** they are moved to the new game's voice channel

---

### User Story 3 - Persistent Gateway Connection (Priority: P2)

As a system operator, I need the Discord Gateway connection to remain stable and automatically recover from disconnections, so users experience uninterrupted real-time updates.

**Why this priority**: Essential for reliability but operates in the background. Users don't directly interact with this, but it ensures the P1 features work consistently.

**Independent Test**: Can be tested by simulating Discord Gateway disconnections and verifying automatic reconnection with exponential backoff, maintaining event delivery within SLA. Delivers value by ensuring system reliability.

**Acceptance Scenarios**:

1. **Given** the Discord Gateway connection is active, **When** Discord disconnects the connection, **Then** the system automatically attempts to reconnect with exponential backoff
2. **Given** a reconnection attempt fails, **When** the retry limit is not exceeded, **Then** the system waits and retries with increasing delay
3. **Given** the Gateway reconnects, **When** session resumption is possible, **Then** no events are lost during the reconnection
4. **Given** multiple reconnection attempts fail, **When** the maximum retry limit is reached, **Then** an alert is logged and operators are notified

---

### User Story 4 - Room Creation and Management (Priority: P2)

As a game room creator, I want to create a private voice channel with role-based access control, so only invited players can join my game.

**Why this priority**: Important for privacy and game organization, but secondary to the core real-time monitoring functionality.

**Independent Test**: Can be tested by creating a game room, verifying a private Discord voice channel is created with appropriate permissions, and confirming only users with the invite token can access it. Delivers value by enabling private games.

**Acceptance Scenarios**:

1. **Given** a user wants to create a game, **When** they click "Create Game", **Then** a private Discord voice channel is created with a unique role
2. **Given** a game room is created, **When** the creator shares the invite link, **Then** invited users can join the voice channel using the token
3. **Given** a user without an invite token, **When** they try to access the voice channel, **Then** they are denied access
4. **Given** a game room is no longer needed, **When** the room is closed, **Then** the Discord voice channel and role are deleted

---

### User Story 5 - Event Broadcasting to Multiple Users (Priority: P3)

As a game participant, I want to receive real-time updates about voice channel changes even when multiple users are connected, so everyone sees the same synchronized state.

**Why this priority**: Enhances the multiplayer experience but is less critical than basic monitoring. The system can function with delayed updates if needed.

**Independent Test**: Can be tested by having 10+ users connected to the same game room and verifying all users receive voice channel events within 300ms. Delivers value by ensuring consistent state across all clients.

**Acceptance Scenarios**:

1. **Given** 10 users are viewing the same game room, **When** a player joins the voice channel, **Then** all 10 users see the update within 300ms
2. **Given** multiple events occur rapidly, **When** events are broadcast, **Then** all users receive events in the correct order
3. **Given** a user has a slow connection, **When** events are broadcast, **Then** the slow user's connection does not block other users
4. **Given** a user's connection is lost, **When** they reconnect, **Then** they receive the current state without affecting other users

---

### Edge Cases

- What happens when a user is removed from the Discord voice channel by a moderator?
- How does the system handle Discord API rate limits during high-traffic periods?
- What happens when a user's session expires while they're in a game room?
- How does the system handle concurrent room creation requests from the same user?
- What happens when the Discord Gateway connection is lost for an extended period (>5 minutes)?
- How does the system handle users who join the voice channel directly via Discord (not through the web app)?
- What happens when a user's authentication token expires during an active game session?
- How does the system handle voice channel events for users who are not authenticated?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST receive Discord voice state update events in real-time when users join or leave voice channels
- **FR-002**: System MUST broadcast voice channel events to all authenticated users viewing the same game room within 300ms (p95)
- **FR-003**: System MUST automatically connect users to the appropriate Discord voice channel when they join a game room
- **FR-004**: System MUST maintain a persistent WebSocket connection to Discord Gateway with automatic reconnection on failure
- **FR-005**: System MUST authenticate users via Discord OAuth2 before granting access to game rooms
- **FR-006**: System MUST create private Discord voice channels with role-based access control for each game room (maximum 4 players per room)
- **FR-007**: System MUST generate secure invite tokens with 24-hour expiry that grant access to specific game rooms
- **FR-008**: System MUST verify user permissions before allowing access to voice channel events
- **FR-009**: System MUST detect when a user is disconnected from a voice channel and notify them via modal dialog
- **FR-010**: System MUST clean up Discord voice channels and roles when game rooms are closed or after 1 hour of inactivity (all users disconnected)
- **FR-011**: System MUST handle Discord Gateway disconnections with exponential backoff reconnection (1s → 2s → 4s → 8s → 16s)
- **FR-012**: System MUST attempt session resumption when reconnecting to Discord Gateway to avoid missing events
- **FR-013**: System MUST log all Discord events, connection state changes, and errors with structured logging
- **FR-014**: System MUST validate all user inputs using schema validation before processing
- **FR-015**: System MUST prevent unauthorized access to voice channel events by verifying session cookies
- **FR-016**: System MUST attempt silent session refresh when session expires, falling back to login redirect with return URL if refresh fails
- **FR-017**: System MUST queue Discord API requests with exponential backoff retry when rate limits are encountered

### Key Entities

- **Voice Channel Event**: Represents a change in voice channel state (user joined, user left, channel created, channel deleted), includes guild ID, channel ID, user ID, username, avatar, and timestamp
- **Game Room**: Represents a private gaming session with an associated Discord voice channel (max 4 players), role, list of participants, and inactivity timer for automatic cleanup
- **User Session**: Represents an authenticated user's connection to the web application, includes Discord user ID, OAuth tokens, and session expiry
- **Discord Gateway Connection**: Represents the persistent WebSocket connection to Discord's Gateway API, tracks connection state, heartbeat, and session ID
- **Invite Token**: Represents a time-limited (24-hour expiry), cryptographically signed token that grants access to a specific game room, includes room ID, role ID, and expiry timestamp
- **WebSocket Connection**: Represents a browser client's WebSocket connection to the server, includes user ID, guild ID, and authentication status

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Voice channel events are delivered to browser clients within 300ms (p95) of the Discord event occurring
- **SC-002**: Discord Gateway connection maintains 99.9% monthly uptime with automatic recovery from disconnections
- **SC-003**: System handles at least 100 concurrent WebSocket connections without performance degradation
- **SC-004**: System processes at least 100 voice channel events per second during peak usage
- **SC-005**: Users are automatically connected to voice channels within 2 seconds of joining a game room
- **SC-006**: 95% of users successfully join game rooms on their first attempt without errors
- **SC-007**: Voice channel member lists are synchronized across all connected clients with no more than 500ms variance
- **SC-008**: System recovers from Discord Gateway disconnections within 30 seconds without manual intervention
- **SC-009**: Zero Discord bot tokens or secrets are exposed to browser clients (verified via security audit)
- **SC-010**: All voice channel events are logged with structured data for debugging and analytics
