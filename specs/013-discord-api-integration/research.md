# Phase 0: Research & Technical Decisions

**Feature**: Discord API Integration for Remote MTG Play  
**Date**: 2025-10-21  
**Status**: Complete

## Overview

This document consolidates research findings and technical decisions for integrating Discord's API into Spell Coven. All technical unknowns from the planning phase have been resolved through analysis of the IMPLEMENTATION_GUIDE.md and Discord API documentation.

## Research Areas

### 1. OAuth2 Authentication Strategy

**Decision**: Use PKCE (Proof Key for Code Exchange) for client-side OAuth2

**Rationale**:
- PKCE is the industry-standard for secure OAuth in public clients (browsers, mobile apps)
- No client secret required - eliminates security risk of exposing secrets in browser code
- Fully client-side implementation - aligns with browser-first architecture
- Supported natively by Discord OAuth2 API
- RFC 7636 standard with proven security properties

**How PKCE Works**:
1. Generate random `code_verifier` (43-128 characters) using `crypto.getRandomValues()`
2. Create `code_challenge` = Base64URL(SHA256(code_verifier)) using `crypto.subtle.digest()`
3. Send `code_challenge` + `code_challenge_method=S256` to Discord during authorization
4. Discord returns authorization code
5. Exchange code + `code_verifier` for access token
6. Discord verifies: SHA256(code_verifier) == stored code_challenge

**Alternatives Considered**:
- **Traditional OAuth with client secret**: Rejected - requires backend, exposes secrets in browser
- **Implicit flow**: Rejected - deprecated by OAuth 2.1 spec, less secure than PKCE
- **Custom authentication**: Rejected - reinventing the wheel, Discord doesn't support it

**Implementation Details**:
- Use browser's `crypto.subtle` API for SHA256 hashing
- Use `crypto.getRandomValues()` for secure random generation
- Store tokens in localStorage with automatic refresh
- Token schema: `{ accessToken, refreshToken, expiresAt, version: "1.0" }`

### 2. Package Architecture (Separation of Concerns)

**Decision**: Create `@repo/discord-integration` package separate from `apps/web`

**Rationale**:
- **Testability**: Pure Discord API logic can be unit tested without React/browser environment
- **Reusability**: Package can be used in future mobile apps or other frontends
- **Maintainability**: Clear boundaries prevent UI concerns from leaking into API logic
- **Type Safety**: Shared types via `@repo/discord-integration/types` enforce contracts
- **Independence**: Package has zero React dependencies, zero browser storage dependencies

**Package Responsibilities**:
- `@repo/discord-integration`: OAuth client, Gateway client, REST client, RTC client (pure logic)
- `apps/web`: React hooks (bridge layer), UI components, state management (stores)

**Alternatives Considered**:
- **Single package**: Rejected - mixes concerns, harder to test, couples UI to API
- **Backend service**: Rejected - violates browser-first architecture, adds deployment complexity
- **Third-party library (discord.js)**: Rejected - Node.js only, not browser-compatible

**Key SoC Principles**:
- Package returns data to caller (no localStorage access)
- Package emits events (no React state management)
- Hooks are the ONLY bridge between package and UI
- Components NEVER import package clients directly

### 3. Discord Gateway (WebSocket) vs REST API

**Decision**: Use both - Gateway for real-time events, REST for actions

**Rationale**:
- **Gateway (WebSocket)**: Receive real-time events (messages, voice state, presence)
  - Persistent connection with heartbeat mechanism
  - Push-based updates (no polling)
  - Efficient for high-frequency events
- **REST API**: Perform actions (send messages, create channels, update metadata)
  - Request/response pattern for mutations
  - Rate limit handling with exponential backoff
  - Simpler error handling

**Implementation Strategy**:
- Gateway connection established after OAuth authentication
- Heartbeat interval from Discord's HELLO event
- Reconnection with exponential backoff (max 30 seconds)
- REST API calls use user's OAuth token (messages appear as from user)

**Alternatives Considered**:
- **REST API only with polling**: Rejected - inefficient, high latency, rate limit issues
- **WebSocket only**: Rejected - Discord doesn't support sending actions via Gateway

### 4. Data Contract Schemas

**Decision**: Use Zod for schema validation with versioned contracts

**Rationale**:
- **Type Safety**: Zod generates TypeScript types from schemas
- **Runtime Validation**: Validates data at runtime (Discord API responses, localStorage)
- **Error Messages**: Clear validation errors for debugging
- **Versioning**: Schema version field enables evolution without breaking changes

**Schemas to Define** (Phase 1):

1. **DiscordToken** (localStorage):
   ```typescript
   {
     accessToken: string,
     refreshToken: string,
     expiresAt: number,  // Unix timestamp
     scopes: string[],
     tokenType: "Bearer",
     version: "1.0"
   }
   ```

2. **RoomMetadata** (Discord channel topic/pinned message):
   ```typescript
   {
     version: "1.0",
     format: string,  // "Commander", "Standard", etc.
     powerLevel: number,  // 1-10 scale
     maxPlayers: number,  // 2-4
     createdAt: string,  // ISO 8601
     customSettings?: Record<string, unknown>
   }
   ```

3. **GameEventEmbed** (Discord message embeds):
   ```typescript
   {
     version: "1.0",
     type: "card_lookup" | "life_total" | "turn_change",
     data: object,  // Type-specific data
     timestamp: string,  // ISO 8601
     color?: number  // Discord embed color (hex)
   }
   ```

**Alternatives Considered**:
- **JSON Schema**: Rejected - less TypeScript integration, separate validation library
- **io-ts**: Rejected - more complex API, Zod is more popular in React ecosystem
- **Manual validation**: Rejected - error-prone, no type generation

### 5. Discord RTC Protocol for Video Streaming

**Decision**: Attempt Discord RTC with fallback to custom WebRTC

**Rationale**:
- **Primary**: Discord RTC leverages Discord's infrastructure (no custom servers)
- **Risk**: Discord's RTC protocol may not be fully documented or browser-accessible
- **Fallback**: Custom WebRTC peer-to-peer if Discord RTC proves infeasible

**Research Findings**:
- Discord uses proprietary RTC protocol over UDP + WebSocket
- Protocol may require reverse engineering
- Discord.js library is Node.js only (not browser-compatible)
- Alternative: Use Discord's "Go Live" screen share feature

**Implementation Strategy** (Phase 4):
1. Research Discord RTC protocol documentation
2. Attempt browser-based RTC connection
3. If infeasible, implement custom WebRTC with STUN/TURN servers
4. Document findings in Phase 4 research

**Risk Assessment**: HIGH RISK - May require significant reverse engineering or fallback implementation

**Alternatives Considered**:
- **Custom WebRTC from start**: Rejected - Discord RTC worth attempting first for infrastructure benefits
- **Third-party video service**: Rejected - violates browser-first architecture, adds costs

### 6. Rate Limit Handling

**Decision**: Implement exponential backoff with message queuing

**Rationale**:
- Discord API has per-user and per-app rate limits
- Exponential backoff prevents thundering herd
- Message queuing ensures no message loss
- User sees "Sending..." status during rate limiting

**Implementation Details**:
- Initial backoff: 1 second
- Max backoff: 32 seconds
- Backoff multiplier: 2x
- Queue messages in memory (messageStore)
- Retry automatically when rate limit window resets

**Alternatives Considered**:
- **Drop messages**: Rejected - poor user experience, data loss
- **Fixed delay**: Rejected - inefficient, doesn't adapt to rate limit severity
- **No rate limiting**: Rejected - risks account suspension

### 7. Token Storage and Security

**Decision**: Store tokens in localStorage with CSP headers

**Rationale**:
- **localStorage**: Persistent across sessions, simple API
- **CSP Headers**: Mitigate XSS risks (script-src, connect-src)
- **Token Refresh**: Automatic refresh before expiration (no user intervention)
- **Logout**: Clear all tokens on explicit logout

**Security Measures**:
- Content Security Policy headers
- Validate all Discord API responses
- Sanitize user input before sending to Discord
- No client secret in browser (PKCE only)
- Client ID is public (safe to commit)

**Alternatives Considered**:
- **Cookies**: Rejected - more complex, CORS issues, not needed for client-side app
- **IndexedDB**: Rejected - overkill for simple token storage
- **Memory only**: Rejected - tokens lost on page refresh

### 8. Testing Strategy

**Decision**: Unit tests for package, E2E tests for UI, manual tests for Discord integration

**Rationale**:
- **Unit Tests** (Vitest): Test `@repo/discord-integration` clients in isolation
  - Mock WebSocket and fetch for Gateway/REST clients
  - Test OAuth flow without browser environment
  - Test rate limiting logic independently
- **E2E Tests** (Playwright): Test OAuth flow and UI interactions
  - Test authentication gate (Create/Join game)
  - Test OAuth callback handling
  - Test message sending/receiving
- **Manual Tests**: Test with real Discord accounts and servers
  - Integration with Discord's staging environment (if available)
  - Video streaming (Phase 4)

**Benefits of SoC for Testing**:
- Can test Discord API logic without rendering React components
- Can test UI components without real Discord connections
- Can swap Discord implementation without changing UI
- Faster test execution (no browser needed for API tests)

**Alternatives Considered**:
- **Integration tests only**: Rejected - slow, brittle, hard to debug
- **No tests**: Rejected - high risk for complex OAuth and WebSocket logic

## Technology Stack Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Language** | TypeScript 5.x | Type safety, Discord API types |
| **UI Framework** | React 18.x | Existing app framework |
| **OAuth** | PKCE (RFC 7636) | Secure client-side auth |
| **WebSocket** | Native browser API | Discord Gateway connection |
| **HTTP** | Native fetch API | Discord REST API calls |
| **Crypto** | crypto.subtle | PKCE SHA256 hashing |
| **Validation** | Zod | Schema validation + type generation |
| **Testing** | Vitest + Playwright | Unit + E2E testing |
| **Types** | discord-api-types | Discord API TypeScript definitions |

## Dependencies to Add

### `@repo/discord-integration` package:
```json
{
  "dependencies": {
    "discord-api-types": "^0.37.x",
    "zod": "^3.22.x"
  },
  "devDependencies": {
    "vitest": "^1.0.x",
    "@types/node": "^20.x"
  }
}
```

### `apps/web` updates:
```json
{
  "dependencies": {
    "@repo/discord-integration": "workspace:*"
  }
}
```

## Environment Variables

### `apps/web/.env.development` (safe to commit):
```env
VITE_DISCORD_CLIENT_ID=your_client_id_here
# No CLIENT_SECRET needed - using PKCE!
```

### User override (`.env.local`, gitignored):
```env
VITE_DISCORD_CLIENT_ID=custom_client_id_for_self_hosting
```

## Documentation Resources

- **Discord API Docs**: https://discord.com/developers/docs
- **PKCE RFC 7636**: https://datatracker.ietf.org/doc/html/rfc7636
- **Context7 MCP**: Use `mcp1_resolve-library-id` for `/discordjs/discord-api-types`
- **OAuth 2.1 Spec**: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07

## Next Steps (Phase 1)

1. Generate `data-model.md` with entity schemas
2. Generate API contracts in `/contracts/` directory
3. Create `quickstart.md` for Phase 0 setup (Discord Developer Portal)
4. Update agent context with new technologies
5. Re-evaluate Constitution Check post-design

## Research Complete

All technical unknowns have been resolved. Proceed to Phase 1: Design & Contracts.
