# Feature Specification: WebRTC Video Streaming Between Players

**Feature Branch**: `001-webrtc-video-streaming`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "Add web cam streaming between players in game room using web RTC (RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, iceServers, stun:stun.l.google.com:19302 and MediaStream). Important that it uses Separation of Concerns (SoC) pattern and not rely directly on discord integrations. Discord might be swapped out for other service to manage rooms and users at a later state. Each players web cam is to be rendered in the grid of game room"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Establish Video Connection with Other Players (Priority: P1)

When a player joins a game room, their webcam stream should automatically connect and be visible to all other players in the room. Similarly, when other players join, their webcam streams should appear in the player's view.

**Why this priority**: Core functionality - without video connections, the feature provides no value. This is the foundational user experience that enables remote play.

**Independent Test**: Can be fully tested by having two players join the same game room and verifying that each player sees the other's webcam feed in their respective video grid. This delivers immediate value: players can see each other's physical game setup.

**Acceptance Scenarios**:

1. **Given** a player has joined a game room and enabled their webcam, **When** another player joins the same room, **Then** both players see each other's webcam streams in their video grid
2. **Given** a player is in a game room with active video connections, **When** they refresh the page, **Then** their webcam stream reconnects and appears to other players within 5 seconds
3. **Given** a player joins a room with 3 other players already connected, **When** they enable their webcam, **Then** all 3 existing players see the new player's stream, and the new player sees all 3 existing players' streams

---

### User Story 2 - Handle Connection Failures and Reconnections (Priority: P2)

The system should gracefully handle network interruptions, peer disconnections, and connection failures. Players should be notified of connection issues and streams should automatically attempt to reconnect.

**Why this priority**: Network reliability is critical for real-time video. Users need clear feedback when connections fail and automatic recovery when possible. Without this, temporary network issues would cause permanent disconnections.

**Independent Test**: Can be fully tested by simulating network conditions (disabling network adapter, changing WiFi networks) and verifying that connections recover automatically and users see appropriate status indicators. This delivers value by maintaining stable video communication despite network fluctuations.

**Acceptance Scenarios**:

1. **Given** two players have active video connections, **When** one player's network connection drops temporarily, **Then** the other player sees a "reconnecting" indicator and the stream automatically resumes when connectivity is restored
2. **Given** a player's peer connection fails due to NAT traversal issues, **When** the system detects the failure, **Then** the player sees a clear error message explaining the connection issue
3. **Given** a player loses connection to the signaling service, **When** connectivity is restored, **Then** all peer connections are automatically re-established without requiring user action

---

### User Story 3 - Control Video and Audio Streams (Priority: P2)

Players should be able to mute/unmute their audio and enable/disable their video feed independently. These changes should be reflected in real-time for all other players in the room.

**Why this priority**: Privacy and control are essential - players need to manage their audio/video based on their environment. This matches standard video conferencing expectations and is critical for user comfort.

**Independent Test**: Can be fully tested by a single player toggling their audio/video controls and verifying that other players see the state changes immediately in their UI. This delivers value by giving players control over their participation and privacy.

**Acceptance Scenarios**:

1. **Given** a player has their video enabled, **When** they disable their video feed, **Then** other players see a "video off" indicator in that player's grid slot
2. **Given** a player has their audio enabled, **When** they mute their microphone, **Then** other players see a muted audio indicator for that player
3. **Given** a player's video is disabled, **When** they re-enable it, **Then** their webcam stream resumes and appears to other players within 2 seconds

---

### User Story 4 - View All Players in Grid Layout (Priority: P1)

Each player's webcam stream should be displayed in a grid layout within the game room, with clear visual indicators showing which player is which, connection status, and audio/video state.

**Why this priority**: Visual organization is essential for multi-player games. Players need to quickly identify who is who and see all participants at once. This is the core UI requirement that makes the feature usable.

**Independent Test**: Can be fully tested by joining a room with multiple players and verifying that all streams are displayed in a properly organized grid with player names and status indicators. This delivers value by providing clear visual organization of all participants.

**Acceptance Scenarios**:

1. **Given** 4 players are in a game room with active video streams, **When** viewing the game room, **Then** all 4 webcam feeds are displayed in a grid layout with each player's name clearly visible
2. **Given** a player's video connection is active, **When** viewing their stream in the grid, **Then** the stream displays smoothly without visible stuttering or freezes
3. **Given** a player joins a room, **When** their stream appears in the grid, **Then** it occupies the appropriate grid position based on player order

---

### Edge Cases

- What happens when a player joins a room but their browser doesn't support WebRTC or media devices? → System allows entry, shows "WebRTC not supported" status, game continues without video from that player
- How does the system handle a player who denies camera/microphone permissions? → System allows entry, shows "camera unavailable" or "microphone unavailable" status indicator, provides retry button for permissions, game continues without video/audio from that player
- What happens when two players try to establish a connection simultaneously (signaling race condition)? → WebRTC protocol handles simultaneous offers/answers. No special handling needed - both players can initiate connections, WebRTC resolves conflicts automatically
- How does the system handle a player leaving the room while others are still connected?
- What happens when ICE candidates fail and NAT traversal cannot be established? → After 30 seconds of failed attempts, show "connection failed" error with retry button, game continues without video from that peer
- How does the system handle a player with multiple camera devices switching between them? → Replace video tracks in existing peer connections using replaceTrack API. Connection maintained, stream updates seamlessly without renegotiation
- What happens when the signaling service is temporarily unavailable but peer connections are still active?
- How does the system handle rooms with more than 4 players (grid layout constraints)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST establish peer-to-peer WebRTC connections between all players in a game room
- **FR-002**: System MUST use a signaling mechanism to exchange WebRTC offer/answer and ICE candidates between peers (implemented via TanStack Start: clients send via createServerFn, backend routes via SSE to target players)
- **FR-003**: System MUST not depend on Discord-specific APIs for WebRTC signaling or peer connection management
- **FR-004**: System MUST use STUN server (stun:stun.l.google.com:19302) for NAT traversal
- **FR-005**: System MUST request camera and microphone permissions from players before starting video streams
- **FR-017**: System MUST handle permission denials gracefully: allow players to enter game room, display clear "camera unavailable" or "microphone unavailable" status indicators, and provide retry button to request permissions again
- **FR-006**: System MUST display each player's webcam stream in the game room grid layout
- **FR-007**: System MUST provide controls for players to enable/disable their video feed (MUST reuse existing video toggle button in VideoStreamGrid component which handles starting/stopping webcam)
- **FR-008**: System MUST provide controls for players to mute/unmute their audio feed (MUST reuse existing audio mute/unmute button in VideoStreamGrid component)
- **FR-009**: System MUST show connection status indicators (connected, connecting, disconnected, failed) for each player's stream (MUST integrate with existing status indicator UI patterns in VideoStreamGrid)
- **FR-010**: System MUST automatically attempt to reconnect peer connections when they fail
- **FR-018**: System MUST handle ICE candidate failures: after 30 seconds of failed connection attempts, show "connection failed" error message with retry button, allow game to continue without video from that peer
- **FR-011**: System MUST handle player disconnections gracefully, removing their stream from the grid when they leave
- **FR-012**: System MUST support rooms with up to 4 players simultaneously streaming video
- **FR-013**: System MUST establish connections within 10 seconds of a player joining a room
- **FR-014**: System MUST only use Discord (or other room management service) for identifying which players are in the room, not for WebRTC signaling
- **FR-015**: System MUST handle multiple camera devices and allow players to switch between available cameras (MUST reuse existing camera selection popover in VideoStreamGrid component). When switching cameras, replace video tracks in existing peer connections without closing/recreating connections.
- **FR-016**: System MUST clean up peer connections and media streams when a player leaves the room

### Key Entities *(include if feature involves data)*

- **Peer Connection**: Represents a WebRTC connection between two players, manages offer/answer exchange, ICE candidates, and media streams
- **Signaling Message**: Represents messages exchanged through the signaling service (offers, answers, ICE candidates) that enable peer connection establishment
- **Player Stream**: Represents a player's webcam and microphone media stream, including state (enabled/disabled, muted/unmuted) and connection status
- **Room Participant**: Represents a player's presence in a game room, used to determine which peers need connections (obtained from room management service, not managed by WebRTC feature)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of peer connections establish successfully within 10 seconds of a player joining a room
- **SC-002**: Video streams maintain at least 15 frames per second during normal gameplay conditions
- **SC-003**: System successfully establishes peer connections in 90% of network configurations without requiring manual NAT configuration
- **SC-004**: Players can see all other players' video streams simultaneously in the grid layout without performance degradation
- **SC-005**: When a player's connection drops, automatic reconnection succeeds within 15 seconds in 80% of cases
- **SC-006**: System supports 4 simultaneous video streams in a single room without significant latency increase (less than 500ms additional latency per additional stream)
- **SC-007**: Players can toggle video/audio controls and see state changes reflected for other players within 1 second

## Assumptions

- Players have modern browsers with WebRTC support (Chrome, Firefox, Safari, Edge)
- Players have camera and microphone hardware available
- Network conditions allow for peer-to-peer connections (may require TURN servers for some NAT configurations, but initial implementation uses STUN only)
- Room management service (currently Discord) provides a reliable list of players in the room
- Signaling service has sufficient capacity to handle offer/answer/ICE candidate exchange for all concurrent rooms
- Players grant camera/microphone permissions when prompted
- Typical room size is 2-4 players (larger rooms may have performance constraints)
- Existing VideoStreamGrid component UI controls will be reused/extended:
  - Video toggle button (enable/disable video feed)
  - Audio mute/unmute button (microphone control)
  - Camera selection popover (switch between available camera devices)
  - Audio status indicators (visual mute/unmute state)
  - Connection status will integrate with existing UI indicator patterns

## Clarifications

### Session 2025-01-27

- Q: What protocol/mechanism should be used for the signaling service to exchange WebRTC offers/answers and ICE candidates? → A: Hybrid approach using existing TanStack Start infrastructure: SSE (server→client) for real-time signaling delivery and createServerFn (client→server) for sending signaling messages. Backend routes messages between players in the same room. This keeps signaling separate from Discord and uses existing infrastructure patterns.
- Q: How should the system handle players who deny camera/microphone permissions? → A: Allow entry to game room, show "camera unavailable" or "microphone unavailable" status indicator, provide retry button to request permissions again. Graceful degradation - game continues without video/audio from that player.
- Q: How should the system handle ICE candidate failures when NAT traversal cannot be established? → A: Show "connection failed" error message after 30 seconds of failed connection attempts, display retry button, allow game to continue without video from that peer. Does not require TURN servers for initial implementation.
- Q: How should the system handle signaling race conditions when two players try to establish a connection simultaneously? → A: Treat as normal flow - WebRTC protocol handles simultaneous offers/answers. No special backend ordering required. ICE gathering may overlap, which is expected behavior.
- Q: What happens to peer connections when a player switches between multiple camera devices? → A: Replace video tracks in existing peer connection (using replaceTrack API). Connection maintained, stream updates seamlessly without renegotiation. No need to close/recreate peer connections.

## Dependencies

- Room management service integration (currently Discord) - for identifying which players are in a room
- Signaling service - for exchanging WebRTC offer/answer and ICE candidates between peers (uses TanStack Start SSE + createServerFn: clients send via createServerFn, backend routes via SSE to target players, separate from Discord)
- Browser WebRTC APIs (RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, MediaStream)
- STUN server availability (stun:stun.l.google.com:19302)
- Existing VideoStreamGrid component - provides UI controls for video/audio/camera selection that must be reused
- TanStack Start Backend - routes signaling messages between players using SSE for delivery and createServerFn for receiving
