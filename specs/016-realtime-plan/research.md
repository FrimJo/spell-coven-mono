# Research Findings: Discord Gateway Realtime Communications Platform

## Decision 1: Versioned Event Envelopes (`v1.0`)
- **Decision**: Introduce a `version` field on all inbound `GatewayEvent` and outbound `SseEvent`/`GatewayCommand` envelopes with initial value `"1.0"`, retaining type/data/meta structure from the spec.
- **Rationale**: Aligns with the constitution's Data Contract Discipline (version metadata) and enables future additions (e.g., voice moderation events) without breaking consumers.
- **Alternatives considered**:
  - *Implicit versioning via TypeScript types*: Rejected because runtime consumers (SSE clients, legacy WebSocket bridge) require explicit version negotiation per constitution.
  - *Semantic version per event type*: Overkill for current scope; envelope-level version provides consistent upgrade path.

## Decision 2: Singleton Gateway Client with Lazy Connect
- **Decision**: Implement `GatewayWsClient` as a module-level singleton that lazily connects on first `start()` call and reuses the same `ws` instance across requests using Node's global scope.
- **Rationale**: TanStack Start server routes run in a long-lived Node process; lazy initialization avoids connection attempts during build and ensures we only connect when SSE/server functions need it. Mirrors existing voice WebSocket manager's singleton pattern.
- **Alternatives considered**:
  - *Per-request instantiation*: Violates latency/queue requirements and would amplify Discord rate limits.
  - *Dependency injection container*: Unnecessary complexity compared to module singleton.

## Decision 3: In-Memory Event Bus via `Set` Subscribers
- **Decision**: Build a lightweight event bus that keeps a `Set` of subscriber callbacks and synchronously invokes them for each `GatewayEvent`.
- **Rationale**: Avoids pulling additional dependencies; current voice hooks rely on synchronous dispatch for minimal latency. Simple `Set` ensures O(n) fan-out while enabling efficient unsubscribe.
- **Alternatives considered**:
  - *Node `EventEmitter`*: Brings listener leak warnings and string-based channels we don't need.
  - *RxJS/observable*: Adds heavy dependency for little benefit.

## Decision 4: Token Bucket Rate Limiter per `(userId, channelId)`
- **Decision**: Store limiter state in a nested `Map` keyed by user and channel, replenishing tokens every 5 seconds via timestamp math.
- **Rationale**: Satisfies spec requirement (5 msgs per 5s, burst 10) without background timers. Similar approach already used in `packages/discord-gateway` heartbeat/backoff handling.
- **Alternatives considered**:
  - *External store (Redis)*: Violates constraint against adding new infrastructure.
  - *Leaky bucket queue*: More complex and unnecessary for the given thresholds.

## Decision 5: Legacy Voice Bridge via Server-Sent Events
- **Decision**: Maintain `/api/ws` temporarily by wiring it to consume the new event bus, but gate it behind a feature flag so React hooks transition to consuming SSE (and eventually can drop the WebSocket path).
- **Rationale**: Ensures backwards compatibility per spec while allowing incremental migration. Keeps the modal working even if SSE client work lags.
- **Alternatives considered**:
  - *Immediate removal of `/api/ws`*: Risky; existing hooks expect it today.
  - *Dual publish from Gateway client*: Would duplicate logic and complicate cleanup; better to funnel through one bus and adapt at edges.

## Decision 6: Command Queue with Exponential Backoff
- **Decision**: Maintain a FIFO queue capped at 1000 entries storing command + metadata. If gateway disconnected, enqueue and schedule retries with decorrelated jitter (base 1000 ms, multiplier 2, max 30 s).
- **Rationale**: Meets spec's backpressure requirements and leverages existing reconnect targets (1 s → 30 s). Decorrelated jitter prevents thundering herd when reconnecting multiple commands.
- **Alternatives considered**:
  - *Immediate rejection when disconnected*: Fails acceptance scenario requiring automatic retry.
  - *Promise-based queue with await*: Harder to integrate with SSE/event bus; simple timer loop is sufficient.
