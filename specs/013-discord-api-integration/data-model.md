# Data Model: Discord API Integration

**Feature**: Discord API Integration for Remote MTG Play  
**Date**: 2025-10-21  
**Status**: Complete

## Overview

This document defines the data entities, schemas, and relationships for the Discord integration feature. All entities use versioned schemas for evolution and include validation rules.

## Entity Catalog

| Entity | Storage Location | Lifecycle | Version |
|--------|-----------------|-----------|---------|
| DiscordToken | Browser localStorage | Session (with refresh) | 1.0 |
| DiscordUser | Memory cache | Session | 1.0 |
| GatewayConnection | Memory (connection state) | Session | 1.0 |
| DiscordChannel | Memory cache (from API) | Session | 1.0 |
| GameRoom | Discord channel + memory | Game session | 1.0 |
| RoomMetadata | Discord channel topic/pinned | Persistent | 1.0 |
| DiscordMessage | Discord servers + memory cache | Persistent | 1.0 |
| GameEventEmbed | Discord message embeds | Persistent | 1.0 |
| VoiceState | Memory (from Gateway events) | Real-time | 1.0 |
| VideoStream | Memory (RTC connection) | Real-time | 1.0 |
| RtcConnection | Memory (connection state) | Session | 1.0 |

## Core Entities

### 1. DiscordToken

**Purpose**: OAuth2 authentication credentials for Discord API access

**Storage**: Browser localStorage (`discord_token` key)

**Schema** (Zod):
```typescript
const DiscordTokenSchema = z.object({
  version: z.literal("1.0"),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(),  // Unix timestamp (ms)
  scopes: z.array(z.string()),
  tokenType: z.literal("Bearer")
});

type DiscordToken = z.infer<typeof DiscordTokenSchema>;
```

**Validation Rules**:
- `accessToken` and `refreshToken` must be non-empty strings
- `expiresAt` must be future timestamp (> Date.now())
- `scopes` must include at minimum: `["identify", "guilds", "messages.read"]`
- `tokenType` must be "Bearer"

**State Transitions**:
1. **Created**: After successful OAuth token exchange
2. **Refreshed**: When `expiresAt - Date.now() < 5 minutes`
3. **Expired**: When `Date.now() > expiresAt` and refresh fails
4. **Revoked**: When user explicitly logs out or revokes permissions

**Relationships**:
- **Used by**: All Discord API calls (Gateway, REST, RTC)
- **Created by**: DiscordOAuthClient.exchangeCodeForToken()
- **Refreshed by**: DiscordOAuthClient.refreshToken()

---

### 2. DiscordUser

**Purpose**: Authenticated user's Discord profile information

**Storage**: Memory cache (fetched from Discord API)

**Schema** (Zod):
```typescript
const DiscordUserSchema = z.object({
  version: z.literal("1.0"),
  id: z.string().regex(/^\d+$/),  // Snowflake ID
  username: z.string().min(1).max(32),
  discriminator: z.string().regex(/^\d{4}$/),  // Legacy, may be "0" for new usernames
  avatar: z.string().nullable(),  // Avatar hash or null
  avatarUrl: z.string().url().optional(),  // Computed from avatar hash
  bot: z.boolean().optional(),
  system: z.boolean().optional(),
  flags: z.number().int().optional()
});

type DiscordUser = z.infer<typeof DiscordUserSchema>;
```

**Validation Rules**:
- `id` must be valid Discord snowflake (numeric string)
- `username` must be 1-32 characters
- `discriminator` must be 4 digits or "0"
- `avatar` is null if user has no custom avatar

**Computed Fields**:
- `avatarUrl`: Constructed from `avatar` hash using Discord CDN URL pattern

**Relationships**:
- **Fetched using**: DiscordToken
- **Displayed in**: DiscordUserProfile component, PlayerList component
- **Used for**: Message authorship, room ownership

---

### 3. GatewayConnection

**Purpose**: WebSocket connection state to Discord Gateway

**Storage**: Memory (connection manager state)

**Schema** (Zod):
```typescript
const GatewayConnectionSchema = z.object({
  version: z.literal("1.0"),
  state: z.enum(["disconnected", "connecting", "connected", "reconnecting", "error"]),
  sessionId: z.string().optional(),
  sequence: z.number().int().nonnegative().optional(),  // Last event sequence number
  heartbeatInterval: z.number().int().positive().optional(),  // Milliseconds
  lastHeartbeatAck: z.number().int().optional(),  // Timestamp
  reconnectAttempts: z.number().int().nonnegative().default(0),
  url: z.string().url().optional()  // Gateway URL from Discord
});

type GatewayConnection = z.infer<typeof GatewayConnectionSchema>;
```

**State Transitions**:
1. **disconnected** → **connecting**: User authenticates
2. **connecting** → **connected**: WebSocket HELLO received, heartbeat started
3. **connected** → **reconnecting**: Connection lost, attempting reconnect
4. **reconnecting** → **connected**: Reconnection successful
5. **reconnecting** → **error**: Max reconnect attempts exceeded
6. **connected** → **disconnected**: User logs out

**Validation Rules**:
- `heartbeatInterval` must match Discord's HELLO event value
- `sequence` must increment with each Gateway event
- `reconnectAttempts` resets to 0 on successful connection

**Relationships**:
- **Requires**: DiscordToken for authentication
- **Emits**: Gateway events (messages, voice state, presence)
- **Managed by**: DiscordGatewayClient

---

### 4. DiscordChannel

**Purpose**: Discord text or voice channel information

**Storage**: Memory cache (fetched from Discord API)

**Schema** (Zod):
```typescript
const DiscordChannelSchema = z.object({
  version: z.literal("1.0"),
  id: z.string().regex(/^\d+$/),  // Snowflake ID
  type: z.enum(["text", "voice", "category", "dm", "group_dm"]),
  guildId: z.string().regex(/^\d+$/).optional(),  // Null for DMs
  name: z.string().min(1).max(100),
  topic: z.string().max(1024).optional(),  // Channel topic (for metadata storage)
  position: z.number().int().nonnegative().optional(),
  permissions: z.number().int().optional(),  // Bitfield of user permissions
  occupancy: z.number().int().nonnegative().optional()  // Voice channel only
});

type DiscordChannel = z.infer<typeof DiscordChannelSchema>;
```

**Validation Rules**:
- `id` must be valid Discord snowflake
- `name` must be 1-100 characters
- `topic` limited to 1024 characters (Discord limit)
- `occupancy` only present for voice channels

**Relationships**:
- **Belongs to**: Discord guild (server)
- **Contains**: DiscordMessages (text channels) or VoiceStates (voice channels)
- **May store**: RoomMetadata in topic or pinned message

---

### 5. GameRoom

**Purpose**: Game session mapped to Discord voice channel

**Storage**: Memory (room manager state) + Discord channel

**Schema** (Zod):
```typescript
const GameRoomSchema = z.object({
  version: z.literal("1.0"),
  id: z.string().regex(/^\d+$/),  // Maps to Discord channel ID
  channelId: z.string().regex(/^\d+$/),  // Voice channel ID
  textChannelId: z.string().regex(/^\d+$/).optional(),  // Paired text channel
  state: z.enum(["lobby", "in_game", "completed"]),
  metadata: z.lazy(() => RoomMetadataSchema),  // Embedded metadata
  participants: z.array(z.string().regex(/^\d+$/)),  // Discord user IDs
  createdAt: z.string().datetime(),  // ISO 8601
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional()
});

type GameRoom = z.infer<typeof GameRoomSchema>;
```

**State Transitions**:
1. **lobby**: Room created, waiting for players
2. **in_game**: Game started, players actively playing
3. **completed**: Game finished, room ready for cleanup

**Validation Rules**:
- `id` matches `channelId` (room ID is channel ID)
- `participants` must have 2-4 players (MTG game constraint)
- `startedAt` must be after `createdAt`
- `completedAt` must be after `startedAt`

**Relationships**:
- **Maps to**: DiscordChannel (voice + text)
- **Contains**: RoomMetadata
- **Tracks**: VoiceStates of participants

---

### 6. RoomMetadata

**Purpose**: Game configuration stored in Discord channel

**Storage**: Discord channel topic or pinned message (JSON)

**Schema** (Zod):
```typescript
const RoomMetadataSchema = z.object({
  version: z.literal("1.0"),
  format: z.string().min(1).max(50),  // "Commander", "Standard", etc.
  powerLevel: z.number().int().min(1).max(10),  // 1-10 scale
  maxPlayers: z.number().int().min(2).max(4),
  createdAt: z.string().datetime(),  // ISO 8601
  customSettings: z.record(z.unknown()).optional()  // Extensible
});

type RoomMetadata = z.infer<typeof RoomMetadataSchema>;
```

**Serialization**:
- **Format**: JSON string
- **Storage**: Discord channel topic (if <1024 chars) or pinned message
- **Encoding**: UTF-8
- **Validation**: Parse and validate with Zod on read

**Validation Rules**:
- `format` must be non-empty (e.g., "Commander", "Standard", "Modern")
- `powerLevel` must be 1-10 (Commander power level scale)
- `maxPlayers` must be 2-4 (MTG game constraint)
- Total JSON size must be <1024 bytes for channel topic storage

**Relationships**:
- **Embedded in**: GameRoom
- **Stored in**: DiscordChannel.topic or pinned message
- **Validated by**: validators.ts utilities

---

### 7. DiscordMessage

**Purpose**: Text message in Discord channel

**Storage**: Discord servers (persistent) + memory cache (recent messages)

**Schema** (Zod):
```typescript
const DiscordMessageSchema = z.object({
  version: z.literal("1.0"),
  id: z.string().regex(/^\d+$/),  // Snowflake ID
  channelId: z.string().regex(/^\d+$/),
  authorId: z.string().regex(/^\d+$/),
  content: z.string().max(2000),  // Discord limit
  timestamp: z.string().datetime(),  // ISO 8601
  editedTimestamp: z.string().datetime().optional(),
  embeds: z.array(z.lazy(() => GameEventEmbedSchema)).optional(),
  type: z.enum(["default", "reply", "system"]).default("default")
});

type DiscordMessage = z.infer<typeof DiscordMessageSchema>;
```

**Validation Rules**:
- `content` limited to 2000 characters (Discord limit)
- `timestamp` must be valid ISO 8601 datetime
- `editedTimestamp` only present if message was edited

**Relationships**:
- **Belongs to**: DiscordChannel
- **Authored by**: DiscordUser
- **May contain**: GameEventEmbed(s)

---

### 8. GameEventEmbed

**Purpose**: Rich embed for game events (card lookups, state updates)

**Storage**: Discord message embeds (persistent)

**Schema** (Zod):
```typescript
const GameEventEmbedSchema = z.object({
  version: z.literal("1.0"),
  type: z.enum(["card_lookup", "life_total", "turn_change"]),
  timestamp: z.string().datetime(),  // ISO 8601
  color: z.number().int().min(0).max(0xFFFFFF).optional(),  // Hex color
  data: z.union([
    // Card lookup data
    z.object({
      cardName: z.string(),
      manaCost: z.string().optional(),
      oracleText: z.string().optional(),
      imageUrl: z.string().url().optional()
    }),
    // Life total data
    z.object({
      playerName: z.string(),
      oldLife: z.number().int(),
      newLife: z.number().int()
    }),
    // Turn change data
    z.object({
      turnNumber: z.number().int().positive(),
      activePlayer: z.string()
    })
  ])
});

type GameEventEmbed = z.infer<typeof GameEventEmbedSchema>;
```

**Color Coding**:
- `card_lookup`: 0x5865F2 (Discord blue)
- `life_total`: 0x57F287 (green) or 0xED4245 (red) based on change
- `turn_change`: 0xFEE75C (yellow)

**Validation Rules**:
- `type` determines which `data` union variant is valid
- `color` must be valid hex color (0x000000 to 0xFFFFFF)
- `data` must match the schema for the specified `type`

**Relationships**:
- **Embedded in**: DiscordMessage
- **Created by**: Game events (card recognition, life tracking, turn tracking)

---

### 9. VoiceState

**Purpose**: User's state in voice channel (muted, speaking, etc.)

**Storage**: Memory (updated from Gateway VOICE_STATE_UPDATE events)

**Schema** (Zod):
```typescript
const VoiceStateSchema = z.object({
  version: z.literal("1.0"),
  userId: z.string().regex(/^\d+$/),
  channelId: z.string().regex(/^\d+$/).optional(),  // Null if not in voice
  guildId: z.string().regex(/^\d+$/).optional(),
  selfMute: z.boolean(),
  selfDeaf: z.boolean(),
  serverMute: z.boolean(),
  serverDeaf: z.boolean(),
  speaking: z.boolean().optional(),  // Computed from audio activity
  videoStreaming: z.boolean().optional(),  // True if streaming video
  sessionId: z.string()
});

type VoiceState = z.infer<typeof VoiceStateSchema>;
```

**Validation Rules**:
- `channelId` is null if user not in voice channel
- `selfMute` and `selfDeaf` are user-controlled
- `serverMute` and `serverDeaf` are admin-controlled
- `speaking` derived from audio activity detection

**State Transitions**:
- User joins voice channel: `channelId` set, `sessionId` assigned
- User leaves voice channel: `channelId` set to null
- User toggles mute/deafen: Flags updated
- User starts video: `videoStreaming` set to true

**Relationships**:
- **Belongs to**: DiscordUser
- **Associated with**: DiscordChannel (voice)
- **Tracked in**: GameRoom participants

---

### 10. VideoStream

**Purpose**: Video feed from player's webcam

**Storage**: Memory (RTC connection state)

**Schema** (Zod):
```typescript
const VideoStreamSchema = z.object({
  version: z.literal("1.0"),
  streamId: z.string(),
  userId: z.string().regex(/^\d+$/),  // Source user
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  framerate: z.number().int().positive(),
  bitrate: z.number().int().positive(),  // bits per second
  codec: z.string(),  // "VP8", "VP9", "H264"
  health: z.object({
    packetLoss: z.number().min(0).max(1),  // 0-1 (percentage)
    latency: z.number().int().nonnegative(),  // milliseconds
    jitter: z.number().int().nonnegative()  // milliseconds
  })
});

type VideoStream = z.infer<typeof VideoStreamSchema>;
```

**Validation Rules**:
- `resolution` must be valid video dimensions (e.g., 1280x720, 1920x1080)
- `framerate` typically 24, 30, or 60 fps
- `bitrate` depends on quality tier (480p: ~500kbps, 720p: ~1.5Mbps)
- `packetLoss` is percentage (0.0 to 1.0)

**Quality Tiers**:
- **480p**: 640x480, 30fps, ~500kbps (standard users)
- **720p**: 1280x720, 30fps, ~1.5Mbps (Nitro users)
- **1080p**: 1920x1080, 30fps, ~3Mbps (Nitro users, optional)

**Relationships**:
- **Belongs to**: DiscordUser
- **Managed by**: RtcConnection
- **Processed by**: Card recognition pipeline (VideoFrameAdapter)

---

### 11. RtcConnection

**Purpose**: Discord RTC connection for video/voice streaming

**Storage**: Memory (connection state)

**Schema** (Zod):
```typescript
const RtcConnectionSchema = z.object({
  version: z.literal("1.0"),
  state: z.enum(["disconnected", "connecting", "connected", "reconnecting", "error"]),
  channelId: z.string().regex(/^\d+$/),
  udpEndpoint: z.object({
    host: z.string(),
    port: z.number().int().positive()
  }).optional(),
  encryptionKey: z.string().optional(),  // Base64 encoded
  supportedCodecs: z.array(z.string()),
  qualitySettings: z.object({
    resolution: z.enum(["480p", "720p", "1080p"]),
    framerate: z.number().int().positive(),
    bitrate: z.number().int().positive()
  })
});

type RtcConnection = z.infer<typeof RtcConnectionSchema>;
```

**State Transitions**:
1. **disconnected** → **connecting**: User starts video
2. **connecting** → **connected**: RTC handshake complete
3. **connected** → **reconnecting**: Network interruption
4. **reconnecting** → **connected**: Reconnection successful
5. **connected** → **disconnected**: User stops video

**Validation Rules**:
- `udpEndpoint` provided by Discord during RTC handshake
- `encryptionKey` required for secure RTC communication
- `supportedCodecs` must include at least one video codec (VP8, VP9, H264)

**Relationships**:
- **Requires**: VoiceState (user must be in voice channel)
- **Manages**: VideoStream(s)
- **Uses**: DiscordToken for authentication

---

## Data Flow Diagrams

### OAuth Authentication Flow
```
User → DiscordOAuthClient.generatePKCE()
     → Discord OAuth (code_challenge)
     → Discord callback (authorization code)
     → DiscordOAuthClient.exchangeCodeForToken(code, code_verifier)
     → DiscordToken (stored in localStorage)
     → useDiscordAuth() hook
     → UI components
```

### Message Flow
```
Discord Gateway (MESSAGE_CREATE event)
     → DiscordGatewayClient (parse event)
     → messageStore (cache)
     → useDiscordMessages() hook
     → MessageList component

User types message
     → MessageInput component
     → useSendMessage() hook
     → DiscordRestClient.sendMessage()
     → Discord REST API
     → Discord Gateway (MESSAGE_CREATE event to all users)
```

### Room Creation Flow
```
User creates game
     → RoomCreator component
     → useGameRoom() hook
     → DiscordRestClient.createVoiceChannel()
     → Discord REST API (create channel)
     → DiscordRestClient.updateChannelTopic(RoomMetadata)
     → GameRoom (memory)
     → roomStore (state management)
```

### Video Streaming Flow
```
User starts video
     → StreamControls component
     → useDiscordVideo() hook
     → DiscordRtcClient.connect()
     → Discord RTC handshake
     → RtcConnection (established)
     → useVideoStream() hook (MediaStream API)
     → DiscordRtcClient.startVideo(MediaStream)
     → VideoStream (sent to Discord)
     → Remote users receive via RtcConnection
     → VideoGrid component (display)
     → VideoFrameAdapter (card recognition)
```

## Schema Evolution Strategy

### Version Bumps
- **MAJOR (2.0)**: Breaking changes (removed fields, incompatible types)
- **MINOR (1.1)**: New optional fields, expanded enums
- **PATCH (1.0.1)**: Documentation clarifications (no schema changes)

### Migration Path
1. Detect version mismatch during validation
2. Log warning with migration instructions
3. Attempt automatic migration if possible
4. Fall back to re-authentication or data reset if migration fails

### Example Migration (1.0 → 1.1):
```typescript
function migrateDiscordToken(data: unknown): DiscordToken {
  const parsed = DiscordTokenSchema_v1_0.parse(data);
  
  // Add new optional field in v1.1
  return {
    ...parsed,
    version: "1.1",
    newField: "default_value"
  };
}
```

## Validation Error Handling

All schemas use Zod for validation with clear error messages:

```typescript
try {
  const token = DiscordTokenSchema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Token validation failed:", error.errors);
    // Example error: [{ path: ["expiresAt"], message: "Expected number, received string" }]
  }
}
```

## Next Steps

1. Generate API contracts in `/contracts/` directory
2. Implement Zod schemas in `@repo/discord-integration/src/types/`
3. Implement validation utilities in `@repo/discord-integration/src/utils/validators.ts`
4. Create quickstart guide for Discord Developer Portal setup
5. Update agent context with data model

## Data Model Complete

All entities, schemas, and relationships have been defined. Proceed to contract generation.
