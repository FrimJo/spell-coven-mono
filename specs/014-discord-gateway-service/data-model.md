# Data Model: Discord Gateway Service

**Phase**: 1 (Design)  
**Date**: 2025-10-26

## Overview

This document defines the data entities, message contracts, and state models for the Discord Gateway service. All contracts use TypeScript types with Zod validation for runtime safety.

**Video Streaming Context**: Discord voice channels support both audio and video streaming. The `selfVideo` flag in `VoiceState` indicates when a user has their webcam enabled. Players use Discord video to show their board state, while card recognition runs locally in each browser on the Discord video streams.

---

## Core Entities

### 1. Discord Channel

Represents a Discord voice channel created for game sessions.

```typescript
import { z } from 'zod';

export const DiscordChannelSchema = z.object({
  id: z.string().regex(/^\d+$/), // Snowflake ID
  name: z.string().min(1).max(100),
  type: z.literal(2), // Voice channel
  guildId: z.string().regex(/^\d+$/),
  parentId: z.string().regex(/^\d+$/).optional(),
  userLimit: z.number().int().min(0).max(99).default(4),
  position: z.number().int().optional(),
});

export type DiscordChannel = z.infer<typeof DiscordChannelSchema>;
```

**Validation Rules**:
- `id`: Discord snowflake (numeric string)
- `name`: 1-100 characters
- `type`: Must be 2 (voice channel)
- `guildId`: Discord snowflake
- `userLimit`: 0-99 (0 = unlimited)

---

### 2. Voice State

Represents a user's voice connection state.

```typescript
export const VoiceStateSchema = z.object({
  guildId: z.string().regex(/^\d+$/),
  channelId: z.string().regex(/^\d+$/).nullable(),
  userId: z.string().regex(/^\d+$/),
  sessionId: z.string().optional(),
  deaf: z.boolean().optional(),
  mute: z.boolean().optional(),
  selfDeaf: z.boolean().optional(),
  selfMute: z.boolean().optional(),
  selfVideo: z.boolean().optional(),
  suppress: z.boolean().optional(),
});

export type VoiceState = z.infer<typeof VoiceStateSchema>;
```

**State Transitions**:
- `channelId !== null`: User joined voice channel
- `channelId === null`: User left voice channel
- `selfVideo === true`: User enabled webcam (streaming board state)
- `selfVideo === false`: User disabled webcam

**Note**: The `selfVideo` flag is crucial for the application - it indicates when a player is streaming their board state via webcam through Discord. Other players' browsers can then run card recognition on this video stream.

---

### 3. WebSocket Message Envelope

All WebSocket messages use a versioned envelope format.

```typescript
export const MessageEnvelopeSchema = z.object({
  v: z.literal(1), // Protocol version
  type: z.enum(['event', 'ack', 'error']),
  event: z.string().optional(),
  payload: z.unknown(),
  ts: z.number().int().positive(), // Unix timestamp (ms)
});

export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;
```

**Version History**:
- `v: 1` - Initial version (current)

---

## Event Payloads

### 4. Room Created Event

Emitted when a voice channel is created.

```typescript
export const RoomCreatedPayloadSchema = z.object({
  channelId: z.string().regex(/^\d+$/),
  name: z.string(),
  guildId: z.string().regex(/^\d+$/),
  parentId: z.string().regex(/^\d+$/).optional(),
  userLimit: z.number().int().min(0).max(99),
});

export type RoomCreatedPayload = z.infer<typeof RoomCreatedPayloadSchema>;
```

**Example**:
```json
{
  "v": 1,
  "type": "event",
  "event": "room.created",
  "payload": {
    "channelId": "1234567890123456789",
    "name": "spell-coven-abc123",
    "guildId": "9876543210987654321",
    "userLimit": 4
  },
  "ts": 1730000000000
}
```

---

### 5. Room Deleted Event

Emitted when a voice channel is deleted.

```typescript
export const RoomDeletedPayloadSchema = z.object({
  channelId: z.string().regex(/^\d+$/),
  guildId: z.string().regex(/^\d+$/),
});

export type RoomDeletedPayload = z.infer<typeof RoomDeletedPayloadSchema>;
```

**Example**:
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

---

### 6. Voice Joined Event

Emitted when a user joins a voice channel.

```typescript
export const VoiceJoinedPayloadSchema = z.object({
  guildId: z.string().regex(/^\d+$/),
  channelId: z.string().regex(/^\d+$/),
  userId: z.string().regex(/^\d+$/),
});

export type VoiceJoinedPayload = z.infer<typeof VoiceJoinedPayloadSchema>;
```

**Example**:
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

---

### 7. Voice Left Event

Emitted when a user leaves a voice channel.

```typescript
export const VoiceLeftPayloadSchema = z.object({
  guildId: z.string().regex(/^\d+$/),
  channelId: z.string().regex(/^\d+$/).nullable(),
  userId: z.string().regex(/^\d+$/),
});

export type VoiceLeftPayload = z.infer<typeof VoiceLeftPayloadSchema>;
```

**Example**:
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

---

## HTTP Request/Response Contracts

### 8. Create Room Request

```typescript
export const CreateRoomRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().regex(/^\d+$/).optional(),
  userLimit: z.number().int().min(0).max(99).default(4),
});

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
```

**HTTP**:
```http
POST /api/create-room
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "spell-coven-abc123",
  "parentId": "1234567890123456789",
  "userLimit": 4
}
```

**Response**:
```typescript
export const CreateRoomResponseSchema = z.object({
  channelId: z.string().regex(/^\d+$/),
  name: z.string(),
  guildId: z.string().regex(/^\d+$/),
});

export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;
```

```json
{
  "channelId": "1234567890123456789",
  "name": "spell-coven-abc123",
  "guildId": "9876543210987654321"
}
```

---

### 9. Delete Room Request

```http
DELETE /api/end-room/:channelId
Authorization: Bearer <jwt>
```

**Response**:
```typescript
export const DeleteRoomResponseSchema = z.object({
  ok: z.literal(true),
});

export type DeleteRoomResponse = z.infer<typeof DeleteRoomResponseSchema>;
```

```json
{
  "ok": true
}
```

---

## Internal Webhook Contract

### 10. Internal Event Message

Worker → TanStack Start communication.

```typescript
export const InternalEventSchema = z.object({
  event: z.enum(['room.created', 'room.deleted', 'voice.joined', 'voice.left']),
  payload: z.union([
    RoomCreatedPayloadSchema,
    RoomDeletedPayloadSchema,
    VoiceJoinedPayloadSchema,
    VoiceLeftPayloadSchema,
  ]),
});

export type InternalEvent = z.infer<typeof InternalEventSchema>;
```

**HTTP Headers**:
```
X-Hub-Timestamp: 1730000000
X-Hub-Signature: sha256=abc123...
Content-Type: application/json
```

**Body**:
```json
{
  "event": "voice.joined",
  "payload": {
    "guildId": "9876543210987654321",
    "channelId": "1234567890123456789",
    "userId": "1111111111111111111"
  }
}
```

**HMAC Calculation**:
```typescript
const timestamp = Math.floor(Date.now() / 1000);
const body = JSON.stringify({ event, payload });
const message = `${timestamp}.${body}`;
const signature = crypto
  .createHmac('sha256', HUB_SECRET)
  .update(message)
  .digest('hex');
```

---

## Authentication Contracts

### 11. JWT Claims

```typescript
export const JWTClaimsSchema = z.object({
  iss: z.string().url(), // Issuer (IdP URL)
  aud: z.string(), // Audience (app identifier)
  sub: z.string(), // Subject (user ID)
  exp: z.number().int().positive(), // Expiration (Unix timestamp)
  iat: z.number().int().positive().optional(), // Issued at
  // Future: guilds: z.array(z.string()).optional()
});

export type JWTClaims = z.infer<typeof JWTClaimsSchema>;
```

**Example**:
```json
{
  "iss": "https://auth.example.com",
  "aud": "spell-coven-web",
  "sub": "user_abc123",
  "exp": 1730000000,
  "iat": 1729999000
}
```

---

### 12. WebSocket Auth Message

Client → TanStack Start authentication.

```typescript
export const WSAuthMessageSchema = z.object({
  type: z.literal('auth'),
  token: z.string().min(1),
});

export type WSAuthMessage = z.infer<typeof WSAuthMessageSchema>;
```

**Example**:
```json
{
  "type": "auth",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (ACK)**:
```json
{
  "v": 1,
  "type": "ack",
  "event": "auth.ok",
  "guildId": "9876543210987654321"
}
```

---

## Error Responses

### 13. Error Envelope

```typescript
export const ErrorEnvelopeSchema = z.object({
  v: z.literal(1),
  type: z.literal('error'),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  ts: z.number().int().positive(),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
```

**Example**:
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
- `NOT_FOUND`: Channel or resource not found
- `RATE_LIMITED`: Discord API rate limit exceeded
- `INTERNAL_ERROR`: Unexpected server error

---

## State Diagrams

### Gateway Worker Connection State

```
┌─────────────┐
│ DISCONNECTED│
└──────┬──────┘
       │ connect()
       ▼
┌─────────────┐
│ CONNECTING  │
└──────┬──────┘
       │ HELLO (op 10)
       ▼
┌─────────────┐     RECONNECT (op 7)
│ IDENTIFYING │◄────────────────────┐
└──────┬──────┘                     │
       │ READY (t=READY)            │
       ▼                             │
┌─────────────┐                     │
│  CONNECTED  │─────────────────────┘
└──────┬──────┘
       │ close / error
       ▼
┌─────────────┐
│ RECONNECTING│
└──────┬──────┘
       │ session_id exists?
       ├─ Yes: RESUME (op 6)
       └─ No: IDENTIFY (op 2)
```

### WebSocket Client Connection State

```
┌─────────────┐
│ DISCONNECTED│
└──────┬──────┘
       │ new WebSocket()
       ▼
┌─────────────┐
│ CONNECTING  │
└──────┬──────┘
       │ onopen
       ▼
┌─────────────┐
│ AUTHENTICATING│
└──────┬──────┘
       │ send({ type: 'auth', token })
       ▼
┌─────────────┐
│ AUTHENTICATED│
└──────┬──────┘
       │ receive events
       ▼
┌─────────────┐
│  CONNECTED  │
└──────┬──────┘
       │ onclose / onerror
       ▼
┌─────────────┐
│ DISCONNECTED│
└─────────────┘
```

---

## Validation Rules Summary

| Field | Type | Constraints | Error Message |
|-------|------|-------------|---------------|
| `channelId` | string | Regex: `^\d+$` | "Invalid Discord snowflake ID" |
| `guildId` | string | Regex: `^\d+$` | "Invalid Discord snowflake ID" |
| `userId` | string | Regex: `^\d+$` | "Invalid Discord snowflake ID" |
| `name` | string | 1-100 chars | "Channel name must be 1-100 characters" |
| `userLimit` | number | 0-99 | "User limit must be between 0 and 99" |
| `type` | number | Must be 2 | "Channel type must be 2 (voice)" |
| `v` | number | Must be 1 | "Unsupported protocol version" |
| `timestamp` | number | >0, within 60s | "Invalid or expired timestamp" |

---

## Contract Versioning

### Version 1 (Current)

- Initial message envelope format
- Four event types: `room.created`, `room.deleted`, `voice.joined`, `voice.left`
- HMAC signature verification
- JWT authentication

### Future Versions

**Version 2 (Planned)**:
- Add `guilds` claim to JWT for multi-guild support
- Add `room.updated` event for channel modifications
- Add `voice.state_changed` event for mute/deaf/video changes
- Add `video.enabled` and `video.disabled` events for explicit video state tracking

**Breaking Changes**:
- Clients MUST check `v` field and reject unsupported versions
- Backend MUST support backward compatibility for 1 major version

---

## References

- [Zod Documentation](https://zod.dev/)
- [Discord API Types](https://discord-api-types.dev/)
- [Discord Snowflake IDs](https://discord.com/developers/docs/reference#snowflakes)
- [JWT Claims](https://datatracker.ietf.org/doc/html/rfc7519#section-4)
