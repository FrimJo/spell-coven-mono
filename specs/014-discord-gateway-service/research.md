# Research: Discord Gateway Service

**Phase**: 0 (Research & Technical Decisions)
**Date**: 2025-10-26

## Overview

This document consolidates technical decisions and research findings for implementing the Discord Gateway service. Discord provides the **required communication infrastructure** - room management, voice chat, and **video streaming** (players stream webcams showing board state). While card recognition runs locally in each browser, Discord is **essential** for players to see each other's boards.

The implementation follows the comprehensive [spell-coven-gateway-realtime-guide_v2.2.md](../../spell-coven-gateway-realtime-guide_v2.2.md) specification.

**Architectural Principle**: Per Constitution v1.2.0, separation of concerns between communication and intelligence:
- **Discord provides** (required): Room coordination, voice chat, **video streaming** (webcam for board state viewing), text chat
- **Browser provides** (local): Card recognition on Discord video streams (CLIP/FAISS), game state, game tools

## Key Technical Decisions

### Decision 1: Separate Gateway Worker Service

**Decision**: Run Discord Gateway as a separate long-lived Node.js service, independent from TanStack Start backend.

**Rationale**:
- Discord Gateway requires persistent WebSocket connection that survives application deploys
- Deploying TanStack Start would terminate Gateway connection, causing session loss
- Separation enables independent scaling (worker stays stable, backend can autoscale)
- Clear security boundary (bot token isolated to worker service)

**Alternatives Considered**:
- **Running in TanStack Start**: Rejected because deploys would flap Discord session
- **Serverless/Edge**: Rejected because long-lived WebSocket connections not supported
- **Browser-based**: Rejected because bot-level permissions require server-side token

**Implementation**: Node.js service with `ws` package, deployed on Railway/Render/self-hosted.

---

### Decision 2: HMAC-Signed Internal Webhooks

**Decision**: Worker posts events to TanStack Start via HTTP POST with HMAC signature verification.

**Rationale**:
- Secure communication without exposing bot token
- Simple timestamp-based replay protection (reject >60s skew)
- No infrastructure dependencies (no message queue, no database)
- Sufficient for single-guild MVP with low event volume

**Alternatives Considered**:
- **Direct database sharing**: Rejected because violates package isolation
- **Message queue (Redis/RabbitMQ)**: Rejected as over-engineering for MVP
- **Shared memory**: Rejected because services may run on different hosts

**Implementation**: SHA-256 HMAC of `"<timestamp>.<body>"` with shared secret.

---

### Decision 3: JWT Verification via JWKS

**Decision**: TanStack Start verifies user JWTs using JWKS endpoint from OAuth2 IdP.

**Rationale**:
- Standard OAuth2 + PKCE flow (no client secret in browser)
- IdP manages key rotation (no hardcoded secrets in backend)
- Supports future multi-tenant scenarios (different IdPs per guild)
- Industry best practice for stateless authentication

**Alternatives Considered**:
- **Hardcoded secret**: Rejected because requires backend redeploy for key rotation
- **Session cookies**: Rejected because complicates WebSocket authentication
- **API keys**: Rejected because less secure than JWT + PKCE

**Implementation**: `jose` library for JWKS fetching and JWT verification.

---

### Decision 4: In-Memory WebSocket Registry

**Decision**: Store active WebSocket connections in-memory Set, no database persistence.

**Rationale**:
- Stateless design (clients reconnect on backend restart)
- Low latency for event broadcast (no DB lookup)
- Sufficient for MVP scale (~10-50 concurrent users)
- Simplifies deployment (no database dependency)

**Alternatives Considered**:
- **Redis for state**: Rejected as over-engineering for MVP
- **Database persistence**: Rejected because adds latency and complexity
- **Sticky sessions**: Rejected because complicates horizontal scaling

**Implementation**: `Set<WSConnection>` in `ws-manager.ts`, cleared on server restart.

---

### Decision 5: Discord Voice/Video via DiscordRtcClient

**Decision**: Implement DiscordRtcClient for Discord Voice API supporting both audio and video (UDP + Opus/VP8 codecs).

**Rationale**:
- Enables voice + **video streaming** to Discord channels
- **Critical for core functionality**: Players stream webcams showing board state through Discord
- Each player's browser watches Discord video streams and runs card recognition locally
- Follows Discord Voice API specification
- Leverages Discord's robust video infrastructure instead of building custom WebRTC signaling

**Alternatives Considered**:
- **Custom WebRTC P2P**: Rejected because requires signaling server and doesn't leverage Discord's infrastructure
- **Third-party library**: Considered but prefer direct implementation for control
- **Audio-only**: Rejected because video streaming is essential for board state viewing

**Implementation**:
- UDP connection with Opus encoding for audio (48kHz)
- VP8 codec for video (primary, with VP9/H.264 fallbacks)
- xsalsa20_poly1305 encryption for both audio and video
- Support for `selfVideo` flag in voice state updates

**Note**: Per Constitution v1.2.0, Discord provides the communication layer (voice + video). Card recognition runs locally in browsers on Discord video streams.

---

## Technology Stack

### Gateway Worker
- **Runtime**: Node.js 20+
- **WebSocket Client**: `ws` (Discord Gateway connection)
- **HTTP Client**: `node:fetch` (posting to TanStack Start)
- **Crypto**: `node:crypto` (HMAC signatures)
- **Types**: `discord-api-types` (Discord API contracts)

### TanStack Start Backend
- **Framework**: `@tanstack/react-start` (full-stack React framework)
- **WebSocket Server**: `ws` (client connections)
- **JWT Verification**: `jose` (JWKS + JWT verify)
- **HTTP Server**: Built-in TanStack Start server
- **Crypto**: `node:crypto` (HMAC verification)

### Client Libraries (discord-integration package)
- **REST Client**: `discord-api-types` + `zod` validation
- **RTC Client**: Discord Voice API + Opus codec (audio) + VP8 codec (video)
- **Video Support**: VP8 primary, VP9/H.264 fallbacks for webcam streaming
- **Validation**: `zod` schemas for all inputs/outputs

---

## Discord API Integration

### Required Intents
```typescript
const intents = (1 << 0) | (1 << 7); // GUILDS + GUILD_VOICE_STATES
```

- **GUILDS (1 << 0)**: Required for channel create/delete events
- **GUILD_VOICE_STATES (1 << 7)**: Required for voice join/leave events

### Required Bot Permissions
- **MANAGE_CHANNELS (16)**: Create and delete voice channels
- **VIEW_CHANNELS (1024)**: Read channel information
- **CONNECT (1048576)**: Join voice channels (for RTC)
- **SPEAK (2097152)**: Send audio in voice channels (for RTC)
- **VIDEO (33554432)**: Stream video in voice channels (for webcam streaming)

### Gateway Opcodes
- **0 (Dispatch)**: Events from Discord (VOICE_STATE_UPDATE, CHANNEL_DELETE)
- **1 (Heartbeat)**: Keep connection alive
- **2 (Identify)**: Initial authentication
- **6 (Resume)**: Reconnect with existing session
- **7 (Reconnect)**: Discord requests reconnection
- **9 (Invalid Session)**: Session invalid, must re-identify
- **10 (Hello)**: Heartbeat interval from Discord
- **11 (Heartbeat ACK)**: Heartbeat acknowledged

---

## Performance Characteristics

### WebSocket Event Propagation
- **Target**: <100ms from Discord event to client
- **Bottlenecks**: Network latency (Discord → Worker → Backend → Client)
- **Optimization**: Direct broadcast (no database, no queue)

### Discord REST API
- **Target**: <500ms p95 for channel operations
- **Rate Limits**: Discord enforces per-route rate limits
- **Mitigation**: Exponential backoff on 429 responses

### Gateway Reconnection
- **Target**: <5s to restore connection after disconnect
- **Strategy**: Resume with session_id when possible, re-identify otherwise
- **Backoff**: 1-3s random delay to avoid thundering herd

---

## Security Considerations

### Bot Token Protection
- **Storage**: Environment variable only (never in code)
- **Scope**: Gateway worker and TanStack Start backend only
- **Exposure**: Never sent to browser, never logged

### HMAC Signature Verification
- **Algorithm**: SHA-256
- **Format**: `sha256=<hex-digest>`
- **Payload**: `"<timestamp>.<body>"`
- **Replay Protection**: Reject signatures older than 60 seconds

### JWT Verification
- **Algorithm**: RS256 (asymmetric, public key from JWKS)
- **Claims**: `iss`, `aud`, `sub`, `exp` validated
- **Expiration**: Enforced by `jose` library
- **Refresh**: Client responsibility (not backend)

### CORS Policy
- **Origin**: Restricted to `VITE_BASE_URL` environment variable
- **Credentials**: Not required (JWT in Authorization header)
- **Methods**: POST, DELETE, GET (WebSocket upgrade)

---

## Deployment Architecture

### Gateway Worker
- **Platform**: Railway, Render, or self-hosted VM
- **Scaling**: Single instance (stateful WebSocket connection)
- **Health Check**: HTTP endpoint returning connection status
- **Restart Policy**: Always restart on crash

### TanStack Start Backend
- **Platform**: Railway, Render, Vercel (Node.js mode), or self-hosted
- **Scaling**: Horizontal (multiple instances behind load balancer)
- **WebSocket**: Requires Node.js runtime (not serverless functions)
- **Health Check**: HTTP endpoint returning service status

### Load Balancer (for horizontal scaling)
- **Sticky Sessions**: Not required (clients reconnect on backend change)
- **WebSocket Support**: Required (upgrade HTTP → WebSocket)
- **Timeout**: Long-lived connections (no idle timeout)

---

## Testing Strategy

### Unit Tests (Vitest)
- HMAC signature generation/verification
- JWT token parsing (mocked JWKS)
- WebSocket message serialization
- Discord API request formatting
- Rate limit backoff calculation

### Integration Tests
- Gateway worker → TanStack Start event flow
- TanStack Start → WebSocket client broadcast
- REST API → Discord API → event propagation
- End-to-end: create room → join voice → receive event

### Manual Testing Checklist
1. ✅ Gateway worker connects to Discord
2. ✅ Worker survives backend restarts (maintains session)
3. ✅ REST API creates voice channel
4. ✅ WebSocket clients receive `room.created` event
5. ✅ Discord user joins voice channel
6. ✅ WebSocket clients receive `voice.joined` event
7. ✅ Discord user leaves voice channel
8. ✅ WebSocket clients receive `voice.left` event
9. ✅ REST API deletes voice channel
10. ✅ WebSocket clients receive `room.deleted` event
11. ✅ HMAC verification rejects tampered requests
12. ✅ JWT verification rejects invalid tokens

---

## Open Questions (Resolved)

### Q1: Should we use a message queue for worker → backend communication?
**Answer**: No. HMAC-signed HTTP webhooks are sufficient for MVP. Message queue adds infrastructure complexity without clear benefit at current scale.

### Q2: How to handle horizontal scaling of TanStack Start?
**Answer**: Defer to future enhancement. MVP uses single backend instance. Future: Redis pub/sub for multi-instance broadcast.

### Q3: Should we persist WebSocket state in database?
**Answer**: No. Clients reconnect on backend restart. Stateless design simplifies deployment and reduces latency.

### Q4: How to handle Discord rate limits?
**Answer**: Exponential backoff on 429 responses. Discord provides `Retry-After` header. Start with 1s, double on each retry, max 32s.

### Q5: Should DiscordRtcClient support video?
**Answer**: Audio-only for MVP. Video can be added later if needed. Focus on voice streaming first.

---

## References

- [Discord Gateway Documentation](https://discord.com/developers/docs/topics/gateway)
- [Discord Voice Documentation](https://discord.com/developers/docs/topics/voice-connections)
- [OAuth2 PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [JWKS (RFC 7517)](https://datatracker.ietf.org/doc/html/rfc7517)
- [TanStack Start Documentation](https://tanstack.com/start)
- [ws Package Documentation](https://github.com/websockets/ws)
- [jose Package Documentation](https://github.com/panva/jose)
