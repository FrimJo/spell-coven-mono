# WebSocket Protocol Specification

**Version**: 1.0.0  
**Protocol Version**: `v: 1`

## Overview

This document defines the WebSocket protocol for real-time event streaming between TanStack Start backend and browser clients.

---

## Connection Flow

```
Client                                    Server
  │                                         │
  ├─────── WebSocket Upgrade ──────────────>│
  │                                         │
  │<──────── 101 Switching Protocols ───────┤
  │                                         │
  ├─────── {"type": "auth", "token": "..."} >│
  │                                         │
  │                                     [Verify JWT]
  │                                         │
  │<──────── {"type": "ack", "event": "auth.ok"} ─┤
  │                                         │
  │<──────── {"type": "event", "event": "room.created", ...} ─┤
  │<──────── {"type": "event", "event": "voice.joined", ...} ─┤
  │                                         │
  │                                    [Connection maintained]
  │                                         │
  │<──────── Close (1000 Normal) ───────────┤
  │                                         │
```

---

## Message Envelope

All messages use a versioned envelope format:

```typescript
interface MessageEnvelope {
  v: 1;                    // Protocol version
  type: "event" | "ack" | "error";
  event?: string;          // Event name (for type="event")
  payload?: unknown;       // Event-specific payload
  ts: number;              // Unix timestamp (milliseconds)
}
```

### Example

```json
{
  "v": 1,
  "type": "event",
  "event": "room.created",
  "payload": {
    "channelId": "1234567890123456789",
    "name": "spell-coven-abc123",
    "guildId": "9876543210987654321"
  },
  "ts": 1730000000000
}
```

---

## Client → Server Messages

### 1. Authentication

**Sent immediately after connection**

```json
{
  "type": "auth",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Fields**:
- `type`: Must be `"auth"`
- `token`: JWT token from OAuth2 + PKCE flow

**Server Response (Success)**:
```json
{
  "v": 1,
  "type": "ack",
  "event": "auth.ok",
  "guildId": "9876543210987654321"
}
```

**Server Response (Failure)**:
```
WebSocket close code: 4401
Reason: "unauthorized"
```

---

## Server → Client Messages

### 2. Event: room.created

**Emitted when a voice channel is created**

```json
{
  "v": 1,
  "type": "event",
  "event": "room.created",
  "payload": {
    "channelId": "1234567890123456789",
    "name": "spell-coven-abc123",
    "guildId": "9876543210987654321",
    "parentId": "9999999999999999999",
    "userLimit": 4
  },
  "ts": 1730000000000
}
```

**Payload Fields**:
- `channelId` (string): Discord channel ID
- `name` (string): Channel name
- `guildId` (string): Discord guild ID
- `parentId` (string, optional): Parent category ID
- `userLimit` (number): Maximum users (0 = unlimited)

---

### 3. Event: room.deleted

**Emitted when a voice channel is deleted**

```json
{
  "v": 1,
  "type": "event",
  "event": "room.deleted",
  "payload": {
    "channelId": "1234567890123456789",
    "guildId": "9876543210987654321"
  },
  "ts": 1730000000000
}
```

**Payload Fields**:
- `channelId` (string): Discord channel ID
- `guildId` (string): Discord guild ID

---

### 4. Event: voice.joined

**Emitted when a user joins a voice channel**

```json
{
  "v": 1,
  "type": "event",
  "event": "voice.joined",
  "payload": {
    "guildId": "9876543210987654321",
    "channelId": "1234567890123456789",
    "userId": "1111111111111111111"
  },
  "ts": 1730000000000
}
```

**Payload Fields**:
- `guildId` (string): Discord guild ID
- `channelId` (string): Discord channel ID
- `userId` (string): Discord user ID

---

### 5. Event: voice.left

**Emitted when a user leaves a voice channel**

```json
{
  "v": 1,
  "type": "event",
  "event": "voice.left",
  "payload": {
    "guildId": "9876543210987654321",
    "channelId": null,
    "userId": "1111111111111111111"
  },
  "ts": 1730000000000
}
```

**Payload Fields**:
- `guildId` (string): Discord guild ID
- `channelId` (string | null): Discord channel ID (null if disconnected)
- `userId` (string): Discord user ID

---

### 6. Error Message

**Emitted when an error occurs**

```json
{
  "v": 1,
  "type": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired JWT token"
  },
  "ts": 1730000000000
}
```

**Error Codes**:
- `UNAUTHORIZED`: Invalid JWT or missing authentication
- `FORBIDDEN`: Valid JWT but insufficient permissions
- `INTERNAL_ERROR`: Unexpected server error

---

## Close Codes

| Code | Name | Description |
|------|------|-------------|
| 1000 | Normal Closure | Clean disconnect |
| 1001 | Going Away | Server shutting down |
| 1008 | Policy Violation | Protocol violation (e.g., invalid message format) |
| 1011 | Internal Error | Unexpected server error |
| 1013 | Try Again Later | Overloaded (bufferedAmount too high) |
| 4401 | Unauthorized | Invalid or expired JWT token |

---

## Client Implementation Example

### JavaScript/TypeScript

```typescript
class SpellCovenWebSocket {
  private ws: WebSocket | null = null;
  private jwt: string;

  constructor(jwt: string) {
    this.jwt = jwt;
  }

  connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      // Authenticate immediately
      this.ws!.send(JSON.stringify({
        type: 'auth',
        token: this.jwt
      }));
    });

    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);

      if (msg.v !== 1) {
        console.error('Unsupported protocol version:', msg.v);
        return;
      }

      switch (msg.type) {
        case 'ack':
          console.log('Authenticated:', msg.event);
          break;
        case 'event':
          this.handleEvent(msg.event, msg.payload);
          break;
        case 'error':
          console.error('Server error:', msg.error);
          break;
      }
    });

    this.ws.addEventListener('close', (event) => {
      console.log('Disconnected:', event.code, event.reason);
      // Implement reconnection logic here
    });

    this.ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private handleEvent(event: string, payload: any) {
    switch (event) {
      case 'room.created':
        console.log('Room created:', payload);
        break;
      case 'room.deleted':
        console.log('Room deleted:', payload);
        break;
      case 'voice.joined':
        console.log('User joined voice:', payload);
        break;
      case 'voice.left':
        console.log('User left voice:', payload);
        break;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }
}

// Usage
const ws = new SpellCovenWebSocket(jwtToken);
ws.connect('wss://your-domain.com/api/ws');
```

---

## Server Implementation Notes

### Backpressure Handling

Server MUST close connections with excessive bufferedAmount:

```typescript
function safeSend(ws: WebSocket, msg: string) {
  if (ws.readyState !== WebSocket.OPEN) return;
  
  if (ws.bufferedAmount > 1_000_000) { // 1MB
    ws.close(1013, 'overloaded');
    return;
  }
  
  try {
    ws.send(msg);
  } catch (error) {
    console.error('Failed to send:', error);
  }
}
```

### Broadcast to All Clients

```typescript
function broadcast(event: string, payload: any) {
  const msg = JSON.stringify({
    v: 1,
    type: 'event',
    event,
    payload,
    ts: Date.now(),
  });

  for (const ws of connectedClients) {
    safeSend(ws, msg);
  }
}
```

---

## Security Considerations

### JWT Verification

- Server MUST verify JWT signature using JWKS
- Server MUST check `exp` claim (expiration)
- Server MUST validate `iss` (issuer) and `aud` (audience)
- Server MUST close connection with 4401 if JWT invalid

### Rate Limiting

- Server MAY implement per-client rate limiting
- Server SHOULD close connections sending excessive messages
- Server SHOULD log suspicious activity

### Message Validation

- Server MUST validate all message formats
- Server MUST reject messages with unknown `type`
- Server MUST close connection on protocol violations

---

## Protocol Versioning

### Version 1 (Current)

- Initial protocol version
- Four event types: `room.created`, `room.deleted`, `voice.joined`, `voice.left`
- JWT authentication
- Error messages

### Future Versions

**Version 2 (Planned)**:
- Add `room.updated` event
- Add `voice.state_changed` event (mute/deaf)
- Add client → server messages (e.g., request channel list)

**Breaking Changes**:
- Clients MUST check `v` field and disconnect if unsupported
- Server MUST support backward compatibility for 1 major version

---

## Testing

### Manual Testing with wscat

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000/api/ws

# Send auth message
> {"type":"auth","token":"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."}

# Receive ACK
< {"v":1,"type":"ack","event":"auth.ok","guildId":"9876543210987654321"}

# Receive events
< {"v":1,"type":"event","event":"room.created","payload":{...},"ts":1730000000000}
```

### Automated Testing

```typescript
import { WebSocket } from 'ws';

describe('WebSocket Protocol', () => {
  it('should authenticate with valid JWT', async () => {
    const ws = new WebSocket('ws://localhost:3000/api/ws');
    
    await new Promise((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'auth', token: validJWT }));
      });
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        expect(msg.type).toBe('ack');
        expect(msg.event).toBe('auth.ok');
        resolve();
      });
    });
    
    ws.close();
  });
  
  it('should close connection with invalid JWT', async () => {
    const ws = new WebSocket('ws://localhost:3000/api/ws');
    
    await new Promise((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'auth', token: 'invalid' }));
      });
      
      ws.on('close', (code, reason) => {
        expect(code).toBe(4401);
        expect(reason.toString()).toBe('unauthorized');
        resolve();
      });
    });
  });
});
```

---

## References

- [WebSocket RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)
- [WebSocket Close Codes](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code)
- [JWT RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519)
