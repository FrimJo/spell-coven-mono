# Data Model: Discord Gateway Realtime Communications Platform

## GatewayWsClient
- **Purpose**: Maintain a singleton WebSocket connection from TanStack Start to the gateway service.
- **Fields**:
  - `state: 'idle' | 'connecting' | 'connected' | 'reconnecting'`
  - `ws: WebSocket | null`
  - `eventBus: EventBus<GatewayEvent>`
  - `commandQueue: CommandQueue`
  - `pendingPings: Map<string, number>` (traceId → sent timestamp for RTT metrics)
  - `reconnectTimer: NodeJS.Timeout | null`
  - `listeners: Set<(event: GatewayEvent) => void>` (delegates to `eventBus`)
- **Relationships**:
  - Publishes to `EventBus`
  - Consumed by SSE route, server functions, legacy adapters
- **Validation/Constraints**:
  - Only one active `WebSocket`
  - Requires `LINK_TOKEN` env var; fails fast if missing
  - Reconnect backoff 1s → 30s with jitter

## EventBus<T>
- **Purpose**: Fan out gateway events across server modules.
- **Fields**:
  - `subscribers: Set<(event: T) => void>`
- **Relationships**:
  - Receives events from `GatewayWsClient`
  - SSE stream and legacy bridge subscribe
- **Validation/Constraints**:
  - Synchronous dispatch; wrap handler exceptions to avoid breaking publisher

## CommandEnvelope
- **Purpose**: Track outbound command lifecycle for retries and metrics.
- **Fields**:
  - `command: GatewayCommand`
  - `requestId: string`
  - `traceId: string`
  - `enqueuedAt: number`
  - `attempts: number`
  - `nextAttemptAt: number`
- **Relationships**:
  - Stored in `CommandQueue`
  - Dequeued by `GatewayWsClient` when connection available
- **Validation/Constraints**:
  - Queue size capped at 1000
  - Attempts escalate backoff up to 30 000 ms

## CommandQueue
- **Purpose**: Buffer commands while gateway unavailable and enforce rate limits.
- **Fields**:
  - `items: CommandEnvelope[]`
  - `timer: NodeJS.Timeout | null`
- **Relationships**:
  - Managed by `GatewayWsClient`
- **Validation/Constraints**:
  - FIFO ordering maintained
  - Emits 503 when full

## RateLimiterState
- **Purpose**: Enforce per-user and per-channel quotas in server functions.
- **Fields**:
  - `buckets: Map<string, { tokens: number; updatedAt: number }>` (key format `${userId}:${channelId}`)
- **Relationships**:
  - Called by `sendMessage`, `addReaction`, `typingStart`
- **Validation/Constraints**:
  - Burst = 10 tokens, refill 5 tokens per 5 000 ms
  - Rejects when tokens exhausted → 429

## SseClientSession
- **Purpose**: Track SSE connection lifecycle and cleanup.
- **Fields**:
  - `id: string`
  - `controller: ReadableStreamDefaultController<string>`
  - `unsub: () => void`
  - `heartbeatTimer: NodeJS.Timeout`
- **Relationships**:
  - Created per `/api/stream` request
  - Subscribes to `EventBus`
- **Validation/Constraints**:
  - Heartbeat every 15 000 ms as comment
  - Cleanup unsubscribes and clears timer on close

## LegacyBridgeAdapter
- **Purpose**: Feed existing `/api/ws` endpoint and React voice hooks using the new event bus.
- **Fields**:
  - `enabled: boolean` (feature flag)
  - `relay: (event: GatewayEvent) => void`
- **Relationships**:
  - Subscribes to `EventBus`
  - Uses `wsManager.broadcastToGuild` when WebSocket fallback active
- **Validation/Constraints**:
  - Only attaches when `/api/ws` feature flag on
  - Filters to voice events expected by current hooks

## LogRecord
- **Purpose**: Provide consistent observability payload for gateway operations.
- **Fields**:
  - `traceId: string`
  - `event: string`
  - `level: 'info' | 'warn' | 'error'`
  - `latencyMs?: number`
  - `metadata: Record<string, string | number | boolean>`
- **Relationships**:
  - Produced by command dispatch, event receipt, and error handling
- **Validation/Constraints**:
  - Must include `traceId` for correlation per spec
