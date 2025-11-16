# Feature Specification: Cloudflare Durable Objects PeerJS Server

**Feature Branch**: `001-cloudflare-peerjs-server`  
**Created**: 2025-01-16  
**Status**: Draft  
**Input**: User description: "Create a Cloudflare Durable Objects-based PeerJS server clone"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Peer Connection Signaling (Priority: P1)

A game player opens the Spell Coven web application and needs to establish a peer-to-peer video connection with other players in their game room. The signaling server coordinates the WebRTC connection establishment by relaying connection offers, answers, and ICE candidates between peers.

**Why this priority**: This is the core functionality that enables peer-to-peer connections. Without it, no video streaming can occur. This represents the minimum viable product.

**Independent Test**: Can be fully tested by connecting two PeerJS clients to the server, having one client send a connection offer, and verifying the other client receives it and can respond with an answer. Delivers immediate value by enabling basic peer discovery and connection establishment.

**Acceptance Scenarios**:

1. **Given** a player opens the game room, **When** they initialize their PeerJS client with a unique peer ID, **Then** the server accepts the WebSocket connection and registers the peer
2. **Given** two peers are connected to the server, **When** peer A sends a connection offer to peer B, **Then** peer B receives the offer message within 500ms
3. **Given** peer B receives an offer, **When** peer B sends an answer back to peer A, **Then** peer A receives the answer and the WebRTC connection is established
4. **Given** peers are exchanging ICE candidates, **When** a candidate is sent, **Then** it is relayed to the target peer within 500ms

---

### User Story 2 - Connection State Management (Priority: P2)

The signaling server maintains accurate state about which peers are currently connected and available for connections. When a peer disconnects (intentionally or due to network issues), the server cleans up their state and notifies any connected peers.

**Why this priority**: Prevents stale connections and ensures peers don't attempt to connect to unavailable peers. Critical for user experience but the system can function without perfect state management initially.

**Independent Test**: Can be tested by connecting a peer, verifying it appears in the server's peer registry, disconnecting the peer, and confirming the server removes it from the registry and notifies other peers.

**Acceptance Scenarios**:

1. **Given** a peer is connected, **When** the peer's WebSocket connection closes, **Then** the server removes the peer from the active peer registry within 1 second
2. **Given** multiple peers are connected to coordinate with a specific peer, **When** that peer disconnects, **Then** all connected peers receive a disconnection notification
3. **Given** a peer connection is idle for more than 5 minutes, **When** the hibernation timeout occurs, **Then** the Durable Object can be evicted from memory while maintaining WebSocket state
4. **Given** a hibernated Durable Object, **When** a new message arrives for any peer, **Then** the Durable Object is reactivated and processes the message within 100ms

---

### User Story 3 - Multi-Peer Room Coordination (Priority: P2)

In a game room with 2-4 players, the signaling server coordinates connections between all peers in a mesh topology. Each peer needs to establish direct connections with every other peer in the room.

**Why this priority**: Enables the full multiplayer experience with multiple simultaneous video streams. Builds on P1 functionality but requires more sophisticated coordination logic.

**Independent Test**: Can be tested by connecting 4 peers to the same room, initiating connections from each peer to all others, and verifying all 6 peer-to-peer connections (4 choose 2) are successfully established.

**Acceptance Scenarios**:

1. **Given** 4 peers in a game room, **When** a new peer joins, **Then** the server facilitates connection establishment between the new peer and all existing peers
2. **Given** peers are in a mesh topology, **When** any peer sends a message, **Then** only the intended recipient receives it (no broadcast to all)
3. **Given** a peer is connecting to multiple other peers, **When** offers/answers are exchanged, **Then** each connection is tracked independently without interference
4. **Given** a room has reached maximum capacity (4 peers), **When** a 5th peer attempts to join, **Then** the server rejects the connection with an appropriate error message

---

### User Story 4 - Global Edge Deployment (Priority: P3)

The signaling server is deployed globally across Cloudflare's edge network, ensuring low-latency signaling regardless of where players are located geographically. Each game room's Durable Object is automatically routed to the optimal edge location.

**Why this priority**: Improves performance and user experience but the system can function with higher latency initially. This is an optimization that leverages Cloudflare's infrastructure advantages.

**Independent Test**: Can be tested by connecting peers from different geographic regions (e.g., US, Europe, Asia) and measuring signaling latency. Verify that latency is consistently under 200ms regardless of peer locations.

**Acceptance Scenarios**:

1. **Given** players from different continents join a game room, **When** they establish connections, **Then** signaling messages are routed through the nearest Cloudflare edge location
2. **Given** a Durable Object is created for a game room, **When** the first peer connects, **Then** the Durable Object is instantiated in the edge location closest to that peer
3. **Given** a game room is active, **When** network conditions change, **Then** the Durable Object remains stable and doesn't migrate during active gameplay
4. **Given** signaling traffic patterns, **When** measured over time, **Then** 95th percentile latency is under 200ms globally

---

### Edge Cases

- **What happens when a peer sends malformed signaling messages?** The server validates all incoming messages and rejects invalid ones with appropriate error responses, preventing crashes or state corruption
- **How does the system handle rapid connect/disconnect cycles?** The server implements rate limiting and connection throttling to prevent abuse and ensure stability
- **What happens when a Durable Object reaches memory limits?** The hibernation API ensures WebSocket connections persist even when the object is evicted from memory, with automatic reactivation on new messages
- **How does the system handle concurrent connection attempts to the same peer?** The server serializes connection requests and ensures only one connection establishment process occurs at a time per peer pair
- **What happens when network partitions occur?** The server detects stale connections through heartbeat mechanisms and cleans up orphaned state after timeout periods
- **How does the system handle message ordering?** Messages are delivered in the order received per WebSocket connection, but no guarantees exist across different peer connections

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept WebSocket connections from PeerJS clients and maintain persistent connections for signaling
- **FR-002**: System MUST assign each connecting peer a unique identifier and track their connection state
- **FR-003**: System MUST relay signaling messages (offers, answers, ICE candidates) between peers with message type preservation
- **FR-004**: System MUST support the PeerJS protocol message format including heartbeat, offer, answer, candidate, and leave message types
- **FR-005**: System MUST detect peer disconnections within 5 seconds and clean up associated state
- **FR-006**: System MUST notify connected peers when a peer they're coordinating with disconnects
- **FR-007**: System MUST support concurrent connections from multiple peers within the same game room (up to 4 peers per room)
- **FR-008**: System MUST use Durable Objects to ensure each game room has a single, consistent coordination point
- **FR-009**: System MUST implement the WebSocket Hibernation API to allow Durable Objects to be evicted during inactivity while maintaining connections
- **FR-010**: System MUST validate all incoming signaling messages and reject malformed messages with appropriate error responses
- **FR-011**: System MUST implement message routing to ensure signaling messages reach only their intended recipient
- **FR-012**: System MUST persist minimal state (active peer IDs and their WebSocket connections) for each game room
- **FR-013**: System MUST support CORS headers to allow connections from the Spell Coven web application domain
- **FR-014**: System MUST implement heartbeat/ping-pong mechanisms to detect stale connections
- **FR-015**: System MUST handle WebSocket errors gracefully and close connections cleanly
- **FR-016**: System MUST log connection events, disconnection events, and errors for monitoring and debugging
- **FR-017**: System MUST expose health check endpoints for deployment monitoring
- **FR-018**: System MUST implement rate limiting to prevent abuse (max 100 messages per second per peer)
- **FR-019**: System MUST support secure WebSocket connections (WSS) in production environments
- **FR-020**: System MUST be compatible with the existing PeerJS client library without requiring client-side changes

### Key Entities

- **Peer**: Represents a connected game player with a unique identifier, WebSocket connection, and connection state (connected, disconnected, idle)
- **Game Room**: A logical grouping of peers (represented by a Durable Object instance) that coordinates signaling between 2-4 players in the same game session
- **Signaling Message**: A message exchanged between peers containing connection offers, answers, ICE candidates, or control messages (heartbeat, leave)
- **Durable Object State**: Persistent state maintained by each game room's Durable Object including the set of active peer IDs and their WebSocket connections

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Peers can establish WebRTC connections through the signaling server with 99.9% success rate under normal network conditions
- **SC-002**: Signaling message latency (time from send to receive) is under 200ms for 95% of messages globally
- **SC-003**: The server can handle 4 concurrent peers per game room with no message loss or connection failures
- **SC-004**: Peer disconnections are detected and cleaned up within 5 seconds, with notifications sent to affected peers
- **SC-005**: The system can handle 1000 concurrent game rooms (4000 total peer connections) without performance degradation
- **SC-006**: Durable Objects successfully hibernate during inactivity and reactivate within 100ms when messages arrive
- **SC-007**: The server maintains 99.95% uptime leveraging Cloudflare's global edge network
- **SC-008**: Zero client-side code changes required - existing PeerJS clients can connect without modifications
- **SC-009**: Deployment to Cloudflare Workers completes in under 30 seconds using Wrangler CLI
- **SC-010**: Server logs provide sufficient information to debug connection issues within 5 minutes of occurrence

## Assumptions

- The existing Spell Coven web application uses the standard PeerJS client library
- Game rooms are identified by Discord voice channel IDs (which can be used as Durable Object names)
- The maximum number of players per game room is 4 (matching the current system design)
- The application requires only signaling coordination - actual media streams flow peer-to-peer
- Cloudflare Workers free tier limits are acceptable for initial deployment (100,000 requests/day, 1000 Durable Objects)
- The web application can be configured to point to the Cloudflare Workers endpoint instead of localhost:9000

## Scope Boundaries

**In Scope:**
- WebSocket signaling server functionality compatible with PeerJS protocol
- Durable Objects-based state management for game rooms
- WebSocket Hibernation API implementation for efficient resource usage
- Basic monitoring and health checks
- Deployment configuration for Cloudflare Workers

**Out of Scope:**
- TURN server functionality (media relay) - peers connect directly
- Authentication/authorization (handled by the web application)
- Persistent storage of historical connection data
- Advanced analytics or metrics dashboards
- Custom protocol extensions beyond standard PeerJS
- Migration tooling from existing Node.js PeerJS server
- Load testing infrastructure
- Multi-region failover logic (handled by Cloudflare automatically)
