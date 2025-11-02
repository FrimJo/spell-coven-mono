# Feature Specification: Discord Gateway Realtime Communications Platform (TanStack Start ⇄ Gateway ⇄ Discord)

**Feature Branch**: `016-realtime-chat-integration`
**Created**: 2025-11-01
**Status**: Draft
**Input**: User description: "Realtime Chat Integration Spec (TanStack Start ⇄ Gateway ⇄ Discord)"

> **Context Update**: The Spell Coven stack already streams Discord voice signals through bespoke WebSocket hooks (`useVoiceChannelEvents`, `useVoiceChannelMembersFromEvents`) documented in `docs/VOICE_CHANNEL_EVENTS_REFACTOR.md` and related guides. This initiative consolidates those pathways with the chat pipeline and generalizes the Gateway link so that **all** Discord realtime traffic (chat, voice membership, moderation signals, system alerts) flows through a unified Start-side event bus and SSE surface.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stream multi-domain Discord events to web clients (Priority: P1)

An authenticated player opens the Spell Coven web app and immediately begins receiving live Discord activity—text chat, voice membership updates, and system alerts—streamed from the gateway via the `/api/stream` SSE endpoint.

**Why this priority**: Unifying realtime delivery for both the newly scoped chat events and the already shipping voice dropout/member flows removes duplicated sockets (`/api/ws` + `/api/stream`) and positions the app for additional Discord signals without per-feature rewrites.

**Independent Test**: Connect a test browser session, inject representative `messageCreate`, `voice.joined`, and `voice.left` frames from the gateway, and verify they arrive through SSE with trace metadata within the latency budget while existing voice dropout UX (`VoiceDropoutModal`) still triggers correctly.

**Acceptance Scenarios**:

1. **Given** the Start service has a valid link token, **When** it boots, **Then** it establishes and maintains a Gateway WebSocket connection with exponential-backoff reconnect on failure.
2. **Given** the Gateway sends a `messageCreate`, `messageUpdate`, `voice.joined`, or `voice.left` frame, **When** the Start service receives it, **Then** the same payload is emitted to all subscribed SSE clients within 400ms p95 and includes the original `traceId` and channel/user identifiers used by the existing hooks documented in `docs/VOICE_CHANNEL_EVENTS_REFACTOR.md`.
3. **Given** a browser client is connected to `/api/stream`, **When** no Discord events occur for 15 seconds, **Then** the client receives a heartbeat comment `: ping` to keep the stream alive.
4. **Given** a client disconnects from SSE, **When** the underlying stream closes, **Then** the Start service cleans up timers, unsubscribes from the event bus without leaking listeners, and any legacy `/api/ws` bridge used by `useVoiceChannelEvents` becomes optional behind a feature flag.

---

### User Story 2 - Send Discord commands from the browser (Priority: P2)

An authorized player (or moderator) issues Discord commands—sending chat messages, acknowledging voice dropouts, reacting, starting typing indicators—through a unified server function interface backed by the Gateway WebSocket.

**Why this priority**: Bidirectional messaging and control keep the UI in parity with Discord without reintroducing separate pathways for voice and text; refactoring outbound flows now keeps future moderation/admin actions (mute, move member, etc.) within the same abstraction.

**Independent Test**: Call the `sendMessage`, `addReaction`, and `typingStart` server functions with valid inputs, observe the Gateway command payloads on the wire, and confirm Discord receives them while unauthorized users receive 403 responses. Validate that the legacy voice rejoin button continues functioning by dispatching commands through the shared Gateway client instead of bespoke fetch calls.

**Acceptance Scenarios**:

1. **Given** a user with the `chat:write` role, **When** they invoke `sendMessage` with valid data, **Then** the server validates inputs via Zod, assigns `traceId`/`requestId`, forwards a `sendMessage` command over WebSocket, and returns `{ ok: true }` while emitting structured logs consumable by the existing observability tooling described in `docs/IMPLEMENTATION_SUMMARY.md`.
2. **Given** a user without the `chat:write` role, **When** they call `sendMessage`, **Then** the server function returns 403 without contacting the Gateway.
3. **Given** the Gateway replies with a `rateLimited` or `error` frame for any command, **When** Start processes it, **Then** the caller receives a 429 or 502 response with a safe error message while the command queue honors retry policies and surfaces rate-limit diagnostics alongside the existing WebSocket voice metrics.
4. **Given** a user exceeds per-channel or per-user limits (5 msgs / 5s, burst 10), **When** they continue sending, **Then** Start rejects additional calls with 429 until tokens replenish.

---

### User Story 3 - Migrate existing realtime consumers to the unified bus (Priority: P3)

Existing gameplay surfaces—`useVoiceChannelEvents`, `useVoiceChannelMembersFromEvents`, and the `VoiceDropoutModal`—continue to function after the refactor, now consuming the consolidated event bus rather than bespoke WebSocket listeners.

**Why this priority**: Avoid regressions in production voice experiences while delivering the generalized infrastructure. The migration demonstrates backward compatibility and justifies decommissioning the legacy `/api/ws` endpoint.

**Independent Test**: Run the current dropout detection workflow end-to-end (remove a user from a Discord voice channel) while the new Gateway client and SSE route are active, confirm the modal still appears and rejoin actions succeed, and ensure no second WebSocket connection is established in DevTools.

**Acceptance Scenarios**:

1. **Given** the legacy voice hooks subscribe to gateway events, **When** the unified event bus emits `voice.left`, **Then** the modal renders exactly as described in `docs/IMPLEMENTATION_SUMMARY.md` without code duplication.
2. **Given** the Gateway disconnects mid-command, **When** Start attempts to send `typingStart` or a future voice control command, **Then** the command queue buffers it (up to 1000 entries) and retries after reconnect; if the queue is full, Start responds 503 with a descriptive error and the voice modal surfaces a toast.
3. **Given** the Gateway emits an `error` frame related to voice or chat operations, **When** Start receives it, **Then** it logs the failure with trace metadata and broadcasts the error to SSE subscribers for operator awareness, allowing existing ops dashboards to alert.

---

### Edge Cases

- What happens when the Gateway WebSocket repeatedly fails to connect? → Start escalates backoff up to 30s, exposes `ws.connected` gauge = 0, logs failures with trace IDs, and continues retrying while rejecting new outbound commands beyond the queue limit with 503 errors. Legacy `/api/ws` consumers detect the feature flag and gracefully fall back to the shared SSE stream.
- How does system handle malformed frames from the Gateway? → Frames fail schema validation, trigger error logging with trace metadata, and emit an `error` SSE event without crashing the process, mirroring the defensive parsing used in the existing voice hooks.
- What happens when browser SSE clients rapidly reconnect (e.g., flaky network)? → Start re-registers event listeners per connection, ensures cleanup on close, and enforces heartbeat cadence without exceeding resource limits.
- How does system handle oversized message payloads (>2000 chars)? → Zod validation fails, and the server function responds with 400 including field-level error details.
- What happens if LINK_TOKEN authentication fails during WS upgrade? → Start logs the auth failure, surfaces metrics, and retries connection after updating credentials; outbound commands remain queued until a connection is re-established or queue limits are reached.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a singleton `GatewayWsClient` that authenticates with `Authorization: Bearer ${LINK_TOKEN}` and automatically reconnects with exponential backoff (1s → 30s).
- **FR-002**: System MUST translate inbound `GatewayEvent` frames—including chat, voice membership, and moderation/system signals defined in existing docs—into `SseEvent` payloads and stream them to all connected browsers via `/api/stream` using proper SSE headers and 15s heartbeats.
- **FR-003**: System MUST expose `sendMessage`, `addReaction`, `typingStart`, and any migrated voice control operations via `createServerFn` that validate inputs with Zod and enforce role-based authorization.
- **FR-004**: System MUST attach `traceId`, `sentAt`, and `requestId` metadata to every outbound `GatewayCommand` and log command lifecycle events with latency measurements.
- **FR-005**: System MUST implement per-user and per-channel token-bucket rate limiting (5 actions per 5 seconds, burst 10) and translate Gateway rate limit signals into 429 responses.
- **FR-006**: System MUST cap the outbound command queue at 1000 entries, returning 503 when the queue is saturated during Gateway outages.
- **FR-007**: System MUST emit metrics for message counts, voice membership churn, WebSocket RTT, SSE flush duration, and connection state gauges to support observability targets.
- **FR-008**: System MUST sanitize user-generated content before logging or re-broadcasting to prevent injection or log forging.
- **FR-009**: System MUST map validation failures to HTTP 400, authentication failures to 401, authorization failures to 403, Gateway outages to 502, and rate limit breaches to 429.
- **FR-010**: System MUST ensure secrets such as `LINK_TOKEN` and `DISCORD_BOT_TOKEN` remain server-side and are never exposed to the browser.
- **FR-011**: System MUST deprecate or wrap the legacy `/api/ws` endpoint so existing hooks adopt the unified event stream without code duplication.

### Key Entities *(include if feature involves data)*

- **GatewayWsClient**: Represents the Start-side WebSocket client responsible for connecting to the Gateway, queueing commands, handling reconnect logic, and dispatching `GatewayEvent` frames onto the event bus while replacing bespoke sockets referenced in `docs/VOICE_CHANNEL_EVENTS_REFACTOR.md`.
- **EventBus**: In-memory publish/subscribe utility that Start uses to fan out `GatewayEvent` data to SSE streams, voice dropout handlers, and other server consumers.
- **SseClientSession**: Logical representation of each browser connection to `/api/stream`, including heartbeat timer management and unsubscribe callbacks for cleanup.
- **CommandEnvelope**: Structured payload for outbound operations containing `GatewayCommand` data, associated `requestId`, `traceId`, enqueue timestamps, and retry counters for backoff handling.
- **UserContext**: Derived authentication object capturing `userId` and role assignments used to evaluate authorization rules for server functions.
- **LegacyBridgeAdapter**: Temporary abstraction that allows existing WebSocket hooks to consume the unified SSE/event bus stream until those clients are refactored, preventing regressions during rollout.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95th percentile latency from Gateway event receipt to SSE delivery remains ≤ 400ms during local integration tests for both chat and voice membership events.
- **SC-002**: 95% of outbound commands reach the Gateway within 100ms when the WebSocket link is healthy.
- **SC-003**: Unauthorized `sendMessage` attempts consistently return HTTP 403 with zero Gateway transmissions in 100% of test cases.
- **SC-004**: Start service automatically re-establishes the Gateway WebSocket within 30 seconds of an outage in 99% of simulated failures without manual intervention.
- **SC-005**: Load testing with 100 concurrent clients sending 10 mixed commands (chat + voice control) per second for 60 seconds yields ≤ 1% error responses and ≤ 800ms SSE delivery p95.
- **SC-006**: All command and event logs include a `traceId`, enabling end-to-end correlation during observability audits and mapping back to the existing dropout metrics dashboard.
- **SC-007**: After migration, DevTools shows a single persistent SSE connection for realtime Discord data and no redundant `/api/ws` connection when navigating GameRoom flows.
