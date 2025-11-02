# Data Model: Discord Gateway Real-Time Event System

**Feature**: Discord Gateway Real-Time Event System  
**Date**: 2025-01-02  
**Status**: Complete

## Overview

This document defines the data entities, relationships, and state transitions for the Discord Gateway real-time event system. All entities are defined using TypeScript interfaces with Zod schemas for runtime validation.

## Core Entities

### 1. Voice Channel Event

**Purpose**: Represents a change in voice channel state (user joined, user left, channel created, channel deleted)

**TypeScript Interface**:
```typescript
// @repo/discord-integration/src/types/events.ts

export type DiscordSnowflake = string // Discord ID format

export type VoiceEventName = 
  | 'voice.joined'
  | 'voice.left'
  | 'room.created'
  | 'room.deleted'

export interface VoiceJoinedPayload {
  guildId: DiscordSnowflake
  channelId: DiscordSnowflake
  userId: DiscordSnowflake
  username: string
  avatar: string | null
}

export interface VoiceLeftPayload {
  guildId: DiscordSnowflake
  channelId: null  // Always null for leave events
  userId: DiscordSnowflake
}

export interface RoomCreatedPayload {
  guildId: DiscordSnowflake
  channelId: DiscordSnowflake
  name: string
  parentId?: DiscordSnowflake
  userLimit: number  // Max 4 per spec
}

export interface RoomDeletedPayload {
  guildId: DiscordSnowflake
  channelId: DiscordSnowflake
}
```

**Zod Schema**:
```typescript
import { z } from 'zod'

export const DiscordSnowflakeSchema = z.string().regex(/^\d{17,19}$/)

export const VoiceJoinedPayloadSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  channelId: DiscordSnowflakeSchema,
  userId: DiscordSnowflakeSchema,
  username: z.string().min(1).max(32),
  avatar: z.string().nullable(),
})

export const VoiceLeftPayloadSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  channelId: z.null(),
  userId: DiscordSnowflakeSchema,
})

export const RoomCreatedPayloadSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  channelId: DiscordSnowflakeSchema,
  name: z.string().min(1).max(100),
  parentId: DiscordSnowflakeSchema.optional(),
  userLimit: z.number().int().min(0).max(4),  // Enforced: max 4 players
})

export const RoomDeletedPayloadSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  channelId: DiscordSnowflakeSchema,
})
```

**Attributes**:
- `guildId`: Discord guild (server) ID
- `channelId`: Discord voice channel ID (null for leave events)
- `userId`: Discord user ID
- `username`: User's Discord username
- `avatar`: User's avatar hash (null if no avatar)
- `name`: Channel name (for room created)
- `parentId`: Parent category ID (optional)
- `userLimit`: Maximum users in channel (0-4)

**Relationships**:
- Belongs to a Guild (Discord server)
- References a User (Discord user)
- References a Channel (Discord voice channel)

**Lifecycle**:
- Created when Discord Gateway sends VOICE_STATE_UPDATE
- Broadcast to all authenticated WebSocket clients in guild
- No persistence (stateless, in-memory only)

---

### 2. Game Room

**Purpose**: Represents a private gaming session with an associated Discord voice channel, role, and list of participants

**TypeScript Interface**:
```typescript
// apps/web/src/server/types/game-room.ts

export interface GameRoom {
  id: DiscordSnowflake  // Same as channelId
  guildId: DiscordSnowflake
  channelId: DiscordSnowflake
  roleId: DiscordSnowflake
  name: string
  creatorId: DiscordSnowflake
  participants: Set<DiscordSnowflake>  // User IDs currently in room
  maxPlayers: 4  // Hard limit per spec
  createdAt: number  // Unix timestamp
  lastActivity: number  // Unix timestamp
  inviteToken: string  // JWT token
  tokenExpiry: number  // Unix timestamp (24 hours from creation)
}
```

**Zod Schema**:
```typescript
export const GameRoomSchema = z.object({
  id: DiscordSnowflakeSchema,
  guildId: DiscordSnowflakeSchema,
  channelId: DiscordSnowflakeSchema,
  roleId: DiscordSnowflakeSchema,
  name: z.string().min(1).max(100),
  creatorId: DiscordSnowflakeSchema,
  participants: z.set(DiscordSnowflakeSchema),
  maxPlayers: z.literal(4),  // Always 4 per spec
  createdAt: z.number().int().positive(),
  lastActivity: z.number().int().positive(),
  inviteToken: z.string(),
  tokenExpiry: z.number().int().positive(),
})
```

**Attributes**:
- `id`: Unique identifier (same as channelId)
- `guildId`: Discord guild ID
- `channelId`: Discord voice channel ID
- `roleId`: Discord role ID for access control
- `name`: Room name (user-provided)
- `creatorId`: Discord user ID of creator
- `participants`: Set of user IDs currently in room
- `maxPlayers`: Always 4 (hard limit)
- `createdAt`: Room creation timestamp
- `lastActivity`: Last activity timestamp (for cleanup)
- `inviteToken`: JWT token for joining
- `tokenExpiry`: Token expiry timestamp (24 hours)

**Relationships**:
- Has one Discord voice channel
- Has one Discord role (for permissions)
- Has one creator (Discord user)
- Has many participants (Discord users, max 4)

**State Transitions**:
```
[Created] → [Active] → [Inactive] → [Deleted]
    ↓          ↓           ↓
    └──────────┴───────────┘
         (Manual Close)
```

**State Definitions**:
- **Created**: Room just created, no participants yet
- **Active**: At least one participant in room or viewing game room page
- **Inactive**: No participants for >1 hour
- **Deleted**: Room cleaned up (channel and role deleted)

**Validation Rules**:
- Name must be 1-100 characters
- Max 4 participants at any time
- Token expires after 24 hours
- Cleanup after 1 hour of inactivity
- Creator must be authenticated Discord user

---

### 3. User Session

**Purpose**: Represents an authenticated user's connection to the web application

**TypeScript Interface**:
```typescript
// apps/web/src/server/types/session.ts

export interface UserSession {
  userId: DiscordSnowflake
  accessToken: string  // Discord OAuth access token
  refreshToken: string  // Discord OAuth refresh token
  tokenExpiry: number  // Unix timestamp
  username: string
  discriminator: string
  avatar: string | null
  guildId: DiscordSnowflake
  createdAt: number
  lastActivity: number
}
```

**Zod Schema**:
```typescript
export const UserSessionSchema = z.object({
  userId: DiscordSnowflakeSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenExpiry: z.number().int().positive(),
  username: z.string().min(1).max(32),
  discriminator: z.string().regex(/^\d{4}$/),
  avatar: z.string().nullable(),
  guildId: DiscordSnowflakeSchema,
  createdAt: z.number().int().positive(),
  lastActivity: z.number().int().positive(),
})
```

**Attributes**:
- `userId`: Discord user ID
- `accessToken`: OAuth access token (encrypted in cookie)
- `refreshToken`: OAuth refresh token (encrypted in cookie)
- `tokenExpiry`: Token expiry timestamp
- `username`: Discord username
- `discriminator`: Discord discriminator (#0000)
- `avatar`: Avatar hash
- `guildId`: Primary guild ID
- `createdAt`: Session creation timestamp
- `lastActivity`: Last activity timestamp

**Relationships**:
- Belongs to one Discord user
- Belongs to one Discord guild
- Has many WebSocket connections (0-N)

**Lifecycle**:
1. Created after successful Discord OAuth2 flow
2. Stored in encrypted HTTP-only cookie
3. Validated on every request
4. Refreshed silently when expired (if refresh token valid)
5. Deleted on logout or refresh failure

**Security**:
- Stored in HTTP-only, Secure, SameSite=Lax cookie
- Access token encrypted with SESSION_SECRET
- Refresh token encrypted with SESSION_SECRET
- Never exposed to browser JavaScript

---

### 4. Discord Gateway Connection

**Purpose**: Represents the persistent WebSocket connection to Discord's Gateway API

**TypeScript Interface**:
```typescript
// @repo/discord-gateway/src/types.ts

export type ConnectionState = 
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'IDENTIFYING'
  | 'CONNECTED'
  | 'RECONNECTING'

export interface GatewaySession {
  sessionId: string | null
  sequence: number | null
  resumeGatewayUrl: string | null
}

export interface DiscordGatewayConnection {
  state: ConnectionState
  session: GatewaySession
  heartbeatInterval: number | null
  lastHeartbeat: number | null
  lastHeartbeatAck: number | null
  reconnectAttempts: number
  maxReconnectAttempts: 5  // Per spec
}
```

**Attributes**:
- `state`: Current connection state
- `session`: Session information for resumption
- `heartbeatInterval`: Heartbeat interval from Discord (ms)
- `lastHeartbeat`: Last heartbeat sent timestamp
- `lastHeartbeatAck`: Last heartbeat ACK received timestamp
- `reconnectAttempts`: Current reconnection attempt count
- `maxReconnectAttempts`: Maximum attempts (5)

**State Transitions**:
```
[DISCONNECTED] → [CONNECTING] → [IDENTIFYING] → [CONNECTED]
      ↑              ↓               ↓              ↓
      └──────────────┴───────────────┴──────────────┘
                    (Reconnect with backoff)
```

**Reconnection Strategy**:
- Exponential backoff: 1s → 2s → 4s → 8s → 16s
- Max 5 attempts before giving up
- Attempt session resumption if session ID available
- Log all reconnection attempts

---

### 5. Invite Token

**Purpose**: Represents a time-limited, cryptographically signed token that grants access to a specific game room

**TypeScript Interface**:
```typescript
// apps/web/src/server/types/invite-token.ts

export interface InviteTokenPayload {
  guildId: DiscordSnowflake
  channelId: DiscordSnowflake
  roleId: DiscordSnowflakeSchema
  creatorId: DiscordSnowflake
  exp: number  // Unix timestamp (24 hours from creation)
  iat: number  // Issued at timestamp
}
```

**JWT Structure**:
```json
{
  "guildId": "123456789012345678",
  "channelId": "123456789012345678",
  "roleId": "123456789012345678",
  "creatorId": "123456789012345678",
  "exp": 1704326400,
  "iat": 1704240000
}
```

**Zod Schema**:
```typescript
export const InviteTokenPayloadSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  channelId: DiscordSnowflakeSchema,
  roleId: DiscordSnowflakeSchema,
  creatorId: DiscordSnowflakeSchema,
  exp: z.number().int().positive(),
  iat: z.number().int().positive(),
})
```

**Attributes**:
- `guildId`: Discord guild ID
- `channelId`: Discord voice channel ID
- `roleId`: Discord role ID for permissions
- `creatorId`: Discord user ID of creator
- `exp`: Expiry timestamp (24 hours from creation)
- `iat`: Issued at timestamp

**Validation Rules**:
- Must be signed with SESSION_SECRET
- Must not be expired (exp > Date.now())
- Must contain all required fields
- Cannot be tampered with (signature verification)

**Lifecycle**:
1. Created when room is created
2. Included in invite URL
3. Validated when user joins room
4. Expires after 24 hours
5. Single-use (not enforced, but recommended)

---

### 6. WebSocket Connection

**Purpose**: Represents a browser client's WebSocket connection to the server

**TypeScript Interface**:
```typescript
// apps/web/src/server/types/websocket.ts

export interface WebSocketConnection {
  userId: DiscordSnowflake
  guildId: DiscordSnowflake
  ws: WebSocket  // Native WebSocket object
  authenticated: boolean
  connectedAt: number
  lastActivity: number
}

export interface WebSocketMessage {
  v: 1  // Protocol version
  type: 'event' | 'ack' | 'error' | 'auth'
  event?: string  // Event name (for type='event')
  payload?: unknown  // Event payload
  error?: string  // Error message (for type='error')
  ts: number  // Timestamp
}
```

**Zod Schema**:
```typescript
export const WebSocketMessageSchema = z.object({
  v: z.literal(1),
  type: z.enum(['event', 'ack', 'error', 'auth']),
  event: z.string().optional(),
  payload: z.unknown().optional(),
  error: z.string().optional(),
  ts: z.number().int().positive(),
})
```

**Attributes**:
- `userId`: Discord user ID
- `guildId`: Discord guild ID
- `ws`: WebSocket connection object
- `authenticated`: Whether connection is authenticated
- `connectedAt`: Connection timestamp
- `lastActivity`: Last activity timestamp

**Lifecycle**:
1. Client connects to `/api/ws`
2. Client sends auth message with JWT
3. Server validates JWT (5-second timeout)
4. Server registers connection in WebSocket manager
5. Server sends `auth.ok` acknowledgment
6. Connection ready for events
7. Heartbeat every 15 seconds
8. Cleanup on disconnect

**Message Types**:
- `auth`: Client authentication request
- `ack`: Server acknowledgment
- `event`: Server event broadcast
- `error`: Server error message

---

## Entity Relationships

```
┌─────────────────┐
│   Discord       │
│   Guild         │
└────────┬────────┘
         │
         │ has many
         ▼
┌─────────────────┐      creates      ┌─────────────────┐
│   Game Room     │◄──────────────────│   User Session  │
└────────┬────────┘                   └────────┬────────┘
         │                                     │
         │ has one                             │ has many
         ▼                                     ▼
┌─────────────────┐                   ┌─────────────────┐
│   Voice         │                   │   WebSocket     │
│   Channel       │                   │   Connection    │
└─────────────────┘                   └─────────────────┘
         │
         │ generates
         ▼
┌─────────────────┐
│   Voice         │
│   Channel Event │
└─────────────────┘
         │
         │ broadcast to
         ▼
┌─────────────────┐
│   WebSocket     │
│   Connection    │
└─────────────────┘
```

## Data Flow

### Room Creation Flow

```
1. User clicks "Create Room"
2. Client calls createRoom() server function
3. Server validates session
4. Server creates Discord voice channel (max 4 players)
5. Server creates Discord role with permissions
6. Server generates invite token (24-hour expiry)
7. Server stores room in registry
8. Server returns { channelId, inviteToken }
9. Client redirects to /game/{channelId}
```

### Voice Channel Join Flow

```
1. User joins Discord voice channel
2. Discord sends VOICE_STATE_UPDATE to Gateway
3. Gateway client receives event
4. Gateway posts to /api/internal/events
5. WebSocket manager broadcasts to guild
6. All connected clients receive voice.joined event
7. Clients update UI (player list, video grid)
```

### Room Cleanup Flow

```
1. Background job runs every 5 minutes
2. Check all rooms for lastActivity
3. If lastActivity > 1 hour ago:
   a. Send warning to connected clients (30s)
   b. Delete Discord voice channel
   c. Delete Discord role
   d. Remove from registry
   e. Broadcast room.deleted event
4. Connected clients redirect to home
```

## Storage Strategy

**Current (MVP)**:
- In-memory only (stateless)
- No database
- Session in encrypted cookies
- Room registry in memory (Map)
- WebSocket connections in memory (Map)

**Future (Horizontal Scaling)**:
- Redis for session storage
- Redis for room registry
- Redis Pub/Sub for event bus
- PostgreSQL for event history (optional)

## Validation Summary

All entities use Zod schemas for runtime validation:
- ✅ Type safety with TypeScript
- ✅ Runtime validation with Zod
- ✅ Clear error messages
- ✅ Automatic serialization/deserialization
- ✅ Version compatibility checks

## References

- Feature Spec: `/specs/017-discord-gateway-real/spec.md`
- Technical Spec: `/specs/017-discord-gateway-real/spec-discord-gateway.md`
- Research: `/specs/017-discord-gateway-real/research.md`
