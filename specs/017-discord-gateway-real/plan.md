# Implementation Plan: Discord Gateway Real-Time Event System

**Branch**: `017-discord-gateway-real` | **Date**: 2025-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-discord-gateway-real/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement real-time Discord Gateway integration for voice channel monitoring and room management. The system maintains a persistent WebSocket connection to Discord Gateway, receives voice state update events (join/leave), and broadcasts them to authenticated browser clients within 300ms (p95). Users are automatically connected to private voice channels (max 4 players) when joining game rooms. The implementation uses TanStack Start server functions for type-safe RPC, WebSocket for real-time event streaming to browsers, and includes automatic reconnection with exponential backoff for reliability.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 22.20
**Primary Dependencies**: TanStack Start (React framework with server functions), @tanstack/react-router, Discord.js Gateway client, ws (WebSocket), Zod (validation), CrossWS (WebSocket adapter)
**Storage**: In-memory event bus (stateless), session cookies (encrypted), future: Redis or Supabase for horizontal scaling
**Testing**: Vitest for unit tests, Playwright for integration tests (optional per constitution)
**Target Platform**: Node.js server (TanStack Start), modern browsers (Chrome, Firefox, Safari)
**Project Type**: Web application (full-stack React with server-side rendering)
**Performance Goals**: <300ms p95 event delivery latency, 100 concurrent WebSocket connections, 100 events/s throughput, <2s voice channel connection time
**Constraints**: 99.9% monthly uptime, zero secrets exposed to browser, 4 players max per room, 24-hour invite token expiry, 1-hour room cleanup after inactivity
**Scale/Scope**: Single Discord guild (multi-guild future), 100+ concurrent users, real-time event streaming, automatic reconnection with exponential backoff

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Browser-First Architecture ✅ PASS

**Status**: Compliant with optional backend services

- ✅ Core features (card recognition, game tools) remain client-side
- ✅ Discord integration is OPTIONAL for social features (room management, voice, video)
- ✅ Backend services used only for social features, not core gameplay
- ✅ Self-hosting remains viable for core gameplay without Discord
- ✅ Third-party service (Discord) used appropriately for communication

**Rationale**: Discord Gateway integration is purely for social/multiplayer features. Core card recognition and game mechanics remain browser-first and work offline.

### II. Data Contract Discipline ✅ PASS

**Status**: Explicit contracts with versioning

- ✅ Event types defined with TypeScript interfaces (VoiceJoinedPayload, VoiceLeftPayload, etc.)
- ✅ WebSocket protocol documented with message envelopes
- ✅ Zod schemas for all server function inputs
- ✅ Version field in WebSocket messages (`v: 1`)
- ✅ Clear error handling and validation rules

**Rationale**: All data exchanges between Discord Gateway, server, and browser have explicit TypeScript contracts with Zod validation.

### III. User-Centric Prioritization ✅ PASS

**Status**: User stories prioritized by value

- ✅ P1: Real-time voice channel monitoring (core multiplayer UX)
- ✅ P1: Automatic voice channel connection (removes friction)
- ✅ P2: Persistent gateway connection (reliability, background)
- ✅ P2: Room creation and management (privacy)
- ✅ P3: Event broadcasting to multiple users (enhancement)
- ✅ Performance targets: <300ms latency, <2s connection time

**Rationale**: Features prioritized by user-facing value. Performance optimizations target user-perceived metrics (latency, connection time).

### IV. Specification-Driven Development ✅ PASS

**Status**: Complete specification with acceptance criteria

- ✅ spec.md with user scenarios, functional requirements, success criteria
- ✅ Technology-agnostic requirements (describes WHAT, not HOW)
- ✅ Data contracts documented with TypeScript interfaces
- ✅ Acceptance criteria testable and measurable
- ✅ Clarifications completed (token expiry, room size, cleanup timing, etc.)

**Rationale**: Feature fully specified before implementation with clear requirements and measurable success criteria.

### V. Monorepo Package Isolation ✅ PASS

**Status**: Clear package boundaries

- ✅ @repo/discord-integration: Pure Discord API client (reusable)
- ✅ @repo/discord-gateway: Gateway WebSocket client library
- ✅ apps/web: TanStack Start application (uses packages)
- ✅ Clear dependency flow: web → discord-gateway → discord-integration
- ✅ No shared mutable state, explicit versioned dependencies

**Rationale**: Packages are self-contained with clear boundaries. Discord integration is independent and reusable.

### VI. Performance Through Optimization, Not Complexity ✅ PASS

**Status**: Simple, optimized implementation

- ✅ In-memory event bus (simple, fast)
- ✅ WebSocket for real-time events (proven protocol)
- ✅ Exponential backoff for reconnection (proven algorithm)
- ✅ No complex abstractions or distributed systems
- ✅ Performance through efficient protocols, not architecture complexity

**Rationale**: Achieves <300ms latency through simple WebSocket streaming and in-memory event bus, not complex infrastructure.

### VII. Open Source and Community-Driven ✅ PASS

**Status**: Open source with extensibility

- ✅ All code open source (existing project)
- ✅ Architecture supports self-hosting
- ✅ Documentation enables contribution
- ✅ Interface-based abstractions for future extensions (Redis, Supabase)
- ✅ Community feedback informs prioritization

**Rationale**: Implementation follows existing open-source patterns. Interface abstractions enable future community extensions.

### Gate Summary

**Result**: ✅ ALL GATES PASS

No constitution violations. Feature aligns with all core principles:
- Browser-first (Discord is optional social layer)
- Data contracts (explicit TypeScript interfaces + Zod)
- User-centric (prioritized by user value)
- Specification-driven (complete spec before implementation)
- Package isolation (clear boundaries)
- Simple optimization (no unnecessary complexity)
- Open source (extensible architecture)

## Project Structure

### Documentation (this feature)

```
specs/017-discord-gateway-real/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0: Technical research and decisions
├── data-model.md        # Phase 1: Entity definitions and relationships
├── quickstart.md        # Phase 1: Developer onboarding guide
├── contracts/           # Phase 1: API contracts and schemas
│   ├── websocket-protocol.md
│   ├── server-functions.md
│   └── event-types.ts
├── checklists/
│   └── requirements.md  # Specification quality checklist (completed)
└── tasks.md             # Phase 2: Implementation tasks (NOT created by /speckit.plan)
```

### Source Code (repository root)

```
packages/
├── discord-integration/     # Pure Discord API client (existing)
│   ├── src/
│   │   ├── clients/        # REST, OAuth, RTC clients
│   │   ├── managers/       # VideoQuality, VoiceState
│   │   ├── types/
│   │   │   ├── events.ts   # Event type definitions (existing)
│   │   │   ├── auth.ts
│   │   │   ├── gateway.ts
│   │   │   └── rest-schemas.ts
│   │   └── utils/
│   └── package.json
│
└── discord-gateway/         # Gateway WebSocket client (existing)
    ├── src/
    │   ├── gateway.ts      # DiscordGatewayClient
    │   ├── hmac.ts         # HMAC utilities
    │   ├── types.ts        # Gateway-specific types
    │   └── index.ts        # Public exports
    └── package.json

apps/web/                    # TanStack Start application
├── src/
│   ├── components/
│   │   ├── GameRoom.tsx    # Main game room component (existing, needs updates)
│   │   └── VoiceDropoutModal.tsx  # Voice disconnect modal (existing)
│   │
│   ├── hooks/
│   │   ├── useVoiceChannelEvents.ts  # WebSocket event listener (existing)
│   │   └── useVoiceChannelMembersFromEvents.ts  # Member list sync (existing)
│   │
│   ├── routes/
│   │   ├── api/
│   │   │   ├── ws.ts       # WebSocket route (existing, needs updates)
│   │   │   └── internal/
│   │   │       └── events.ts  # Internal event endpoint (existing)
│   │   └── game.$gameId.tsx   # Game room route (existing)
│   │
│   └── server/
│       ├── handlers/
│       │   └── discord-rooms.server.ts  # Room management functions (existing, needs updates)
│       │
│       ├── managers/
│       │   └── ws-manager.ts  # WebSocket connection manager (existing)
│       │
│       ├── init/
│       │   └── discord-gateway-init.server.ts  # Gateway initialization (existing)
│       │
│       └── hub-client.server.ts  # Event posting client (existing)
│
└── package.json

tests/                       # Test files (optional per constitution)
├── integration/
│   └── voice-channel.test.ts
└── unit/
    └── event-handlers.test.ts
```

**Structure Decision**: Web application with full-stack TypeScript. Uses existing monorepo structure with three main areas:

1. **packages/discord-integration**: Pure Discord API client (reusable, no dependencies on web app)
2. **packages/discord-gateway**: Gateway WebSocket client library (depends on discord-integration)
3. **apps/web**: TanStack Start application (depends on both packages)

Most infrastructure already exists from previous implementations. This feature primarily:
- Enhances existing WebSocket event handling
- Adds room cleanup logic (1-hour inactivity timer)
- Implements session refresh on expiry
- Adds rate limit handling with exponential backoff
- Enforces 4-player room limit
- Implements 24-hour token expiry

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations**. All constitution gates pass. No complexity justification required.
