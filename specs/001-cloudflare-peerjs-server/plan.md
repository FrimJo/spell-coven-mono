# Implementation Plan: Cloudflare Durable Objects PeerJS Server

**Branch**: `001-cloudflare-peerjs-server` | **Date**: 2025-01-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-cloudflare-peerjs-server/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a Cloudflare Durable Objects-based WebSocket signaling server that implements the PeerJS protocol for coordinating peer-to-peer WebRTC connections between game players. The server will replace the existing Node.js PeerJS server with a globally distributed, edge-deployed solution that maintains connection state using Durable Objects and the WebSocket Hibernation API. The implementation must be protocol-compatible with existing PeerJS clients, support 2-4 concurrent peers per game room, and achieve sub-200ms signaling latency globally.

## Technical Context

**Language/Version**: TypeScript 5.3+ / JavaScript ES2022 (Cloudflare Workers runtime)  
**Primary Dependencies**: 
- Cloudflare Workers runtime
- Durable Objects API
- WebSocket Hibernation API
- Wrangler CLI (deployment)
- NEEDS CLARIFICATION: PeerJS protocol specification version and message format details

**Storage**: Durable Objects in-memory state (ephemeral, no persistent storage required)  
**Testing**: Vitest for unit tests, Miniflare for local Durable Objects testing, NEEDS CLARIFICATION: integration testing strategy for WebSocket connections  
**Target Platform**: Cloudflare Workers (edge runtime, globally distributed)  
**Project Type**: Single service (signaling server)  
**Performance Goals**: 
- Sub-200ms signaling latency (95th percentile) globally
- Support 1000 concurrent game rooms (4000 peer connections)
- 99.9% connection success rate
- Sub-100ms Durable Object reactivation from hibernation

**Constraints**: 
- Cloudflare Workers CPU time limits (50ms per request, 30s per WebSocket message)
- Durable Objects memory limits (128MB per object)
- WebSocket connection limits per Durable Object (NEEDS CLARIFICATION: exact limit)
- Must be protocol-compatible with existing PeerJS client library (no client changes)
- Free tier limits: 100,000 requests/day, 1000 Durable Objects

**Scale/Scope**: 
- 2-4 peers per game room (mesh topology)
- Up to 1000 concurrent game rooms initially
- Message types: heartbeat, offer, answer, candidate, leave
- NEEDS CLARIFICATION: Expected message throughput per peer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ⚠️ Constitution file is a template and needs to be populated with project-specific principles.

**Preliminary Assessment** (to be validated once constitution is defined):
- **New Service**: This adds a new Cloudflare Workers service to the monorepo (currently has: web app, discord-gateway, peerjs-server)
- **Justification**: Replacing Node.js PeerJS server with edge-deployed solution for better global performance
- **Testing Approach**: Will require integration tests for WebSocket signaling protocol
- **Deployment**: New deployment target (Cloudflare Workers) separate from existing infrastructure

**Action Required**: Populate `.specify/memory/constitution.md` with project principles before proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-cloudflare-peerjs-server/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── websocket-api.yaml    # WebSocket message protocol
│   └── http-api.yaml         # Health check endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/cloudflare-peerjs-server/     # New Cloudflare Workers service
├── src/
│   ├── index.ts                   # Worker entry point, HTTP request handler
│   ├── durable-objects/
│   │   └── GameRoomCoordinator.ts # Durable Object for game room state
│   ├── protocol/
│   │   ├── messages.ts            # PeerJS message type definitions
│   │   ├── validator.ts           # Message validation logic
│   │   └── router.ts              # Message routing to peers
│   ├── handlers/
│   │   ├── websocket.ts           # WebSocket connection handler
│   │   ├── heartbeat.ts           # Heartbeat/ping-pong logic
│   │   └── health.ts              # Health check endpoint
│   └── lib/
│       ├── peer-registry.ts       # Peer connection tracking
│       ├── rate-limiter.ts        # Rate limiting logic
│       └── logger.ts              # Structured logging
│
├── tests/
│   ├── unit/
│   │   ├── protocol/              # Message validation tests
│   │   ├── handlers/              # Handler unit tests
│   │   └── lib/                   # Utility tests
│   ├── integration/
│   │   ├── signaling.test.ts      # End-to-end signaling tests
│   │   ├── multi-peer.test.ts     # Multi-peer coordination tests
│   │   └── hibernation.test.ts   # Hibernation API tests
│   └── contract/
│       └── peerjs-protocol.test.ts # Protocol compatibility tests
│
├── wrangler.toml                  # Cloudflare Workers configuration
├── package.json
├── tsconfig.json
└── vitest.config.ts               # Test configuration
```

**Structure Decision**: Single service architecture using Cloudflare Workers with Durable Objects. The service will be deployed as a new app in the monorepo (`apps/cloudflare-peerjs-server/`) alongside the existing web app and other services. This structure follows Cloudflare Workers best practices with a clear separation between the Worker entry point, Durable Object implementation, protocol handling, and supporting utilities.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Status**: No violations identified. This is a straightforward single-service implementation using Cloudflare's standard patterns.

---

## Phase Status

### ✅ Phase 0: Research (COMPLETE)
**Output**: `research.md`

**Key Decisions**:
- PeerJS Protocol v0.3.x (compatible with existing clients)
- 10 WebSocket connections per Durable Object (4 peers + buffer)
- Miniflare + Vitest for testing
- 100 messages/second per peer rate limit
- WebSocket Hibernation API for efficiency

**All NEEDS CLARIFICATION items resolved**

### ✅ Phase 1: Design & Contracts (COMPLETE)
**Outputs**: 
- `data-model.md` - Entity definitions and relationships
- `contracts/websocket-api.yaml` - WebSocket message protocol
- `contracts/http-api.yaml` - Health check endpoints
- `quickstart.md` - Development and deployment guide
- `.windsurf/rules/specify-rules.md` - Updated agent context

**Key Artifacts**:
- 4 core entities: Peer, Game Room, Signaling Message, Rate Limit State
- Complete OpenAPI specs for WebSocket and HTTP APIs
- Comprehensive quickstart guide with testing instructions

### 🔄 Phase 2: Tasks Generation (PENDING)
**Next Command**: `/speckit.tasks`

This will generate `tasks.md` with dependency-ordered implementation tasks based on the design artifacts created in Phase 1.

---

## Constitution Check - Post-Design Review

**Status**: ⚠️ Constitution file is still a template. Once populated, verify:
- Testing strategy aligns with project principles
- New service addition is justified
- Deployment approach follows standards
- Documentation meets requirements

**No blocking issues identified in design phase.**
