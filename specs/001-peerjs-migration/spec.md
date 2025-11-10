# Feature Specification: PeerJS WebRTC Migration

**Feature Branch**: `001-peerjs-migration`  
**Created**: 2025-11-10  
**Status**: Clarified  
**Input**: User description: "Migrate WebRTC implementation from custom signaling to PeerJS library to reduce code complexity from ~1000 lines to ~100-200 lines"

## Clarifications

### Session 2025-11-10

- Q: Migration strategy (incremental vs big bang vs parallel) → A: Big bang replacement - Replace entire WebRTC system at once, test thoroughly, then deploy
- Q: Fallback mechanism if PeerJS has critical issues → A: No fallback - commit fully to new system
- Q: Connection timeout before considering failure → A: 10 seconds
- Q: Reconnection retry policy → A: 3 attempts with exponential backoff
- Q: Maximum video resolution constraint → A: 4k max

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

### User Story 1 - Basic Video Streaming Works (Priority: P1)

Players can see and hear each other's video streams in a game room using the new PeerJS implementation, with the same functionality as the current system.

**Why this priority**: This is the core functionality - without working video streams, the entire feature fails. This must work before any other improvements matter.

**Independent Test**: Can be fully tested by having 2-4 players join a game room and verifying they can see each other's video feeds. Delivers immediate value as a working replacement for the current system.

**Acceptance Scenarios**:

1. **Given** two players in a game room, **When** both players start their video, **Then** each player sees the other's video stream
2. **Given** a player with video enabled, **When** a new player joins the room, **Then** the new player sees existing video streams and existing players see the new player's stream
3. **Given** four players in a game room with video enabled, **When** any player toggles their video off, **Then** other players see the video feed stop for that player
4. **Given** a player in a game room, **When** they switch their camera device, **Then** other players see the updated video feed from the new camera

---

### User Story 2 - Connection Reliability Maintained (Priority: P2)

Players experience stable video connections with automatic reconnection when network issues occur, matching or exceeding current system reliability.

**Why this priority**: After basic functionality works, connection stability is critical for user experience. Players should not experience frequent disconnections or need to manually refresh.

**Independent Test**: Can be tested by simulating network interruptions (throttling, brief disconnects) and verifying the system recovers automatically without user intervention.

**Acceptance Scenarios**:

1. **Given** two players with active video streams, **When** one player experiences a brief network interruption, **Then** the connection automatically re-establishes without manual intervention
2. **Given** a player in a game room, **When** their network connection drops completely, **Then** the system detects the disconnection and removes their video feed from other players' views
3. **Given** a player who was disconnected, **When** they rejoin the game room, **Then** video connections re-establish with all other players automatically

---

### User Story 3 - Reduced Codebase Complexity (Priority: P3)

Developers can maintain and extend the WebRTC functionality with significantly less code and complexity compared to the current custom implementation.

**Why this priority**: While important for long-term maintainability, this is primarily a developer benefit and doesn't directly impact user experience. It enables faster future development.

**Independent Test**: Can be measured by comparing lines of code, number of files, and complexity metrics between old and new implementations. Success means 70-80% code reduction while maintaining functionality.

**Acceptance Scenarios**:

1. **Given** the new PeerJS implementation, **When** measuring total lines of WebRTC-related code, **Then** the codebase is reduced from ~1000 lines to ~100-200 lines
2. **Given** the new implementation, **When** a developer needs to add a new feature (e.g., screen sharing), **Then** the change requires fewer files and less code compared to the old system
3. **Given** the simplified codebase, **When** onboarding a new developer, **Then** they can understand the WebRTC flow in under 30 minutes (vs. several hours with the old system)

### Edge Cases

- What happens when a player joins a room but PeerJS signaling server is unavailable?
- How does the system handle when all 4 players are in a room and a 5th player attempts to join?
- What happens when a player's browser doesn't support WebRTC?
- How does the system behave when a player has extremely poor network conditions (high latency, packet loss)?
- What happens when a player closes their browser tab without properly leaving the room?
- How does the system handle rapid camera device switching (user changes camera multiple times quickly)?
- What happens when a player denies camera/microphone permissions?
- How does the system handle when PeerJS cloud service has an outage (if using cloud signaling)?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST establish peer-to-peer video connections between all players in a game room (2-4 players)
- **FR-002**: System MUST support mesh topology where each player connects directly to every other player
- **FR-003**: System MUST allow players to toggle their video on/off without disconnecting from the room
- **FR-004**: System MUST allow players to toggle their audio mute/unmute
- **FR-005**: System MUST allow players to switch between available camera devices while maintaining connections
- **FR-006**: System MUST automatically establish connections when a new player joins an existing room
- **FR-007**: System MUST automatically clean up connections when a player leaves the room
- **FR-008**: System MUST handle connection failures gracefully with automatic retry logic (3 attempts with exponential backoff: immediate, 2s, 4s delays)
- **FR-008a**: System MUST timeout connection attempts after 10 seconds
- **FR-009**: System MUST maintain existing Discord voice channel integration for player presence detection
- **FR-010**: System MUST preserve all current video streaming features (camera selection, video toggle, audio toggle)
- **FR-011**: System MUST use PeerJS cloud signaling service initially, with capability to migrate to self-hosted server if scaling or reliability requirements demand it
- **FR-012**: System MUST remove custom SSE-based signaling infrastructure after migration is complete
- **FR-013**: System MUST remove custom WebRTC peer connection management code after migration is complete
- **FR-014**: System MUST enforce maximum video resolution of 4K to ensure bandwidth stability in mesh topology
- **FR-015**: Migration MUST be executed as a complete replacement (big bang deployment) with thorough staging testing before production release

### Key Entities

- **Peer Connection**: Represents a WebRTC connection between two players, managed by PeerJS library. Contains media streams, connection state, and peer identification.
- **Media Stream**: Represents a player's audio/video feed. Each player has one local stream (their camera/mic) and multiple remote streams (other players' feeds).
- **Game Room**: Represents a collection of players who should be connected via WebRTC. Identified by Discord voice channel ID.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Codebase maintainability improves as measured by 70-80% reduction in video connection management code
- **SC-002**: System architecture simplifies as measured by 40-60% reduction in number of modules handling video connections
- **SC-003**: Video connection establishment time remains under 3 seconds for 2-4 players (with 10-second timeout for failures)
- **SC-004**: Connection success rate remains at or above 95% (matching current system)
- **SC-005**: Zero regression in existing video streaming features (all current functionality preserved)
- **SC-006**: Developer productivity improves as measured by 75% reduction in time required to understand video connection flow
- **SC-007**: Feature development velocity improves as measured by 50% reduction in time to add new video-related capabilities
