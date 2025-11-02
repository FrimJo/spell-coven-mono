# WebSocket Protocol Contract

**Feature**: Discord Gateway Real-Time Event System  
**Version**: 1.0  
**Date**: 2025-01-02

## Overview

This document defines the WebSocket protocol for real-time communication between browser clients and the TanStack Start server. The protocol uses JSON messages with a versioned envelope format.

**Important Note**: The technical spec document (`spec-discord-gateway.md`) mentions Server-Sent Events (SSE) as an alternative architecture in section 4.4. However, the **actual implementation uses WebSocket** for browser ↔ server communication. This decision was made because:
- WebSocket provides bidirectional communication (events + commands)
- Lower latency than SSE
- Single connection for both receiving events and sending commands
- Already implemented and working successfully

This contract documents the **WebSocket protocol** that is actually used in the implementation.

## Connection

**Endpoint**: `ws://localhost:3000/api/ws` (development) or `wss://your-domain.com/api/ws` (production)

**Authentication**: JWT token sent in first message within 5 seconds of connection

**Heartbeat**: Server sends ping every 15 seconds, client must respond

## Message Envelope

All messages use a versioned envelope format:

```typescript
interface WebSocketMessage {
  v: 1  // Protocol version
  type: 'auth' | 'ack' | 'event' | 'error'
  event?: string  // Event name (for type='event')
  payload?: unknown  // Event payload
  error?: string  // Error message (for type='error')
  guildId?: string  // Guild ID (for ack messages)
  ts: number  // Unix timestamp (milliseconds)
}
```

## Client → Server Messages

### 1. Authentication

**Sent**: Immediately after connection (within 5 seconds)

```json
{
  "v": 1,
  "type": "auth",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "ts": 1704240000000
}
```

**Fields**:
- `v`: Protocol version (always 1)
- `type`: Message type (always "auth")
- `token`: JWT token from server function
- `ts`: Current timestamp

**Response**: Server sends `ack` with `auth.ok` or closes connection

**Timeout**: Connection closed if no auth message within 5 seconds

## Server → Client Messages

### 1. Authentication Acknowledgment

**Sent**: After successful authentication

```json
{
  "v": 1,
  "type": "ack",
  "event": "auth.ok",
  "guildId": "123456789012345678",
  "ts": 1704240000000
}
```

**Fields**:
- `v`: Protocol version (always 1)
- `type`: Message type (always "ack")
- `event`: Event name (always "auth.ok")
- `guildId`: Discord guild ID user belongs to
- `ts`: Server timestamp

### 2. Voice Channel Events

**Sent**: When user joins voice channel

```json
{
  "v": 1,
  "type": "event",
  "event": "voice.joined",
  "payload": {
    "guildId": "123456789012345678",
    "channelId": "123456789012345678",
    "userId": "123456789012345678",
    "username": "PlayerName",
    "avatar": "a_1234567890abcdef"
  },
  "ts": 1704240000000
}
```

**Sent**: When user leaves voice channel

```json
{
  "v": 1,
  "type": "event",
  "event": "voice.left",
  "payload": {
    "guildId": "123456789012345678",
    "channelId": null,
    "userId": "123456789012345678"
  },
  "ts": 1704240000000
}
```

### 3. Room Events

**Sent**: When room is created

```json
{
  "v": 1,
  "type": "event",
  "event": "room.created",
  "payload": {
    "guildId": "123456789012345678",
    "channelId": "123456789012345678",
    "name": "My Game Room",
    "userLimit": 4
  },
  "ts": 1704240000000
}
```

**Sent**: When room is deleted

```json
{
  "v": 1,
  "type": "event",
  "event": "room.deleted",
  "payload": {
    "guildId": "123456789012345678",
    "channelId": "123456789012345678"
  },
  "ts": 1704240000000
}
```

### 4. Error Messages

**Sent**: When error occurs

```json
{
  "v": 1,
  "type": "error",
  "error": "Authentication failed",
  "ts": 1704240000000
}
```

**Common Errors**:
- "Authentication timeout" - No auth message within 5 seconds
- "Invalid token" - JWT validation failed
- "Session expired" - User session no longer valid
- "Connection limit exceeded" - Too many connections from user

## Event Types

| Event Name | Direction | Description |
|------------|-----------|-------------|
| `auth` | Client → Server | Authentication request |
| `auth.ok` | Server → Client | Authentication successful |
| `voice.joined` | Server → Client | User joined voice channel |
| `voice.left` | Server → Client | User left voice channel |
| `room.created` | Server → Client | Room created |
| `room.deleted` | Server → Client | Room deleted |

## Connection Lifecycle

```
1. Client connects to /api/ws
2. Client sends auth message with JWT (within 5s)
3. Server validates JWT
4. Server registers connection
5. Server sends auth.ok acknowledgment
6. Connection ready for events
7. Server sends heartbeat every 15s
8. Client receives events
9. Connection closed (client or server)
10. Server unregisters connection
```

## Error Handling

### Authentication Timeout

**Condition**: No auth message within 5 seconds

**Action**: Server closes connection with code 4001

**Client Handling**: Reconnect with valid JWT

### Invalid Token

**Condition**: JWT validation fails

**Action**: Server sends error message and closes connection

**Client Handling**: Obtain new JWT and reconnect

### Connection Lost

**Condition**: Network failure or server restart

**Action**: Client detects disconnect

**Client Handling**: Exponential backoff reconnection (1s → 2s → 4s → 8s → 16s, max 5 attempts)

## Heartbeat

**Server**: Sends ping every 15 seconds (empty message or comment)

**Client**: No response required (browser handles automatically)

**Purpose**: Keep connection alive, detect dead connections

## Backpressure

**Buffer Limit**: 1MB per connection

**Handling**: Connection closed with code 1008 if buffer exceeded

**Prevention**: Client should process events promptly

## Security

**Authentication**: JWT token required within 5 seconds

**Authorization**: Events filtered by guild membership

**Encryption**: WSS (TLS) in production

**Secrets**: JWT secret never exposed to client

## Versioning

**Current Version**: 1

**Breaking Changes**: Increment version number

**Backward Compatibility**: Not required, clients must update

**Migration**: Update client code to new protocol version

## Example Client Implementation

```typescript
class VoiceChannelWebSocketManager {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  
  connect(jwtToken: string) {
    this.ws = new WebSocket('ws://localhost:3000/api/ws')
    
    this.ws.onopen = () => {
      // Send auth message immediately
      this.ws?.send(JSON.stringify({
        v: 1,
        type: 'auth',
        token: jwtToken,
        ts: Date.now()
      }))
    }
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      
      if (message.type === 'ack' && message.event === 'auth.ok') {
        console.log('Authenticated:', message.guildId)
        this.reconnectAttempts = 0
      }
      
      if (message.type === 'event') {
        this.handleEvent(message.event, message.payload)
      }
      
      if (message.type === 'error') {
        console.error('WebSocket error:', message.error)
      }
    }
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    this.ws.onclose = () => {
      this.reconnect(jwtToken)
    }
  }
  
  private reconnect(jwtToken: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }
    
    const delay = Math.pow(2, this.reconnectAttempts) * 1000
    this.reconnectAttempts++
    
    setTimeout(() => {
      this.connect(jwtToken)
    }, delay)
  }
  
  private handleEvent(event: string, payload: unknown) {
    switch (event) {
      case 'voice.joined':
        // Handle voice joined
        break
      case 'voice.left':
        // Handle voice left
        break
      case 'room.created':
        // Handle room created
        break
      case 'room.deleted':
        // Handle room deleted
        break
    }
  }
  
  disconnect() {
    this.ws?.close()
    this.ws = null
  }
}
```

## Testing

### Unit Tests

- Message serialization/deserialization
- Protocol version validation
- Event type validation

### Integration Tests

- Connection establishment
- Authentication flow
- Event delivery
- Reconnection logic
- Error handling

### Load Tests

- 100 concurrent connections
- 100 events/s throughput
- Latency < 300ms p95

## References

- WebSocket RFC 6455: https://tools.ietf.org/html/rfc6455
- Feature Spec: `/specs/017-discord-gateway-real/spec.md`
- Data Model: `/specs/017-discord-gateway-real/data-model.md`
