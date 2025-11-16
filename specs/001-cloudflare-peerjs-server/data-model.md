# Data Model: Cloudflare Durable Objects PeerJS Server

**Date**: 2025-01-16  
**Status**: Phase 1 - Design

## Overview

This document defines the core entities and their relationships for the PeerJS signaling server. The data model is intentionally minimal, storing only ephemeral state required for WebSocket coordination.

---

## Entities

### 1. Peer

Represents a connected game player with an active WebSocket connection.

**Fields:**
```typescript
interface Peer {
  id: string                    // Unique peer identifier (provided by client)
  connection: WebSocket         // Active WebSocket connection reference
  connectedAt: number           // Unix timestamp (milliseconds)
  lastHeartbeat: number         // Unix timestamp of last heartbeat
  messageCount: number          // Total messages sent (for rate limiting)
  messageWindowStart: number    // Rate limiting window start time
}
```

**Validation Rules:**
- `id`: Must be non-empty string, max 64 characters, alphanumeric + hyphens
- `connection`: Must be an open WebSocket connection
- `connectedAt`: Must be valid Unix timestamp
- `lastHeartbeat`: Must be ≥ connectedAt
- `messageCount`: Must be ≥ 0
- `messageWindowStart`: Must be valid Unix timestamp

**State Transitions:**
```
[Disconnected] --connect--> [Connected] --heartbeat--> [Active]
[Active] --timeout--> [Stale] --cleanup--> [Disconnected]
[Connected] --disconnect--> [Disconnected]
```

**Lifecycle:**
- Created when WebSocket connection is established
- Updated on each heartbeat message
- Removed when WebSocket closes or timeout occurs (5 seconds without heartbeat)

---

### 2. Game Room (Durable Object)

Represents a logical grouping of peers coordinating WebRTC connections. Implemented as a Cloudflare Durable Object.

**Fields:**
```typescript
interface GameRoom {
  roomId: string                      // Durable Object ID (Discord channel ID)
  peers: Map<string, Peer>            // Active peers indexed by peer ID
  maxPeers: number                    // Maximum allowed peers (4)
  createdAt: number                   // Unix timestamp
  lastActivityAt: number              // Unix timestamp of last message
  hibernated: boolean                 // Whether object is currently hibernated
}
```

**Validation Rules:**
- `roomId`: Must match Discord channel ID format (snowflake)
- `peers`: Size must be ≤ maxPeers
- `maxPeers`: Must be 4 (constant)
- `createdAt`: Must be valid Unix timestamp
- `lastActivityAt`: Must be ≥ createdAt
- `hibernated`: Managed by Cloudflare runtime

**State Transitions:**
```
[Empty] --first-peer-joins--> [Active]
[Active] --all-peers-leave--> [Idle]
[Idle] --5min-timeout--> [Hibernated]
[Hibernated] --message-arrives--> [Active]
```

**Lifecycle:**
- Created on first WebSocket connection to room
- Persists as long as at least one peer is connected
- Hibernates after 5 minutes of inactivity
- Reactivates automatically when new messages arrive
- No explicit deletion (garbage collected by Cloudflare)

---

### 3. Signaling Message

Represents a message exchanged between peers for WebRTC coordination.

**Fields:**
```typescript
type SignalingMessage = 
  | HeartbeatMessage
  | OfferMessage
  | AnswerMessage
  | CandidateMessage
  | LeaveMessage

interface HeartbeatMessage {
  type: 'HEARTBEAT'
}

interface OfferMessage {
  type: 'OFFER'
  src: string                         // Source peer ID
  dst: string                         // Destination peer ID
  payload: RTCSessionDescriptionInit  // WebRTC offer
}

interface AnswerMessage {
  type: 'ANSWER'
  src: string                         // Source peer ID
  dst: string                         // Destination peer ID
  payload: RTCSessionDescriptionInit  // WebRTC answer
}

interface CandidateMessage {
  type: 'CANDIDATE'
  src: string                         // Source peer ID
  dst: string                         // Destination peer ID
  payload: RTCIceCandidateInit        // ICE candidate
}

interface LeaveMessage {
  type: 'LEAVE'
  src: string                         // Peer ID leaving
}
```

**Validation Rules:**
- `type`: Must be one of the defined message types
- `src`: Must be a valid peer ID currently in the room
- `dst`: Must be a valid peer ID currently in the room (for routed messages)
- `payload`: Must conform to WebRTC spec for respective message type
- Message size: Must be < 1MB (Cloudflare limit)

**Routing Rules:**
- `HEARTBEAT`: Not routed, updates sender's lastHeartbeat
- `OFFER`, `ANSWER`, `CANDIDATE`: Routed from `src` to `dst` peer
- `LEAVE`: Broadcast to all other peers in room

**Lifecycle:**
- Created when received from client WebSocket
- Validated and routed immediately
- Not persisted (ephemeral)
- Discarded after delivery or on error

---

### 4. Rate Limit State

Tracks message rate per peer for abuse prevention.

**Fields:**
```typescript
interface RateLimitState {
  peerId: string                // Peer being rate limited
  windowStart: number           // Current rate limit window start (Unix timestamp)
  messageCount: number          // Messages sent in current window
  maxMessages: number           // Maximum messages per window (100)
  windowDuration: number        // Window duration in milliseconds (1000)
}
```

**Validation Rules:**
- `messageCount`: Must be ≤ maxMessages
- `windowDuration`: Must be 1000ms (1 second)
- `maxMessages`: Must be 100

**State Transitions:**
```
[Within Limit] --message--> [Increment Count]
[Increment Count] --count > max--> [Rate Limited]
[Rate Limited] --window-expires--> [Reset]
```

**Lifecycle:**
- Created when peer connects
- Updated on each message
- Reset every second (sliding window)
- Removed when peer disconnects

---

## Relationships

```
GameRoom (1) ----< (0..4) Peer
Peer (1) ----< (0..*) SignalingMessage [sender]
Peer (1) ----< (0..*) SignalingMessage [receiver]
Peer (1) ---- (1) RateLimitState
```

**Cardinality:**
- One Game Room contains 0-4 Peers
- One Peer sends/receives many Signaling Messages
- One Peer has exactly one Rate Limit State

---

## State Management

### In-Memory State (Durable Object)

Stored in Durable Object instance memory:
```typescript
class GameRoomCoordinator {
  private peers: Map<string, Peer> = new Map()
  private maxPeers: number = 4
  private lastActivityAt: number = Date.now()
}
```

**Characteristics:**
- Ephemeral (lost on hibernation, but WebSocket connections persist)
- Fast access (no I/O)
- Automatically garbage collected when object is evicted

### Persistent State (Not Used)

This implementation does NOT use `state.storage` because:
- No need to persist historical data
- WebSocket connections are the source of truth
- Hibernation API maintains connections without persisting state
- Peer list can be reconstructed from active WebSocket connections

---

## Error States

### Peer Errors
- **Connection Timeout**: Peer doesn't send heartbeat within 5 seconds
- **Rate Limit Exceeded**: Peer sends >100 messages per second
- **Invalid Message**: Peer sends malformed or invalid message
- **Unknown Destination**: Peer sends message to non-existent peer

### Room Errors
- **Room Full**: New peer attempts to join when 4 peers already connected
- **Memory Limit**: Durable Object exceeds 128MB memory limit (unlikely)
- **CPU Timeout**: Message handler exceeds 30 second limit (unlikely)

### Recovery Actions
- **Connection Timeout**: Close WebSocket, send EXPIRE to other peers
- **Rate Limit Exceeded**: Send ERROR message, close connection if persistent
- **Invalid Message**: Send ERROR message, continue connection
- **Unknown Destination**: Send ERROR message, discard message
- **Room Full**: Send ERROR message, close connection immediately

---

## Performance Considerations

### Memory Usage
- Each Peer: ~1KB (WebSocket reference + metadata)
- 4 Peers per room: ~4KB
- 1000 rooms: ~4MB total
- Well within 128MB Durable Object limit

### Message Throughput
- Peak: 100 messages/second per peer
- 4 peers: 400 messages/second per room
- Cloudflare Workers: 50ms CPU time per request (sufficient)

### Latency Targets
- Message validation: <1ms
- Message routing: <5ms
- Total signaling latency: <200ms (including network)

---

## Summary

The data model is intentionally minimal, focusing on:
1. **Peer tracking**: Who is connected and when
2. **Message routing**: Getting messages from sender to receiver
3. **Rate limiting**: Preventing abuse
4. **State cleanup**: Removing stale connections

No persistent storage is required. All state is ephemeral and reconstructed from active WebSocket connections.
