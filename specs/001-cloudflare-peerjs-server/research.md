# Research: Cloudflare Durable Objects PeerJS Server

**Date**: 2025-01-16  
**Status**: Phase 0 - Research Complete

## Research Tasks

This document resolves all "NEEDS CLARIFICATION" items from the Technical Context section of the implementation plan.

---

## 1. PeerJS Protocol Specification

### Decision
Use PeerJS Server Protocol v0.3.x (compatible with PeerJS client v1.x)

### Rationale
- The existing Spell Coven application uses PeerJS client library
- Protocol is well-documented and stable
- Message format is JSON-based over WebSocket
- No authentication required (handled by application layer)

### Key Protocol Details

**Message Types:**
```typescript
// Client → Server
type ClientMessage = 
  | { type: 'HEARTBEAT' }
  | { type: 'OFFER', src: string, dst: string, payload: RTCSessionDescriptionInit }
  | { type: 'ANSWER', src: string, dst: string, payload: RTCSessionDescriptionInit }
  | { type: 'CANDIDATE', src: string, dst: string, payload: RTCIceCandidateInit }
  | { type: 'LEAVE', src: string }

// Server → Client
type ServerMessage =
  | { type: 'OPEN', peerId: string }
  | { type: 'OFFER', src: string, payload: RTCSessionDescriptionInit }
  | { type: 'ANSWER', src: string, payload: RTCSessionDescriptionInit }
  | { type: 'CANDIDATE', src: string, payload: RTCIceCandidateInit }
  | { type: 'LEAVE', peerId: string }
  | { type: 'EXPIRE', peerId: string }
  | { type: 'ERROR', payload: { type: string, message: string } }
```

**Connection Flow:**
1. Client connects via WebSocket to `/peerjs?key=<api-key>&id=<peer-id>&token=<token>`
2. Server sends `OPEN` message with assigned peer ID
3. Client sends periodic `HEARTBEAT` messages (every 5 seconds)
4. Signaling messages are relayed between peers using `src` and `dst` fields

### Alternatives Considered
- Custom protocol: Rejected because it would require client-side changes
- Socket.io-based protocol: Rejected because PeerJS uses native WebSocket

### References
- [PeerJS Server GitHub](https://github.com/peers/peerjs-server)
- [PeerJS Client Documentation](https://peerjs.com/docs/)

---

## 2. WebSocket Connection Limits per Durable Object

### Decision
Plan for 10 concurrent WebSocket connections per Durable Object (4 peers + buffer)

### Rationale
- Cloudflare documentation states "hundreds" of WebSocket connections per Durable Object
- For game rooms with 2-4 peers, 10 connections provides ample headroom
- Each peer typically maintains 1 WebSocket connection
- Buffer allows for reconnection scenarios without hitting limits

### Constraints
- Cloudflare Workers WebSocket connections are billed separately
- Each connection counts toward the account's concurrent connection limit
- Hibernation API allows connections to persist even when object is evicted

### Implementation Impact
- Enforce maximum 4 active peers per game room at application level
- Reject new connections when room is full
- Monitor connection count in Durable Object state

### Alternatives Considered
- Single global Durable Object: Rejected due to coordination overhead and single point of failure
- One Durable Object per peer: Rejected because peers need shared state for coordination

### References
- [Cloudflare Durable Objects Limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [WebSocket Hibernation API](https://developers.cloudflare.com/durable-objects/api/websockets/)

---

## 3. Integration Testing Strategy for WebSocket Connections

### Decision
Use Miniflare with Vitest for local integration testing + manual testing with PeerJS client

### Rationale
- Miniflare provides local Cloudflare Workers environment with Durable Objects support
- Vitest integrates well with TypeScript and provides fast test execution
- Can simulate multiple WebSocket connections in tests
- Manual testing with actual PeerJS client ensures protocol compatibility

### Testing Approach

**Unit Tests (Vitest):**
- Message validation logic
- Peer registry operations
- Rate limiting logic
- Message routing logic

**Integration Tests (Miniflare + Vitest):**
- WebSocket connection establishment
- Message relay between peers
- Peer disconnection handling
- Hibernation and reactivation
- Multi-peer coordination (2-4 peers)

**Contract Tests:**
- PeerJS protocol message format validation
- Error response format validation
- Connection handshake flow

**Manual Testing:**
- Connect actual PeerJS client to local Miniflare instance
- Test with Spell Coven web application
- Verify WebRTC connection establishment end-to-end

### Test Environment Setup
```bash
# Install dependencies
npm install -D miniflare vitest @cloudflare/workers-types

# Run tests
npm run test          # Unit + integration tests
npm run test:watch    # Watch mode
npm run dev           # Local Miniflare server for manual testing
```

### Alternatives Considered
- Playwright for E2E testing: Deferred to post-MVP (requires full deployment)
- Mock WebSocket library: Rejected because Miniflare provides real WebSocket support

### References
- [Miniflare Documentation](https://miniflare.dev/)
- [Vitest WebSocket Testing](https://vitest.dev/guide/features.html)

---

## 4. Expected Message Throughput per Peer

### Decision
Plan for 50-100 messages per second per peer during active connection establishment

### Rationale
- WebRTC connection establishment involves rapid exchange of ICE candidates
- Typical ICE candidate gathering produces 10-30 candidates
- Connection establishment takes 2-5 seconds
- After connection, signaling traffic drops to near zero (only heartbeats)

### Traffic Patterns

**Connection Establishment (2-5 seconds):**
- OFFER: 1 message
- ANSWER: 1 message
- CANDIDATE: 10-30 messages per peer
- Total: ~50-100 messages during handshake

**Steady State:**
- HEARTBEAT: 1 message every 5 seconds (0.2 msg/sec)
- Reconnection events: occasional LEAVE/OFFER/ANSWER bursts

**Peak Load Scenario (4 peers joining simultaneously):**
- 4 peers × 50 messages each = 200 messages
- Spread over 5 seconds = 40 messages/second to Durable Object
- Well within Cloudflare Workers limits

### Implementation Impact
- Rate limiting: 100 messages/second per peer (allows headroom)
- No message queuing needed (traffic is bursty but brief)
- Hibernation timeout: 5 minutes (longer than typical idle period)

### Alternatives Considered
- Lower rate limit (10 msg/sec): Rejected because it would throttle ICE candidate exchange
- Message batching: Not needed due to low overall throughput

### References
- [WebRTC ICE Candidate Gathering](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/icecandidate_event)

---

## 5. Cloudflare Workers Best Practices

### Decision
Follow Cloudflare's recommended patterns for Durable Objects and WebSocket handling

### Key Practices

**Durable Object Design:**
- Use WebSocket Hibernation API to reduce memory usage
- Implement `webSocketMessage()`, `webSocketClose()`, `webSocketError()` handlers
- Store minimal state (peer IDs and connection references only)
- Use `state.storage` for persistent data (not needed for this use case)

**Error Handling:**
- Catch and log all errors in message handlers
- Send ERROR messages to clients for invalid requests
- Gracefully close connections on unrecoverable errors
- Implement exponential backoff for client reconnection

**Performance Optimization:**
- Minimize CPU time per message (target <10ms)
- Use `state.blockConcurrencyWhile()` for critical sections
- Avoid synchronous I/O operations
- Leverage edge caching for static assets (health check responses)

**Monitoring:**
- Use `console.log()` for structured logging (appears in Cloudflare dashboard)
- Track key metrics: connection count, message rate, error rate
- Implement health check endpoint for uptime monitoring

**Security:**
- Validate all incoming messages
- Implement rate limiting per peer
- Use CORS headers to restrict origins
- Validate peer IDs to prevent spoofing

### References
- [Cloudflare Durable Objects Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/)
- [WebSocket Hibernation API Guide](https://blog.cloudflare.com/durable-objects-easy-fast-correct-choose-three/)

---

## Summary of Decisions

| Area | Decision | Impact |
|------|----------|--------|
| Protocol | PeerJS v0.3.x | No client changes needed |
| Connection Limit | 10 per Durable Object | Supports 4 peers + buffer |
| Testing | Miniflare + Vitest | Fast local testing |
| Throughput | 100 msg/sec per peer | Handles ICE candidate bursts |
| Architecture | Hibernation API | Efficient resource usage |

All "NEEDS CLARIFICATION" items from Technical Context have been resolved. Ready to proceed to Phase 1: Design & Contracts.
