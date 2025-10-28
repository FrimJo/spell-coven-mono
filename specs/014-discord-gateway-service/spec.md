# Feature Specification: Discord Gateway Service

**Version**: 1.0.0
**Status**: COMPLETE (All User Stories Implemented)
**Branch**: `014-discord-gateway-service`
**Reference**: [spell-coven-gateway-realtime-guide_v2.2.md](../../spell-coven-gateway-realtime-guide_v2.2.md)

## Overview

Implement a production-ready Discord Gateway integration that enables real-time voice channel management and event streaming for Spell Coven. Discord provides the **required communication infrastructure** - room management, voice chat, and **video streaming** (players stream webcams showing board state). While card recognition runs locally in each browser, Discord is **essential** for players to see each other's boards.

The system consists of three components:

1. **Discord Gateway Worker** - Persistent WebSocket connection to Discord Gateway
2. **TanStack Start Backend** - Public API for room management + WebSocket hub for client events
3. **Client Libraries** - Complete DiscordRestClient and DiscordRtcClient implementations

**Scope**: Discord integration provides communication infrastructure:
- **Discord handles** (required): Room management, voice chat, **video streaming** (webcam for board state viewing), text chat
- **Browser handles** (local): Card recognition on Discord video streams (CLIP/FAISS), game state, game tools

**Key Architecture**: Players stream their webcam (showing board state) through Discord voice channels. Each player's browser watches the Discord video streams and runs card recognition locally. Discord = communication layer; Browser = intelligence layer.

## Clarifications

### Session 2025-10-26

- Q: Gateway Worker Deployment Strategy → A: Separate deployment with health checks and auto-restart (e.g., systemd, Docker with restart policy)
- Q: Error Recovery for Failed Discord API Calls → A: Retry with exponential backoff (max 3 retries), then return error to client
- Q: WebSocket Client Reconnection Behavior → A: Auto-reconnect with exponential backoff (max 5 attempts), then require manual reconnect
- Q: Logging Level for Production → A: INFO
- Q: DiscordRtcClient Audio Format → A: Opus codec at 48kHz (Discord standard)
- Q: Video Codec Priority for Discord Streaming → A: VP8 (widely supported, good balance, royalty-free)

## User Stories

### US1: As a player, I want to create Discord voice channels for game sessions

**Acceptance Criteria:**
- User can call `/api/create-room` with optional parent category and user limit
- System creates voice channel in configured Discord guild
- System returns channel ID, name, and guild ID
- All connected WebSocket clients receive `room.created` event
- Channel creation fails gracefully with clear error messages

### US2: As a player, I want to end Discord voice channels when game sessions finish

**Acceptance Criteria:**
- User can call `/api/end-room/:channelId` to delete a voice channel
- System deletes the Discord voice channel
- All connected WebSocket clients receive `room.deleted` event
- Deletion fails gracefully if channel doesn't exist or lacks permissions

### US3: As a player, I want to receive real-time notifications when players join/leave voice channels

**Acceptance Criteria:**
- WebSocket clients receive `voice.joined` events when users join voice channels
- WebSocket clients receive `voice.left` events when users leave voice channels
- Events include guild ID, channel ID, and user ID
- Events are only sent for the configured guild (single-guild MVP)
- Connection survives backend deploys (worker maintains Discord session)
- Core gameplay continues to function if Discord service is unavailable

### US4: As a developer, I want to use DiscordRestClient for Discord REST API operations

**Acceptance Criteria:**
- `DiscordRestClient` supports creating voice channels
- `DiscordRestClient` supports deleting channels
- `DiscordRestClient` supports sending messages (future: text chat)
- `DiscordRestClient` supports fetching channel lists (future: UI)
- All methods use proper Discord API types from `discord-api-types`
- All methods handle rate limiting with exponential backoff
- All methods validate inputs with Zod schemas

### US5: As a developer, I want to use DiscordRtcClient for Discord voice/video streaming

**Acceptance Criteria:**
- `DiscordRtcClient` can connect to Discord voice channels
- `DiscordRtcClient` can stream audio AND video to Discord
- `DiscordRtcClient` can receive audio AND video from Discord
- `DiscordRtcClient` handles voice state updates
- `DiscordRtcClient` manages UDP connection for media
- Implementation follows Discord Voice API specification
- Supports video streaming (webcam) for board state viewing

**Note**: Discord provides the communication layer (voice + video). Each player's browser runs card recognition locally on the Discord video streams.

## Functional Requirements

### FR1: Gateway Worker Service

**Requirements:**
- Maintain persistent WebSocket connection to Discord Gateway
- Subscribe to `GUILDS` and `GUILD_VOICE_STATES` intents
- Handle Discord Gateway opcodes: HELLO, HEARTBEAT_ACK, RECONNECT, INVALID_SESSION
- Implement heartbeat mechanism with watchdog for missed ACKs
- Implement resume capability on reconnection (preserve session_id)
- Forward `VOICE_STATE_UPDATE` events to TanStack Start via HMAC-signed webhook
- Forward `CHANNEL_DELETE` events (type=2, voice channels) to TanStack Start
- Filter events to only configured guild (PRIMARY_GUILD_ID)
- Reconnect automatically with exponential backoff on disconnect
- Deploy with health checks and auto-restart policy (systemd, Docker restart policy, or equivalent)
- Expose health check endpoint (e.g., `/health`) returning connection status

### FR2: TanStack Start Backend

**Requirements:**
- Implement `/api/create-room` POST endpoint with JWT verification
- Implement `/api/end-room/:channelId` DELETE endpoint with JWT verification
- Implement `/api/internal/events` POST endpoint with HMAC verification
- Implement `/api/ws` WebSocket endpoint with JWT authentication
- Broadcast events to all connected WebSocket clients
- Maintain in-memory WebSocket registry (no database)
- Implement backpressure handling (close clients with large bufferedAmount)
- Verify JWT tokens using JWKS from configured IdP
- Reject HMAC signatures older than 60 seconds (replay protection)
- WebSocket clients MUST auto-reconnect with exponential backoff (max 5 attempts)
- After 5 failed reconnection attempts, require manual reconnect (user action)

### FR3: DiscordRestClient Implementation

**Requirements:**
- Implement `createVoiceChannel(name, parentId?, userLimit?)` method
- Implement `deleteChannel(channelId)` method
- Implement `sendMessage(channelId, content)` method (for future text chat)
- Implement `getChannels(guildId)` method (for future UI)
- Use `discord-api-types` for all type definitions
- Validate all inputs with Zod schemas
- Handle Discord rate limits (429 responses) with exponential backoff (max 3 retries)
- After 3 failed retries, return error to client with clear message
- Include audit log reasons in requests
- Support bot token authentication (server-side only)

### FR4: DiscordRtcClient Implementation

**Requirements:**
- Implement `connect(channelId)` method to join voice channel
- Implement `disconnect()` method to leave voice channel
- Implement `sendAudio(stream)` method for audio streaming (Opus codec at 48kHz)
- Implement `sendVideo(stream)` method for video streaming (webcam for board state)
- Implement `onAudio(callback)` event for receiving audio (Opus codec at 48kHz)
- Implement `onVideo(callback)` event for receiving video from other players
- Handle voice state updates from Discord Gateway
- Establish UDP connection for media transport
- Use Opus codec at 48kHz sample rate for audio (Discord standard)
- Use VP8 codec for video streaming (primary, widely supported, royalty-free)
- Support VP9 and H.264 as fallback codecs if VP8 unavailable
- Support voice/video encryption (xsalsa20_poly1305)
- Audio format: Opus frames, 20ms frame size, stereo or mono
- Video format: Standard webcam resolutions (720p/1080p), VP8 encoding

## Data Contracts

### Message Envelope (WebSocket)

```typescript
interface MessageEnvelope {
  v: 1;
  type: "event" | "ack";
  event: string;
  payload: unknown;
  ts: number; // Unix timestamp in milliseconds
}
```

### Event Payloads

```typescript
// room.created
interface RoomCreatedPayload {
  channelId: string;
  name: string;
  guildId: string;
}

// room.deleted
interface RoomDeletedPayload {
  channelId: string;
  guildId: string;
}

// voice.joined
interface VoiceJoinedPayload {
  guildId: string;
  channelId: string;
  userId: string;
}

// voice.left
interface VoiceLeftPayload {
  guildId: string;
  channelId: string | null;
  userId: string;
}
```

### HMAC Signature (Internal Webhook)

```
X-Hub-Timestamp: <unix-seconds>
X-Hub-Signature: sha256=<hex-hmac-of "<ts>.<body>">
```

### JWT Claims (OAuth2 + PKCE)

```typescript
interface JWTClaims {
  iss: string; // Issuer (IdP URL)
  aud: string; // Audience (app identifier)
  sub: string; // Subject (user ID)
  exp: number; // Expiration (Unix timestamp)
  // Future: guilds: string[] for multi-guild support
}
```

## Non-Functional Requirements

### NFR1: Security

- Bot token MUST never be exposed to browser
- Internal webhooks MUST use HMAC + timestamp verification
- JWT verification MUST use JWKS (no hardcoded secrets)
- CORS MUST restrict to configured VITE_BASE_URL
- Reject HMAC signatures with >60s clock skew

### NFR2: Reliability

- Gateway worker MUST reconnect automatically on disconnect with exponential backoff
- Gateway worker MUST resume session when possible (preserve session_id)
- Gateway worker MUST have health check endpoint for monitoring
- Gateway worker MUST auto-restart on failure (via deployment policy)
- WebSocket clients MUST auto-reconnect with exponential backoff (max 5 attempts)
- WebSocket clients MUST show clear UI feedback after 5 failed reconnection attempts
- API endpoints MUST retry Discord API calls with exponential backoff (max 3 retries)
- API endpoints MUST return clear error messages after retry exhaustion
- Worker MUST terminate connection if heartbeat ACKs are missed (>90s)

### NFR3: Performance

- WebSocket event propagation: <100ms p95
- Discord REST API calls: <500ms p95
- Gateway reconnection: <5s after disconnect
- Heartbeat interval: as specified by Discord (typically 41.25s)

### NFR4: Observability

- Default log level: INFO for production
- Log all Discord Gateway events (with filtering for noise)
- Log all WebSocket connections/disconnections
- Log all HMAC verification failures
- Log all Discord API errors with context
- Log retry attempts and backoff delays
- Include request IDs in error messages
- Support LOG_LEVEL environment variable (DEBUG, INFO, WARN, ERROR)

## Environment Configuration

### Gateway Worker

```bash
DISCORD_BOT_TOKEN=...
PRIMARY_GUILD_ID=123456789012345678
HUB_ENDPOINT=https://your-domain.com/api/internal/events
HUB_SECRET=change-me
LOG_LEVEL=INFO
HEALTH_CHECK_PORT=8080
```

### TanStack Start Backend

```bash
DISCORD_BOT_TOKEN=...
PRIMARY_GUILD_ID=123456789012345678
HUB_SECRET=change-me
JWT_ISSUER=https://your-auth.example.com
JWT_AUDIENCE=spell-coven-web
JWT_PUBLIC_JWK_URL=https://your-auth.example.com/.well-known/jwks.json
VITE_BASE_URL=https://your-web.app
LOG_LEVEL=INFO
MAX_API_RETRIES=3
MAX_WS_RECONNECT_ATTEMPTS=5
```

## Testing Strategy

### Unit Tests

- HMAC signature generation and verification
- JWT token validation (mocked JWKS)
- WebSocket message serialization/deserialization
- Discord API request formatting
- Rate limit backoff calculation

### Integration Tests

- Gateway worker connects to Discord (test bot)
- Worker forwards events to TanStack Start
- TanStack Start broadcasts to WebSocket clients
- REST endpoints create/delete channels
- End-to-end: create room → join voice → receive event

### Manual Testing

1. Start gateway worker with test bot token
2. Start TanStack Start backend locally
3. Connect WebSocket client with valid JWT
4. Create voice channel via REST API
5. Join channel in Discord client
6. Verify `voice.joined` event received
7. Leave channel in Discord client
8. Verify `voice.left` event received
9. Delete channel via REST API
10. Verify `room.deleted` event received

## Success Metrics

- Gateway worker maintains connection for >24 hours without manual intervention
- WebSocket events delivered within 100ms of Discord event
- Zero bot token exposures in browser network logs
- All HMAC verification failures logged and rejected
- REST API success rate >99% (excluding Discord outages)

## Future Enhancements

- Multi-guild support (BYO-guild with bot install flow)
- Redis pub/sub for horizontal scaling of TanStack Start replicas
- Private room permissions with `permission_overwrites`
- Idle cleanup timers for unused channels
- Idempotency keys for `/api/create-room` (prevent duplicate creates)
- Persistent WebSocket state using database
- Rate limiting middleware for `/api/create-room`

## Dependencies

- Discord Developer Portal: Bot application with token
- Discord Guild: Single guild for MVP (PRIMARY_GUILD_ID)
- OAuth2 IdP: JWKS endpoint for JWT verification
- Node.js deployment: Railway, Render, or self-hosted (WebSocket support required)

**Note**: These dependencies are for social features only. Core MTG gameplay (card recognition, game tools) has no external dependencies and works offline after initial asset load.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Discord Gateway disconnects frequently | High - No real-time events | Implement robust reconnection with session resume |
| Bot token leaked | Critical - Security breach | Never expose to browser; use HMAC for internal webhooks |
| WebSocket clients overwhelm server | Medium - Service degradation | Implement backpressure (close clients with large bufferedAmount) |
| TanStack Start deploys flap Gateway | High - Lost Discord session | Run Gateway worker as separate service |
| HMAC replay attacks | Medium - Unauthorized events | Reject signatures older than 60s |

## References

- [spell-coven-gateway-realtime-guide_v2.2.md](../../spell-coven-gateway-realtime-guide_v2.2.md)
- [Discord Gateway Documentation](https://discord.com/developers/docs/topics/gateway)
- [Discord Voice Documentation](https://discord.com/developers/docs/topics/voice-connections)
- [OAuth2 PKCE Specification](https://datatracker.ietf.org/doc/html/rfc7636)
- [JWKS Specification](https://datatracker.ietf.org/doc/html/rfc7517)
