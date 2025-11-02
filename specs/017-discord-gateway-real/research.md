# Research: Discord Gateway Real-Time Event System

**Feature**: Discord Gateway Real-Time Event System  
**Date**: 2025-01-02  
**Status**: Complete

## Overview

This document consolidates technical research and decisions for implementing real-time Discord Gateway integration. Most infrastructure already exists from previous implementations. This research focuses on enhancements and clarifications needed for the complete feature.

## Research Areas

### 1. Discord Gateway Integration Pattern

**Decision**: Use integrated Discord Gateway client within TanStack Start (not separate service)

**Rationale**:
- Simpler deployment (single Node.js process)
- No inter-service communication overhead
- Easier development and testing
- Existing implementation already follows this pattern

**Implementation**:
- `@repo/discord-gateway` package provides `DiscordGatewayClient`
- Initialized in `/apps/web/src/server/init/discord-gateway-init.server.ts`
- Called from `__root.tsx` beforeLoad hook on server startup
- Maintains persistent WebSocket to Discord Gateway API

**Alternatives Considered**:
- Separate Gateway service: Rejected due to unnecessary complexity for single-guild MVP
- Polling Discord API: Rejected due to latency requirements (<300ms p95)

### 2. Real-Time Event Streaming to Browser

**Decision**: WebSocket for browser ↔ server communication (NOT SSE)

**Rationale**:
- Bidirectional communication (events + commands)
- Lower latency than SSE for this use case
- Existing implementation uses WebSocket successfully
- CrossWS provides adapter for TanStack Start
- Single connection for both receiving events and sending commands

**Implementation**:
- WebSocket route: `/apps/web/src/routes/api/ws.ts`
- JWT authentication (5-second timeout)
- Message format: `{ v: 1, type: 'event'|'ack'|'error', event: string, payload: unknown, ts: number }`
- WebSocket manager: `/apps/web/src/server/managers/ws-manager.ts`
- Client hook: `/apps/web/src/hooks/useVoiceChannelEvents.ts`

**Alternatives Considered**:
- **Server-Sent Events (SSE)**: Mentioned in technical spec document but NOT implemented. Rejected because:
  - WebSocket already implemented and working
  - SSE is unidirectional (would need separate mechanism for client → server commands)
  - WebSocket provides better latency and bidirectional communication
- Long polling: Rejected due to latency and overhead

**Important Note**: The technical spec document (`spec-discord-gateway.md`) mentions SSE in section 4.4, but this represents an alternative architecture that was NOT chosen. The actual implementation uses WebSocket exclusively for browser ↔ server real-time communication.

### 3. Session Management and Expiry

**Decision**: Silent refresh attempt with fallback to login redirect

**Rationale**:
- Best user experience (minimal disruption)
- Preserves user intent (return URL after re-auth)
- Aligns with OAuth2 refresh token pattern

**Implementation**:
- Attempt silent token refresh when session expires
- If refresh fails, redirect to Discord OAuth with return URL
- Use OAuth2 state parameter to encode return URL
- Existing callback route already handles state parameter redirect

**Key Files**:
- `/apps/web/src/routes/auth/discord/callback.tsx` - OAuth callback with state handling
- Session refresh logic to be added to auth utilities

### 4. Rate Limit Handling

**Decision**: Queue requests with exponential backoff retry

**Rationale**:
- Industry best practice for API rate limits
- Prevents request loss
- Avoids thundering herd on rate limit reset
- Discord API provides rate limit headers for intelligent backoff

**Implementation**:
- Request queue per endpoint
- Exponential backoff: 1s → 2s → 4s → 8s → 16s
- Max 5 retry attempts
- Log rate limit events for monitoring
- Use Discord's `X-RateLimit-*` headers

**Alternatives Considered**:
- Immediate rejection: Rejected due to poor UX (lost requests)
- Circuit breaker: Overkill for single-guild MVP

### 5. Room Cleanup Strategy

**Decision**: Automatic cleanup after 1 hour of inactivity

**Rationale**:
- Balances resource conservation with user convenience
- Prevents abandoned rooms from accumulating
- Grace period allows brief disconnections

**Implementation**:
- Track last activity timestamp per room
- Background job checks for inactive rooms every 5 minutes
- Cleanup: Delete Discord voice channel, delete role, remove from registry
- Notify connected clients before cleanup (30-second warning)

**Key Considerations**:
- "Activity" = any user in voice channel or viewing game room
- Creator can manually close room anytime
- Cleanup is idempotent (safe to retry)

### 6. Player Limit Enforcement

**Decision**: Hard limit of 4 players per room

**Rationale**:
- Optimal for card games (2-4 players typical)
- Ensures good voice quality
- Simplifies UI layout (video grid)
- Aligns with user research

**Implementation**:
- Set Discord voice channel `user_limit: 4`
- Validate on room creation
- Discord enforces limit automatically
- UI shows "Room Full" when limit reached

**Alternatives Considered**:
- Configurable limit: Rejected for MVP (adds complexity)
- No limit: Rejected due to UX degradation with many players

### 7. Invite Token Security

**Decision**: 24-hour expiry with cryptographic signing

**Rationale**:
- Balances security with usability
- Long enough for async coordination
- Short enough to limit exposure window
- Cryptographic signing prevents tampering

**Implementation**:
- JWT tokens with HS256 algorithm
- Payload: `{ guildId, channelId, roleId, creatorId, exp }`
- Expiry: `Date.now() + 24 * 60 * 60 * 1000`
- Verification on every use
- Existing implementation in `/apps/web/src/server/room-tokens.server.ts`

### 8. WebSocket Connection Management

**Decision**: Singleton manager with connection registry

**Rationale**:
- Prevents duplicate connections
- Enables targeted event broadcasting
- Supports connection cleanup
- Existing implementation works well

**Implementation**:
- WebSocket manager maintains Map of connections
- Key: userId, Value: WebSocket + metadata (guildId, authenticated)
- Automatic cleanup on disconnect
- Heartbeat every 15 seconds
- Existing: `/apps/web/src/server/managers/ws-manager.ts`

**Key Features**:
- `broadcastToGuild(guildId, event, payload)` - Send to all users in guild
- `sendToUser(userId, event, payload)` - Send to specific user
- `register(userId, ws, metadata)` - Add connection
- `unregister(userId)` - Remove connection

### 9. Error Handling Strategy

**Decision**: Structured error responses with user-friendly messages

**Rationale**:
- Clear error communication
- Prevents information leakage
- Enables client-side error handling
- Consistent error format

**Error Mapping**:
- Zod validation errors → 400 Bad Request
- Missing/invalid auth → 401 Unauthorized
- Insufficient permissions → 403 Forbidden
- Discord API errors → 502 Bad Gateway (sanitized message)
- Rate limiting → 429 Too Many Requests

**Implementation**:
- Error middleware in server functions
- Sanitize Discord API error messages
- Log full errors server-side
- Return safe messages to client

### 10. Observability and Logging

**Decision**: Structured console logging with prefixes

**Rationale**:
- Simple for MVP (no external dependencies)
- Easy to grep and filter
- Sufficient for debugging
- Can upgrade to structured logging later

**Log Prefixes**:
- `[Gateway Init]` - Gateway initialization
- `[Gateway]` - Discord Gateway events
- `[WS]` - WebSocket connections
- `[Internal]` - Internal event handling
- `[Room]` - Room management operations

**Key Log Points**:
- Gateway connection/disconnection
- WebSocket authentication
- Event broadcasting
- Room creation/cleanup
- Error conditions

## Technology Stack Summary

### Core Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.x | Type safety |
| Node.js | 18+ | Runtime |
| TanStack Start | Latest | Full-stack React framework |
| @tanstack/react-router | Latest | Routing |
| Discord.js Gateway | Latest | Discord Gateway client |
| ws | Latest | WebSocket library |
| CrossWS | Latest | WebSocket adapter for TanStack |
| Zod | Latest | Schema validation |
| jose | Latest | JWT handling |

### Existing Infrastructure

- ✅ Discord Gateway client integration
- ✅ WebSocket server and client
- ✅ Event broadcasting system
- ✅ OAuth2 authentication
- ✅ Session management
- ✅ Room creation and management
- ✅ Voice channel monitoring
- ✅ Real-time member list sync

### New Components Needed

- ⚠️ Room cleanup background job (1-hour inactivity)
- ⚠️ Session refresh logic
- ⚠️ Rate limit queue with exponential backoff
- ⚠️ 4-player limit enforcement
- ⚠️ 24-hour token expiry (update existing)

## Performance Considerations

### Latency Targets

- Event delivery: <300ms p95 (Discord → Browser)
- Voice channel connection: <2s
- Room creation: <3s
- Authentication: <1s

### Scalability

**Current (MVP)**:
- Single Discord guild
- 100 concurrent WebSocket connections
- 100 events/s throughput
- In-memory event bus (stateless)

**Future (Horizontal Scaling)**:
- Redis for event bus (Pub/Sub)
- Redis for session storage
- Multiple TanStack Start instances
- Load balancer with sticky sessions

### Resource Usage

- Memory: ~512MB per TanStack Start instance
- CPU: Low (event-driven, mostly I/O)
- Network: Discord Gateway WebSocket + browser WebSockets
- Storage: None (stateless, in-memory only)

## Security Considerations

### Secrets Management

- `DISCORD_BOT_TOKEN` - Server-side only, never exposed
- `SESSION_SECRET` - Server-side only, for cookie encryption
- `HUB_SECRET` - Server-side only, for HMAC signing (if using separate Gateway service)

### Authentication Flow

1. User clicks "Login with Discord"
2. Redirect to Discord OAuth2
3. Discord redirects back with code
4. Exchange code for access token (server-side)
5. Create encrypted session cookie
6. Generate JWT for WebSocket auth
7. WebSocket authenticates with JWT (5s timeout)

### Authorization Rules

- User must be authenticated (Discord OAuth)
- User must be in guild to access guild resources
- Room creators have additional permissions (close room, manage settings)
- Invite token required to join room

## Migration Notes

### Existing Implementation Status

Most of this feature is already implemented. Key existing components:

1. ✅ Discord Gateway integration (`@repo/discord-gateway`)
2. ✅ WebSocket server and client (`/apps/web/src/routes/api/ws.ts`)
3. ✅ Event broadcasting (`/apps/web/src/server/managers/ws-manager.ts`)
4. ✅ Voice channel monitoring hooks
5. ✅ Room creation and management
6. ✅ OAuth2 authentication
7. ✅ Automatic voice channel connection

### Changes Required

1. **Room Cleanup**: Add background job for 1-hour inactivity cleanup
2. **Session Refresh**: Implement silent refresh with fallback to login redirect
3. **Rate Limiting**: Add request queue with exponential backoff
4. **Player Limit**: Enforce 4-player limit on room creation
5. **Token Expiry**: Update to 24-hour expiry (currently 1 hour)

### Backward Compatibility

- All changes are additive or enhancements
- No breaking changes to existing APIs
- Existing rooms continue to work
- Existing WebSocket connections unaffected

## Open Questions

None. All clarifications completed during specification phase:
- ✅ Invite token expiry: 24 hours
- ✅ Maximum players per room: 4 players
- ✅ Room cleanup timing: After 1 hour of inactivity
- ✅ Session expiry handling: Silent refresh attempt, fallback to login redirect
- ✅ Rate limit handling: Queue requests with exponential backoff retry

## References

- [Discord Gateway API Documentation](https://discord.com/developers/docs/topics/gateway)
- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [WebSocket Protocol RFC 6455](https://tools.ietf.org/html/rfc6455)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- Technical Spec: `/specs/017-discord-gateway-real/spec-discord-gateway.md`
- Feature Spec: `/specs/017-discord-gateway-real/spec.md`
