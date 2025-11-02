# Implementation Plan: Discord Gateway Realtime Communications Platform

**Branch**: `016-realtime-plan` | **Date**: 2025-11-01 | **Spec**: [`/specs/016-realtime-chat-integration/spec.md`](../016-realtime-chat-integration/spec.md)
**Input**: Feature specification from `/specs/016-realtime-chat-integration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Unify the TanStack Start realtime stack so that a single `GatewayWsClient` maintains the Discord Gateway link, distributes all inbound frames across an in-memory event bus, and exposes them through `/api/stream` SSE while routing outbound commands through `createServerFn` handlers with shared rate limiting, tracing, and backpressure controls. The plan layers on top of the existing voice dropout WebSocket implementation, migrating it to the shared gateway adapter without regressing current voice workflows.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (Bun runtime for scripts, Node.js 20 for Start server)
**Primary Dependencies**: TanStack Start (`@tanstack/react-start`), `ws`, `crossws`, `discord-api-types`, `@repo/discord-gateway`, `zod`
**Storage**: N/A (in-memory event bus and queues only)
**Testing**: Vitest for unit tests, Playwright for browser contract checks where required
**Target Platform**: TanStack Start server on Node.js 20, browser clients consuming SSE
**Project Type**: Web application (server + client within `apps/web`)
**Performance Goals**: ≤400 ms p95 Gateway→SSE latency, ≤100 ms p95 command dispatch, reconnect within 30 s, sustain 100 msgs/s baseline with 500 msgs/s bursts
**Constraints**: Keep secrets server-side (`LINK_TOKEN`, `DISCORD_BOT_TOKEN`), cap outbound queue at 1000 entries, reuse existing voice dropout UX, SSE heartbeat every 15 s
**Scale/Scope**: Single Discord guild deployment, hundreds of concurrent SSE clients, reuse across chat, voice membership, and moderation events

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Browser-First Architecture**: ✅ Social features (Discord connectivity) are permitted server-side; plan keeps gameplay features client-first while ensuring realtime Discord integration remains optional for offline play.
- **Data Contract Discipline**: ⚠️ Requires explicit versioned contracts for Gateway frames and SSE payloads—current voice events lack version fields. Address during Phase 1 by versioning TypeScript types and documenting schemas.
- **User-Centric Prioritization**: ✅ Plan aligns with user stories prioritizing realtime feedback and continuity of voice dropout protections.
- **Specification-Driven Development**: ✅ Working directly from spec and producing plan artifacts.
- **Monorepo Package Isolation**: ✅ Changes confined to `apps/web` server/client boundary and shared `packages/discord-gateway` types without breaking isolation.
- **Performance Through Optimization, Not Complexity**: ✅ Focus on consolidating sockets and reducing duplication rather than adding extra infrastructure.
- **Open Source and Community-Driven**: ✅ Documentation updates (quickstart, contracts) ensure contributors can adopt unified gateway path.

**Gate Result**: ⚠️ Conditional approval pending addition of version metadata to contracts in Phase 1.

*Post-Phase 1 Update*: ✅ Versioned envelopes (`version: "1.0"`) documented in `contracts/openapi.yaml`; gate satisfied.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
apps/web/
├── src/
│   ├── server/
│   │   ├── gateway/
│   │   │   ├── gateway-ws.client.ts      # new singleton GatewayWsClient implementation
│   │   │   ├── event-bus.ts              # in-memory event bus abstraction
│   │   │   ├── command-queue.ts          # outbound queue + rate limiting helpers
│   │   │   └── sse-router.server.ts      # `/api/stream` handler
│   │   ├── actions/
│   │   │   ├── send-message.ts
│   │   │   ├── add-reaction.ts
│   │   │   └── typing-start.ts
│   │   ├── legacy/
│   │   │   └── voice-bridge.ts           # adapter feeding existing voice hooks from bus
│   │   └── metrics/
│   │       └── gateway-metrics.ts        # counters, histograms, gauges
│   ├── hooks/
│   │   └── useVoiceChannelEvents.ts      # updated to consume unified bus/SSE
│   └── routes/
│       └── api/
│           ├── stream.ts                 # SSE endpoint (imports from gateway)
│           └── internal/events.ts        # deprecated wrapper, forwards to bus when enabled
└── tests/
    ├── server/gateway-ws.test.ts
    └── integration/realtime-bridge.test.ts
```

**Structure Decision**: Extend existing `apps/web/src/server` hierarchy with a dedicated `gateway/` module housing the singleton client, event bus, command queue, and SSE route. Update existing hooks within `apps/web/src/hooks` to consume the new event bus through an adapter in `server/legacy`. Add focused server and integration tests under `apps/web/tests` to validate contract handling and migration safety.

## Complexity Tracking

No constitution violations require additional justification at this stage.
