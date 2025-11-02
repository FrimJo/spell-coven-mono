# Discord Gateway Real-Time Communication Spec (TanStack Start ⇄ Discord Gateway)

> Version: 2.0  
> Owner: Platform / Realtime  
> Status: Active (partially implemented, refactoring in progress)  
> Language & Stack: **TypeScript**, TanStack Start (server functions via `createServerFn`), Node.js, `ws`, Discord Gateway API  
> Goal: Provide a **spec-first** blueprint for general-purpose Discord Gateway integration suitable for LLM-assisted development and code review.

---

## 1. Problem Statement

We need a low-latency, reliable Discord Gateway integration in a web app that:
- Receives Discord-originated events (voice state changes, channel updates, etc.) in near real-time.
- Maintains a persistent connection to Discord Gateway for event streaming.
- Keeps all **secrets on the server** (bot token never exposed to client).
- Supports real-time features like voice channel monitoring, room management, and future chat integration.

**Constraints:**
- The Discord Gateway runs as a **separate Node.js service** in `/apps/discord-gateway`.
- **Discord Gateway ↔ TanStack Start Backend** communicate via **WebSocket** (duplex, low-latency).
- **TanStack Start Backend → Browser** uses **SSE** (Server-Sent Events) for real-time event streaming.
- **Browser → TanStack Start Backend** uses **`createServerFn`** for server function calls (abstracted RPC, HTTP POST under the hood).

---

## 2. High-Level Architecture

```
Discord Gateway API (wss://gateway.discord.gg)
        │
        ▼
  [Discord Gateway Service - /apps/discord-gateway]
   ┌─────────────────────────────────────────┐
   │ Discord Gateway Client                   │
   │  - Maintains WebSocket to Discord       │
   │  - Handles heartbeats & reconnection    │
   │  - Processes VOICE_STATE_UPDATE, etc.   │
   │  - Owns DISCORD_BOT_TOKEN (server-only) │
   │  - WebSocket server for TanStack Start  │
   └──────────────┬──────────────────────────┘
                  │  (wss, LINK_TOKEN auth)
                  ▼
  [TanStack Start Backend - /apps/web]
   ┌─────────────────────────────────────────┐
   │ Gateway WebSocket Client                │
   │  - Connects to Gateway service          │
   │  - Receives Discord events              │
   │  - Sends commands to Gateway            │
   └──────────────┬──────────────────────────┘
                  │
                  ▼
   ┌─────────────────────────────────────────┐
   │ Event Bus (in-memory)                   │
   │  - Receives events from Gateway         │
   │  - Broadcasts to SSE streams            │
   │  - No persistence (stateless)           │
   └──────────────┬──────────────────────────┘
                  │  (HTTP SSE)
                  ▼
       Browser (React Frontend)
   - EventSource('/api/stream') for events
   - Server function calls via createServerFn()
```

**Key Design Decisions:**
- **Separate Gateway Service**: Dedicated Node.js service for Discord Gateway connection
- **WebSocket Communication**: Gateway ↔ TanStack Start Backend (duplex, low-latency)
- **LINK_TOKEN Authentication**: Secure authentication between services
- **SSE to Browser**: Unidirectional event streaming (simple, reliable)
- **Server Functions**: Type-safe RPC via `createServerFn` (abstracted network calls)

**Non-goals:** Replace Discord; direct browser↔Discord; persistence/replay of all events (can be added later).

---

## 3. Requirements

### Functional
1. **Receive Discord events** (VOICE_STATE_UPDATE, CHANNEL_CREATE, CHANNEL_DELETE, etc.) in real-time.
2. **Stream events** to authenticated browser clients via SSE (Server-Sent Events).
3. **Voice channel monitoring**: Track users joining/leaving voice channels.
4. **Room management**: Detect channel creation/deletion events.
5. **User authentication**: Session-based authentication for SSE streams.
6. **Automatic reconnection**: Handle Discord Gateway disconnects gracefully.
7. **Future extensibility**: Support for chat messages, reactions, and other Discord events.

### Non-Functional
- **Latency target:** p50 ≤ 100ms, p95 ≤ 300ms for event delivery (Discord → Browser).
- **Availability:** 99.9% monthly for Gateway connection.
- **Throughput:** ≥ 100 events/s aggregate sustained; bursts up to 500 events/s for 1s.
- **Security:** Bot token server-only; session-based authentication for SSE streams; no secrets exposed to client.
- **Observability:** Structured logging with timestamps, event types, and user IDs.

---

## 4. Data Contracts (TypeScript-first)

### 4.1 Common Types
```ts
// @repo/discord-integration/src/types/events.ts
export type DiscordSnowflake = string // Discord ID (e.g., "123456789012345678")

export type VoiceEventName = 
  | 'voice.joined'
  | 'voice.left'
  | 'room.created'
  | 'room.deleted'
```

### 4.2 Discord Gateway Events (Internal)
**Voice Events:**
```ts
export interface VoiceJoinedPayload {
  guildId: DiscordSnowflake
  channelId: DiscordSnowflake
  userId: DiscordSnowflake
  username: string
  avatar: string | null
}

export interface VoiceLeftPayload {
  guildId: DiscordSnowflake
  channelId: null
  userId: DiscordSnowflake
}
```

**Room Events:**
```ts
export interface RoomCreatedPayload {
  guildId: DiscordSnowflake
  channelId: DiscordSnowflake
  name: string
  parentId?: DiscordSnowflake
  userLimit: number
}

export interface RoomDeletedPayload {
  guildId: DiscordSnowflake
  channelId: DiscordSnowflake
}
```

### 4.3 Gateway ↔ TanStack Start WebSocket Protocol
**Message Envelope:**
```ts
export interface GatewayMessage {
  type: 'event' | 'command' | 'ack' | 'error'
  data: unknown
  requestId?: string
  ts: number
}
```

**Events (Gateway → Start):**
```ts
// Discord events forwarded to TanStack Start
{
  type: 'event',
  data: {
    event: 'voice.joined' | 'voice.left' | 'room.created' | 'room.deleted',
    payload: VoiceJoinedPayload | VoiceLeftPayload | RoomCreatedPayload | RoomDeletedPayload
  },
  ts: number
}
```

**Commands (Start → Gateway):**
```ts
// Future: Commands from TanStack Start to Discord
{
  type: 'command',
  data: {
    command: 'sendMessage' | 'addReaction',
    payload: unknown
  },
  requestId: string,
  ts: number
}
```

**Authentication:**
- HTTP header on WebSocket upgrade: `Authorization: Bearer ${LINK_TOKEN}`
- LINK_TOKEN shared secret between Gateway and TanStack Start

### 4.4 Browser SSE Protocol (Start → Browser)
**SSE Route:**
- Path: `GET /api/stream`
- Headers: 
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
- Authentication: Session cookie (HTTP-only, secure)
- Heartbeat: `: ping\n\n` every 15 seconds

**Event Format:**
```ts
// SSE message format
event: voice.joined
data: {"guildId":"...","channelId":"...","userId":"...","username":"...","avatar":"..."}

event: voice.left
data: {"guildId":"...","channelId":null,"userId":"..."}

event: room.created
data: {"guildId":"...","channelId":"...","name":"...","userLimit":0}

event: room.deleted
data: {"guildId":"...","channelId":"..."}
```

**Client Usage:**
```ts
const eventSource = new EventSource('/api/stream', {
  withCredentials: true // Include session cookie
})

eventSource.addEventListener('voice.joined', (e) => {
  const payload: VoiceJoinedPayload = JSON.parse(e.data)
  // Handle event
})

eventSource.addEventListener('voice.left', (e) => {
  const payload: VoiceLeftPayload = JSON.parse(e.data)
  // Handle event
})
```

### 4.5 Server Function Calls (`createServerFn`)

**Pattern**: Type-safe RPC from browser to server (HTTP POST under the hood, but abstracted)

```ts
// Server-side definition
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(100),
  userLimit: z.number().min(0).max(99).optional(),
})

export const createRoom = createServerFn({ method: 'POST' })
  .validator(CreateRoomSchema)
  .handler(async ({ data }) => {
    // Server-only logic
    const channel = await discordClient.createVoiceChannel(data)
    return { channelId: channel.id }
  })

// Client-side usage (no explicit HTTP calls)
import { createRoom } from '@/server/handlers/discord-rooms.server'

function CreateRoomButton() {
  const handleCreate = async () => {
    // Looks like a regular function call, but executes on server
    const result = await createRoom({ 
      data: { name: 'My Room', userLimit: 4 } 
    })
    console.log('Created channel:', result.channelId)
  }
  
  return <button onClick={handleCreate}>Create Room</button>
}
```

**Key Characteristics:**
- ✅ Type-safe: Full TypeScript inference from server to client
- ✅ Validated: Zod schemas ensure runtime type safety
- ✅ Abstracted: No manual HTTP requests, fetch calls, or URL construction
- ✅ Serializable: Automatic serialization/deserialization of data
- ✅ Error handling: Server errors propagate to client as exceptions

---

## 5. Server-Side Interfaces

### 5.0 Separation of Concerns & Abstraction Layers

**Design Principle**: Use interface-based abstractions to enable future integration of third-party services (Redis, Supabase, etc.) without changing business logic.

#### Event Bus Abstraction
```ts
// Abstraction for event distribution
export interface IEventBus<T> {
  on(handler: (event: T) => void): () => void
  emit(event: T): void
}

// Current: In-memory implementation
export class InMemoryEventBus<T> implements IEventBus<T> { /* ... */ }

// Future: Redis Pub/Sub implementation
export class RedisEventBus<T> implements IEventBus<T> {
  constructor(private redis: RedisClient) {}
  on(handler: (event: T) => void): () => void { /* Redis SUBSCRIBE */ }
  emit(event: T): void { /* Redis PUBLISH */ }
}
```

#### Session Store Abstraction
```ts
// Abstraction for session management
export interface ISessionStore {
  get(sessionId: string): Promise<Session | null>
  set(sessionId: string, session: Session, ttl?: number): Promise<void>
  delete(sessionId: string): Promise<void>
}

// Current: In-memory/cookie-based
export class CookieSessionStore implements ISessionStore { /* ... */ }

// Future: Redis sessions
export class RedisSessionStore implements ISessionStore { /* ... */ }

// Future: Supabase sessions
export class SupabaseSessionStore implements ISessionStore { /* ... */ }
```

#### Event Persistence Abstraction
```ts
// Abstraction for event history/replay
export interface IEventStore {
  append(event: DiscordEvent): Promise<void>
  getEventsSince(timestamp: number): Promise<DiscordEvent[]>
  getEventsForGuild(guildId: string, limit: number): Promise<DiscordEvent[]>
}

// Current: No persistence (null implementation)
export class NoOpEventStore implements IEventStore {
  async append(): Promise<void> {}
  async getEventsSince(): Promise<DiscordEvent[]> { return [] }
  async getEventsForGuild(): Promise<DiscordEvent[]> { return [] }
}

// Future: Supabase event log
export class SupabaseEventStore implements IEventStore { /* ... */ }

// Future: PostgreSQL event log
export class PostgresEventStore implements IEventStore { /* ... */ }
```

#### Gateway Connection Registry Abstraction
```ts
// Abstraction for tracking active Gateway connections (for horizontal scaling)
export interface IGatewayRegistry {
  register(instanceId: string, metadata: GatewayMetadata): Promise<void>
  unregister(instanceId: string): Promise<void>
  getActiveInstances(): Promise<GatewayMetadata[]>
  heartbeat(instanceId: string): Promise<void>
}

// Current: Single instance (no registry needed)
export class SingleInstanceRegistry implements IGatewayRegistry { /* ... */ }

// Future: Redis-based registry for multiple instances
export class RedisGatewayRegistry implements IGatewayRegistry { /* ... */ }
```

#### Dependency Injection Pattern
```ts
// Configuration object for injecting implementations
export interface ServiceConfig {
  eventBus: IEventBus<DiscordEvent>
  sessionStore: ISessionStore
  eventStore: IEventStore
  gatewayRegistry: IGatewayRegistry
}

// Factory for creating service instances
export function createServices(config?: Partial<ServiceConfig>): ServiceConfig {
  return {
    eventBus: config?.eventBus ?? new InMemoryEventBus(),
    sessionStore: config?.sessionStore ?? new CookieSessionStore(),
    eventStore: config?.eventStore ?? new NoOpEventStore(),
    gatewayRegistry: config?.gatewayRegistry ?? new SingleInstanceRegistry(),
  }
}
```

### 5.1 Discord Gateway Service (/apps/discord-gateway)
```ts
// Discord Gateway Client (connects to Discord)
export class DiscordGatewayClient {
  constructor(config: GatewayConfig)
  
  connect(): Promise<void>
  disconnect(): void
  onEvent(callback: (event: string, data: unknown) => void): void
  getState(): ConnectionState
}

// WebSocket Server (for TanStack Start connections)
export class GatewayWebSocketServer {
  constructor(config: ServerConfig)
  
  start(): Promise<void>
  broadcast(event: string, payload: unknown): void
  onCommand(callback: (command: string, payload: unknown) => void): void
}

export interface GatewayConfig {
  botToken: string
  primaryGuildId: string
}

export interface ServerConfig {
  port: number
  linkToken: string
}

export type ConnectionState = 
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'IDENTIFYING'
  | 'CONNECTED'
  | 'RECONNECTING'
```

### 5.2 TanStack Start Gateway Client
```ts
// apps/web/src/server/gateway-client.ts
export class GatewayWebSocketClient {
  constructor(config: ClientConfig)
  
  connect(): Promise<void>
  disconnect(): void
  onEvent(callback: (event: string, payload: unknown) => void): void
  sendCommand(command: string, payload: unknown): Promise<void>
  isConnected(): boolean
}

export interface ClientConfig {
  gatewayUrl: string
  linkToken: string
}
```

### 5.3 Event Bus (In-Memory)
```ts
// apps/web/src/server/event-bus.ts
export interface EventBus<T> {
  on(handler: (event: T) => void): () => void // Returns unsubscribe function
  emit(event: T): void
}

export class InMemoryEventBus<T> implements EventBus<T> {
  private handlers: Set<(event: T) => void> = new Set()
  
  on(handler: (event: T) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
  
  emit(event: T): void {
    for (const handler of this.handlers) {
      handler(event)
    }
  }
}

// Singleton instance for Discord events
export const discordEventBus = new InMemoryEventBus<DiscordEvent>()
```

### 5.4 SSE Route Contract
- Path: `GET /api/stream`
- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`
- Authentication: Session cookie (verified in route handler)
- Heartbeat: `: ping\n\n` every 15 seconds
- Close: Unsubscribe from event bus, cleanup timers
- Stateless: No per-client buffer, events during disconnect are lost

### 5.5 Server Functions (`createServerFn`)

**Pattern**: Define server functions that clients can call like regular functions

```ts
// apps/web/src/server/handlers/discord-rooms.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// Define with validation
export const createRoom = createServerFn({ method: 'POST' })
  .validator(z.object({
    name: z.string().min(1).max(100),
    userLimit: z.number().min(0).max(99).optional(),
  }))
  .handler(async ({ data }) => {
    // Verify session
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')
    
    // Server-only logic
    const channel = await discordClient.createVoiceChannel(data)
    return { channelId: channel.id }
  })

export const joinRoom = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string() }))
  .handler(async ({ data }) => { /* ... */ })

export const connectUserToVoiceChannel = createServerFn({ method: 'POST' })
  .validator(z.object({
    guildId: z.string(),
    channelId: z.string(),
    userId: z.string(),
  }))
  .handler(async ({ data }) => { /* ... */ })
```

**Usage from Client:**
```ts
// No HTTP calls, just function invocation
const result = await createRoom({ data: { name: 'My Room' } })
```

**Note**: Auth performed inside each handler using session cookies.

---

## 6. Validation & Auth

### 6.1 User Authentication
- **OAuth2 Flow**: Discord OAuth2 for user authentication
- **Session Management**: Server-side session with encrypted cookies
- **JWT Tokens**: Generated for WebSocket authentication
- **Token Expiry**: Configurable TTL (default: 1 hour)

### 6.2 WebSocket Authentication
```ts
// Browser sends auth message on connect
{
  v: 1,
  type: 'auth',
  token: string // JWT from server function
}

// Server verifies JWT and registers connection
// Timeout: 5 seconds for auth, else disconnect
```

### 6.3 Server Function Validation
- Use **Zod** schemas for input validation
- Check user session/auth in each `createServerFn` handler
- **Authorization rules:**
  - User must be authenticated (Discord OAuth)
  - User must be in the guild to access guild resources
  - Room creators have additional permissions

### 6.4 Error Mapping
- Zod validation errors → 400 Bad Request
- Missing/invalid auth → 401 Unauthorized
- Insufficient permissions → 403 Forbidden
- Discord API errors → 502 Bad Gateway (with safe message)
- Rate limiting → 429 Too Many Requests

---

## 7. Rate Limiting & Backpressure

### 7.1 WebSocket Backpressure
- **Buffer Limit**: 1MB per connection
- **Handling**: Connections exceeding buffer limit are closed with code 1008
- **Monitoring**: Log warnings when approaching limits

### 7.2 Discord Gateway Rate Limits
- **Handled by**: Discord Gateway client with automatic retry
- **Reconnection**: Exponential backoff (1s → 2s → 4s → 8s → 16s)
- **Max Attempts**: 5 reconnection attempts before giving up

### 7.3 Server Function Rate Limiting
- **Future Implementation**: Per-user token bucket for commands
- **Current**: Rely on Discord API rate limits
- **Recommended**: 5 requests/5s per user, burst of 10

---

## 8. Observability

### 8.1 Logging
- **Structured Logs**: Console logs with prefixes (`[Gateway]`, `[WS]`, `[Internal]`)
- **Event Tracking**: Log all Discord events received and broadcast
- **Connection Tracking**: Log WebSocket connections, authentications, disconnects
- **Error Logging**: Detailed error messages with context

### 8.2 Key Log Points
```
[Gateway Init] Discord Gateway initialized successfully
[Gateway] Connected (session: abc123...)
[Gateway] Heartbeat started (interval: 41250ms)
[WS] Client authenticated: <userId>
[WS] Broadcasting <event> to guild <guildId>
[WS] Sent <event> to user <userId>
```

### 8.3 Metrics (Future)
- **Counters**: `events.received`, `events.broadcast`, `ws.connections`
- **Histograms**: `event.latency`, `ws.auth_time`
- **Gauges**: `ws.active_connections`, `gateway.state`

---

## 9. Failure Modes & Recovery

### 9.1 Discord Gateway Disconnection
- **Detection**: WebSocket close event or heartbeat timeout
- **Recovery**: Exponential backoff reconnection (1s → 2s → 4s → 8s → 16s)
- **Session Resumption**: Attempt to resume session if possible
- **Max Attempts**: 5 reconnection attempts
- **State**: Connection state tracked (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, etc.)

### 9.2 Browser SSE Disconnection
- **Detection**: EventSource error event or connection close
- **Recovery**: Browser automatically reconnects (built-in SSE behavior)
- **Re-authentication**: Session cookie sent on reconnect
- **Event Loss**: Events during disconnect are lost (no replay buffer, stateless server)
- **Manual Reconnection**: Can force reconnect by closing and reopening EventSource

### 9.3 Voice Channel Dropout
- **Detection**: `voice.left` event received
- **User Action**: Modal shown with "Rejoin from Discord" option
- **Recovery**: User manually rejoins via Discord client
- **No Auto-Rejoin**: Prevents infinite loops if user is kicked

### 9.4 Authentication Failures
- **Invalid Session**: SSE stream returns 401 Unauthorized
- **Expired Session**: User must re-authenticate via OAuth
- **Missing Credentials**: SSE request rejected with 401
- **Error Response**: HTTP status codes (401, 403) with clear messages

### 9.5 Discord API Errors
- **Rate Limits**: Handled by Discord Gateway client
- **Invalid Requests**: Logged and returned as 502 to client
- **Permissions**: Checked before API calls when possible

---

## 10. Security

### 10.1 Secrets Management
- **DISCORD_BOT_TOKEN**: Server-side only, never exposed to client
- **LINK_TOKEN**: Shared secret between Gateway and TanStack Start
- **SESSION_SECRET**: Used for encrypting session cookies
- **Environment Variables**: All secrets in `.env` files, never committed
- **Rotation**: Secrets can be rotated without code changes

### 10.2 Authentication & Authorization
- **OAuth2**: Discord OAuth2 for user authentication
- **Session Cookies**: Encrypted, HTTP-only, SameSite=Lax, Secure
- **SSE Authentication**: Session cookie verified on `/api/stream` connection
- **Guild Membership**: Verified before granting access to guild resources

### 10.3 SSE Security
- **Session Required**: SSE route checks session cookie before streaming
- **HTTPS Only**: Secure cookies require HTTPS in production
- **No Credentials Exposure**: Session handled by HTTP-only cookies
- **Stateless Server**: No per-client state, prevents memory exhaustion

### 10.4 Input Validation
- **Zod Schemas**: All server function inputs validated
- **Sanitization**: User inputs sanitized before Discord API calls
- **Length Limits**: Enforced on all text inputs
- **Type Safety**: TypeScript ensures type correctness

### 10.5 CSRF Protection
- **Server Functions**: POST requests with session validation
- **SameSite Cookies**: Prevent cross-site request forgery
- **SSE Credentials**: `withCredentials: true` required for cross-origin

---

## 11. Implementation Examples

### 11.1 Discord Gateway Service (/apps/discord-gateway)
```ts
// apps/discord-gateway/src/index.ts
import { DiscordGatewayClient } from '@repo/discord-gateway'
import { GatewayWebSocketServer } from './ws-server'

const botToken = process.env.DISCORD_BOT_TOKEN!
const primaryGuildId = process.env.VITE_DISCORD_GUILD_ID!
const wsPort = parseInt(process.env.GATEWAY_WS_PORT || '8080')
const linkToken = process.env.LINK_TOKEN!

// Initialize Discord Gateway client
const gatewayClient = new DiscordGatewayClient({ 
  botToken,
  primaryGuildId 
})

// Initialize WebSocket server for TanStack Start
const wsServer = new GatewayWebSocketServer({
  port: wsPort,
  linkToken
})

// Forward Discord events to connected clients
gatewayClient.onEvent((event: string, data: unknown) => {
  wsServer.broadcast(event, data)
})

// Handle commands from TanStack Start (future)
wsServer.onCommand((command: string, payload: unknown) => {
  // Process commands (e.g., send Discord message)
})

// Start services
async function start() {
  await gatewayClient.connect()
  await wsServer.start()
  console.log(`[Gateway] Service started on port ${wsPort}`)
}

start()
```

### 11.2 TanStack Start Gateway Client
```ts
// apps/web/src/server/gateway-client.ts
import { GatewayWebSocketClient } from './gateway-ws-client'
import { discordEventBus } from './event-bus'

const gatewayUrl = process.env.GATEWAY_WS_URL || 'ws://localhost:8080'
const linkToken = process.env.LINK_TOKEN!

export const gatewayClient = new GatewayWebSocketClient({
  gatewayUrl,
  linkToken
})

// Forward Gateway events to Event Bus (for SSE streams)
gatewayClient.onEvent((event: string, payload: unknown) => {
  discordEventBus.emit({ event, payload })
})

// Initialize on server startup
export async function initializeGatewayClient() {
  await gatewayClient.connect()
  console.log('[Gateway Client] Connected to Gateway service')
}
```

### 11.3 Server Functions (Type-Safe RPC)
```ts
// apps/web/src/server/handlers/discord-rooms.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  userLimit: z.number().min(0).max(99).optional(),
})

// Server function definition
export const createRoom = createServerFn({ method: 'POST' })
  .validator(createRoomSchema)
  .handler(async ({ data }) => {
    // Get authenticated user from session
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')
    
    // Create Discord voice channel (server-only)
    const channel = await discordClient.createVoiceChannel({
      guildId: process.env.VITE_DISCORD_GUILD_ID,
      name: data.name,
      userLimit: data.userLimit,
    })
    
    return { channelId: channel.id }
  })

// Client usage (in React component)
import { createRoom } from '@/server/handlers/discord-rooms.server'

function CreateRoomForm() {
  const [name, setName] = useState('')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Call server function like a regular async function
    // No fetch(), no URL construction, no manual serialization
    try {
      const result = await createRoom({ 
        data: { name, userLimit: 4 } 
      })
      console.log('Room created:', result.channelId)
    } catch (error) {
      console.error('Failed to create room:', error)
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button type="submit">Create Room</button>
    </form>
  )
}
```

**Key Points:**
- ✅ No explicit HTTP calls in client code
- ✅ Full TypeScript type inference
- ✅ Automatic serialization/deserialization
- ✅ Zod validation on server
- ✅ Errors propagate as exceptions

### 11.4 SSE Route Implementation
```ts
// apps/web/src/routes/api/stream.ts
import { discordEventBus } from '../../server/event-bus'

export const GET = async ({ request }: { request: Request }) => {
  // Verify authentication (session cookie)
  const session = await getSession(request)
  if (!session?.userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const stream = new ReadableStream({
    start(controller) {
      // Helper to write SSE messages
      const write = (event: string, data: unknown) => {
        controller.enqueue(`event: ${event}\n`)
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
      }

      // Subscribe to event bus
      const unsubscribe = discordEventBus.on((evt) => {
        write(evt.event, evt.payload)
      })

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(`: ping\n\n`)
      }, 15000)

      // Cleanup on close
      return () => {
        clearInterval(heartbeat)
        unsubscribe()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
```

### 11.5 Browser SSE Hook
```ts
// apps/web/src/hooks/useVoiceChannelEvents.ts
export function useVoiceChannelEvents(options: {
  onVoiceLeft?: (event: VoiceLeftPayload) => void
  onVoiceJoined?: (event: VoiceJoinedPayload) => void
  enabled?: boolean
}) {
  useEffect(() => {
    if (!options.enabled) return

    const eventSource = new EventSource('/api/stream', {
      withCredentials: true
    })

    if (options.onVoiceJoined) {
      eventSource.addEventListener('voice.joined', (e) => {
        const payload: VoiceJoinedPayload = JSON.parse(e.data)
        options.onVoiceJoined?.(payload)
      })
    }

    if (options.onVoiceLeft) {
      eventSource.addEventListener('voice.left', (e) => {
        const payload: VoiceLeftPayload = JSON.parse(e.data)
        options.onVoiceLeft?.(payload)
      })
    }

    // Cleanup
    return () => {
      eventSource.close()
    }
  }, [options.enabled, options.onVoiceJoined, options.onVoiceLeft])
}
```

---

## 12. Testing Strategy

### 12.1 Unit Tests
- **Schema Validation**: Zod schemas for all inputs
- **Event Handlers**: Discord Gateway event processing
- **Reconnection Logic**: Exponential backoff implementation
- **WebSocket Manager**: Connection registration and broadcasting

### 12.2 Integration Tests
- **Gateway Connection**: Verify Discord Gateway connects and receives events
- **Event Broadcasting**: Simulate Discord events, verify browser receives them
- **Authentication Flow**: Test OAuth2 and JWT token generation
- **Voice Channel Operations**: Test room creation, joining, and voice state updates

### 12.3 Contract Tests
- **Type Safety**: TypeScript ensures type correctness
- **Event Payloads**: Validate event structure matches spec
- **WebSocket Protocol**: Verify message format compliance

### 12.4 Load Testing (Future)
- **Concurrent Connections**: 100+ simultaneous WebSocket connections
- **Event Throughput**: 100 events/s sustained
- **Latency**: p95 < 300ms for event delivery

### 12.5 Chaos Testing (Future)
- **Gateway Disconnects**: Force Discord Gateway disconnects
- **Network Failures**: Simulate network partitions
- **Browser Reconnects**: Test client reconnection logic

---

## 13. Deployment

### 13.1 Architecture
- **Two Services**: 
  - Discord Gateway Service (`/apps/discord-gateway`)
  - TanStack Start Web App (`/apps/web`)
- **Communication**: WebSocket between services (LINK_TOKEN auth)
- **Scaling**: 
  - Gateway: Single instance (or sharded for large guilds)
  - Web App: Horizontal scaling with multiple instances

### 13.2 Environment Variables

**Discord Gateway Service:**
```bash
# Required
DISCORD_BOT_TOKEN=your-bot-token
VITE_DISCORD_GUILD_ID=your-guild-id
LINK_TOKEN=shared-secret-token
GATEWAY_WS_PORT=8080

# Optional
NODE_ENV=production
```

**TanStack Start Web App:**
```bash
# Required
GATEWAY_WS_URL=ws://discord-gateway:8080
LINK_TOKEN=shared-secret-token
VITE_DISCORD_GUILD_ID=your-guild-id
SESSION_SECRET=your-session-secret

# Optional
VITE_BASE_URL=https://your-domain.com
NODE_ENV=production
```

### 13.3 Infrastructure Requirements

**Discord Gateway Service:**
- **Runtime**: Node.js 18+
- **Memory**: ~256MB
- **Network**: 
  - Outbound: Discord Gateway (wss://gateway.discord.gg)
  - Inbound: WebSocket server on port 8080
- **Replicas**: 1 (single instance, stateful)
- **Health Check**: HTTP endpoint `/health`

**TanStack Start Web App:**
- **Runtime**: Node.js 18+
- **Memory**: ~512MB per instance
- **Network**:
  - Outbound: Gateway service WebSocket
  - Inbound: HTTP/WebSocket from browsers
- **Replicas**: N (horizontal scaling)
- **Health Check**: HTTP endpoint `/api/health`

### 13.4 Deployment Considerations

**Service Communication:**
- **Internal Network**: Gateway and Web App should be on same private network
- **No Public Exposure**: Gateway service should not be publicly accessible
- **LINK_TOKEN**: Strong random secret (32+ characters), rotated periodically

**Web App:**
- **CDN/Proxy**: Configure for WebSocket upgrade support
- **Load Balancer**: Sticky sessions for browser WebSocket connections
- **Timeout**: Increase idle timeout to ≥ 60s for WebSockets

**Gateway Service:**
- **Single Instance**: Discord Gateway connection is stateful
- **Restart Strategy**: Graceful shutdown with session resumption
- **Monitoring**: Track connection state, heartbeat, event throughput

**Docker Compose Example:**
```yaml
services:
  discord-gateway:
    build: ./apps/discord-gateway
    environment:
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
      - VITE_DISCORD_GUILD_ID=${VITE_DISCORD_GUILD_ID}
      - LINK_TOKEN=${LINK_TOKEN}
      - GATEWAY_WS_PORT=8080
    ports:
      - "8080:8080"
    restart: unless-stopped
    
  web:
    build: ./apps/web
    environment:
      - GATEWAY_WS_URL=ws://discord-gateway:8080
      - LINK_TOKEN=${LINK_TOKEN}
      - SESSION_SECRET=${SESSION_SECRET}
      - VITE_DISCORD_GUILD_ID=${VITE_DISCORD_GUILD_ID}
    ports:
      - "3000:3000"
    depends_on:
      - discord-gateway
    restart: unless-stopped
```

---

## 14. LLM Guardrails & Prompts

### 14.1 Guardrails
- Only generate code that conforms to **this spec’s types and signatures**.
- Do not add third-party infra (Redis, Supabase, Pusher) unless explicitly requested.
- Preserve security constraints (no secrets client-side).
- Enforce Zod validation on all server functions.
- Map known errors to typed responses; no stack traces to clients.

### 14.2 Prompt Template — Implementation Task
```
You are implementing the feature "Realtime Chat Integration" following spec v1.0.

- Language: TypeScript
- Framework: TanStack Start
- Use the types and signatures from the spec.
- Implement {component_name} in file {path}.
- Include unit tests for {units}.
- Adhere to validation/auth rules in §6.
- Acceptance criteria: §15.
Return only the code diff with minimal commentary.
```

### 14.3 Prompt Template — Code Review
```
Review the implementation for {file_paths} against spec v1.0.
Flag any deviations from:
- Types/interfaces in §4–5
- Error handling in §6–7
- Observability in §8
- Security in §10
Provide actionable, line-level feedback.
```

---

## 15. Acceptance Criteria

### 15.1 Core Functionality
1. ✅ Discord Gateway connects and maintains persistent connection
2. ✅ Browser receives `voice.joined` events via SSE within p95 ≤ 300ms of Discord event
3. ✅ Voice channel members list updates in real-time via SSE events
4. ✅ Voice dropout detection triggers modal within 100ms
5. ✅ SSE stream authenticates via session cookie

### 15.2 Reliability
1. ✅ Gateway recovers after Discord disconnect with no manual intervention
2. ✅ Browser SSE reconnects automatically after network failure (built-in)
3. ✅ Exponential backoff prevents thundering herd on Gateway reconnect
4. ✅ Session resumption preserves event sequence when possible

### 15.3 Security
1. ✅ Unauthorized users cannot connect to SSE stream (401)
2. ✅ Invalid session cookies rejected immediately
3. ✅ Bot token never exposed to client
4. ✅ Events only streamed to authenticated users

### 15.4 Performance (Future)
1. Load test with 100 concurrent SSE connections
2. Maintain ≤ 1% error rate under load
3. p95 event delivery ≤ 300ms end-to-end

---

## 16. Open Questions & Future Enhancements

### 16.1 Scalability
- **Multi-Guild Support**: Currently single-guild, expand to multi-guild filtering?
- **Horizontal Scaling**: Shared state (Redis) for multi-instance deployments?
- **Sharding**: Discord.js sharding for large guilds (2500+ members)?

### 16.2 Features
- **Chat Integration**: Extend to support Discord text messages?
- **Presence Updates**: Track user online/offline status?
- **Event Replay**: Persist events for history/replay on reconnect?
- **Typing Indicators**: Real-time typing status?

### 16.3 Infrastructure
- **Metrics**: Prometheus/Grafana for monitoring?
- **Tracing**: OpenTelemetry for distributed tracing?
- **Rate Limiting**: Per-user rate limits for commands?

---

## 17. Third-Party Service Integration

### 17.1 Redis Integration

**Use Cases:**
- Event Bus for horizontal scaling (Pub/Sub)
- Session storage for distributed sessions
- Gateway instance registry for multi-instance coordination
- Rate limiting with sliding window counters

**Implementation:**
```ts
// apps/web/src/server/adapters/redis-event-bus.ts
import { createClient } from 'redis'
import type { IEventBus } from '../interfaces/event-bus'

export class RedisEventBus implements IEventBus<DiscordEvent> {
  private client: ReturnType<typeof createClient>
  private subscriber: ReturnType<typeof createClient>
  private handlers = new Set<(event: DiscordEvent) => void>()

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl })
    this.subscriber = this.client.duplicate()
  }

  async connect(): Promise<void> {
    await this.client.connect()
    await this.subscriber.connect()
    
    // Subscribe to Discord events channel
    await this.subscriber.subscribe('discord:events', (message) => {
      const event = JSON.parse(message)
      for (const handler of this.handlers) {
        handler(event)
      }
    })
  }

  on(handler: (event: DiscordEvent) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  async emit(event: DiscordEvent): Promise<void> {
    await this.client.publish('discord:events', JSON.stringify(event))
  }
}

// Usage in initialization
const services = createServices({
  eventBus: new RedisEventBus(process.env.REDIS_URL!)
})
```

**Benefits:**
- ✅ Multiple TanStack Start instances can share events
- ✅ Horizontal scaling without sticky sessions
- ✅ Event distribution across data centers

**Environment Variables:**
```bash
REDIS_URL=redis://localhost:6379
# or
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

### 17.2 Supabase Integration

**Use Cases:**
- Event persistence and replay
- User session management
- Real-time subscriptions (alternative to SSE)
- Analytics and event logging

**Implementation:**
```ts
// apps/web/src/server/adapters/supabase-event-store.ts
import { createClient } from '@supabase/supabase-js'
import type { IEventStore } from '../interfaces/event-store'

export class SupabaseEventStore implements IEventStore {
  private client: ReturnType<typeof createClient>

  constructor(url: string, key: string) {
    this.client = createClient(url, key)
  }

  async append(event: DiscordEvent): Promise<void> {
    await this.client
      .from('discord_events')
      .insert({
        event_type: event.event,
        payload: event.payload,
        guild_id: event.payload.guildId,
        created_at: new Date().toISOString()
      })
  }

  async getEventsSince(timestamp: number): Promise<DiscordEvent[]> {
    const { data } = await this.client
      .from('discord_events')
      .select('*')
      .gte('created_at', new Date(timestamp).toISOString())
      .order('created_at', { ascending: true })
    
    return data?.map(row => ({
      event: row.event_type,
      payload: row.payload
    })) ?? []
  }

  async getEventsForGuild(guildId: string, limit: number): Promise<DiscordEvent[]> {
    const { data } = await this.client
      .from('discord_events')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    return data?.map(row => ({
      event: row.event_type,
      payload: row.payload
    })) ?? []
  }
}

// Usage
const services = createServices({
  eventStore: new SupabaseEventStore(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  )
})
```

**Database Schema:**
```sql
-- Supabase table for event persistence
create table discord_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null,
  guild_id text not null,
  created_at timestamptz not null default now(),
  
  -- Indexes for common queries
  index idx_guild_created (guild_id, created_at desc),
  index idx_created (created_at desc)
);

-- Enable Row Level Security
alter table discord_events enable row level security;

-- Policy: Users can only read events from their guilds
create policy "Users can read guild events"
  on discord_events for select
  using (guild_id in (
    select guild_id from user_guilds where user_id = auth.uid()
  ));
```

**Benefits:**
- ✅ Event replay for reconnecting clients
- ✅ Analytics and debugging
- ✅ Audit trail
- ✅ Real-time subscriptions as SSE alternative

**Environment Variables:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### 17.3 PostgreSQL Integration

**Use Cases:**
- Event persistence with full SQL capabilities
- Complex analytics queries
- Data warehousing
- Compliance and audit requirements

**Implementation:**
```ts
// apps/web/src/server/adapters/postgres-event-store.ts
import { Pool } from 'pg'
import type { IEventStore } from '../interfaces/event-store'

export class PostgresEventStore implements IEventStore {
  private pool: Pool

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString })
  }

  async append(event: DiscordEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO discord_events (event_type, payload, guild_id, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [event.event, JSON.stringify(event.payload), event.payload.guildId]
    )
  }

  async getEventsSince(timestamp: number): Promise<DiscordEvent[]> {
    const result = await this.pool.query(
      `SELECT event_type, payload FROM discord_events
       WHERE created_at >= $1
       ORDER BY created_at ASC`,
      [new Date(timestamp)]
    )
    
    return result.rows.map(row => ({
      event: row.event_type,
      payload: row.payload
    }))
  }

  async getEventsForGuild(guildId: string, limit: number): Promise<DiscordEvent[]> {
    const result = await this.pool.query(
      `SELECT event_type, payload FROM discord_events
       WHERE guild_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [guildId, limit]
    )
    
    return result.rows.map(row => ({
      event: row.event_type,
      payload: row.payload
    }))
  }
}
```

### 17.4 Hybrid Architecture Example

**Combining Multiple Services:**
```ts
// apps/web/src/server/config/services.ts

export function createProductionServices(): ServiceConfig {
  // Redis for real-time event distribution
  const eventBus = new RedisEventBus(process.env.REDIS_URL!)
  
  // Supabase for event persistence and replay
  const eventStore = new SupabaseEventStore(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  )
  
  // Redis for distributed sessions
  const sessionStore = new RedisSessionStore(process.env.REDIS_URL!)
  
  // Redis for gateway instance coordination
  const gatewayRegistry = new RedisGatewayRegistry(process.env.REDIS_URL!)
  
  return {
    eventBus,
    eventStore,
    sessionStore,
    gatewayRegistry
  }
}

export function createDevelopmentServices(): ServiceConfig {
  // In-memory for local development
  return {
    eventBus: new InMemoryEventBus(),
    eventStore: new NoOpEventStore(),
    sessionStore: new CookieSessionStore(),
    gatewayRegistry: new SingleInstanceRegistry()
  }
}

// Select based on environment
export const services = process.env.NODE_ENV === 'production'
  ? createProductionServices()
  : createDevelopmentServices()
```

### 17.5 Migration Strategy

**Phase 1: Current (In-Memory)**
- ✅ Single instance
- ✅ No external dependencies
- ✅ Simple deployment

**Phase 2: Add Redis (Horizontal Scaling)**
- Add Redis for event bus
- Multiple TanStack Start instances
- Load balancer with any session strategy
- Gateway remains single instance

**Phase 3: Add Event Persistence (Replay)**
- Add Supabase/PostgreSQL for event store
- Enable event replay on reconnect
- Analytics and debugging capabilities
- Audit trail

**Phase 4: Full Distribution (Multi-Region)**
- Redis for all coordination
- Event persistence for compliance
- Multiple Gateway instances with sharding
- Global load balancing

### 17.6 Interface Compliance Checklist

When implementing a new adapter, ensure:

- ✅ **Implements interface**: All methods from interface implemented
- ✅ **Async-safe**: Handles concurrent operations correctly
- ✅ **Error handling**: Graceful degradation on failures
- ✅ **Connection management**: Proper connect/disconnect lifecycle
- ✅ **Resource cleanup**: No memory leaks, closes connections
- ✅ **Type safety**: Full TypeScript type coverage
- ✅ **Testing**: Unit tests with mocks, integration tests with real service
- ✅ **Documentation**: Usage examples and configuration guide
- ✅ **Monitoring**: Logs errors and performance metrics

---

## 18. Glossary

- **Discord Gateway**: Discord's WebSocket API for real-time events (wss://gateway.discord.gg)
- **Discord Gateway Client**: Our client library (`@repo/discord-gateway`) that connects to Discord Gateway
- **TanStack Start**: Full-stack React framework with server functions
- **WebSocket Manager**: Server-side registry of browser WebSocket connections
- **JWT**: JSON Web Token used for WebSocket authentication
- **Voice State**: Discord's representation of a user's voice channel connection
- **Guild**: Discord server (identified by GUILD_ID)
- **Snowflake**: Discord's unique ID format (64-bit integer as string)

---

## 18. Current Implementation Status

### 18.1 Package Structure

```
/packages/
├── discord-integration/          # Pure Discord API client
│   ├── clients/                  # REST, OAuth, RTC clients
│   ├── managers/                 # VideoQuality, VoiceState
│   ├── types/                    # Event types, schemas
│   └── utils/                    # Validators, formatters
│
└── discord-gateway/              # Gateway WebSocket client library
    ├── gateway.ts                # DiscordGatewayClient
    ├── hmac.ts                   # HMAC utilities (deprecated)
    ├── types.ts                  # Gateway-specific types
    └── index.ts                  # Public exports

/apps/discord-gateway/            # NEW: Separate Gateway service
├── src/
│   ├── index.ts                  # Main entry point
│   ├── ws-server.ts              # WebSocket server for TanStack Start
│   └── config.ts                 # Configuration
├── package.json
└── tsconfig.json

/apps/web/src/
├── server/
│   ├── gateway-client.ts         # NEW: WebSocket client to Gateway service
│   ├── interfaces/               # NEW: Abstraction layer interfaces
│   │   ├── event-bus.ts          # IEventBus interface
│   │   ├── event-store.ts        # IEventStore interface
│   │   ├── session-store.ts      # ISessionStore interface
│   │   └── gateway-registry.ts   # IGatewayRegistry interface
│   ├── adapters/                 # NEW: Third-party service adapters
│   │   ├── in-memory-event-bus.ts      # Default implementation
│   │   ├── redis-event-bus.ts          # Redis Pub/Sub (future)
│   │   ├── supabase-event-store.ts     # Supabase persistence (future)
│   │   └── postgres-event-store.ts     # PostgreSQL persistence (future)
│   ├── config/
│   │   └── services.ts           # NEW: Service factory & DI
│   └── handlers/
│       └── discord-rooms.server.ts  # Room management functions
│
└── hooks/
    ├── useVoiceChannelEvents.ts     # SSE event listener
    └── useVoiceChannelMembersFromEvents.ts  # Real-time member list
```

### 18.2 Implementation Status

**Current (Integrated):**
✅ Discord Gateway client integrated into TanStack Start
✅ Direct event broadcasting to browser WebSockets
✅ Voice channel monitoring working
✅ Room management working

**Target (Separate Service):**
🚧 **Discord Gateway Service** (`/apps/discord-gateway`)
- Service structure to be created
- WebSocket server for TanStack Start connections
- LINK_TOKEN authentication
- Event forwarding to connected clients

🚧 **TanStack Start Gateway Client**
- WebSocket client to connect to Gateway service
- Event forwarding to browser WebSockets
- Command sending (future)

### 18.3 Migration Path

1. **Create Gateway Service** (`/apps/discord-gateway`)
   - Move Discord Gateway client initialization
   - Add WebSocket server for TanStack Start
   - Implement LINK_TOKEN authentication

2. **Update TanStack Start**
   - Replace direct Gateway client with WebSocket client
   - Connect to Gateway service on startup
   - Forward events to browser WebSockets

3. **Update Deployment**
   - Deploy Gateway service separately
   - Configure internal networking
   - Update environment variables

### 18.4 Implemented Features (Current)

✅ **Discord Gateway Integration**
- Persistent WebSocket connection to Discord Gateway
- Automatic reconnection with exponential backoff
- Session resumption support
- Heartbeat handling

✅ **Voice Channel Monitoring**
- Real-time voice state updates (join/leave)
- Member list synchronization
- Voice dropout detection
- Automatic user connection to voice channels

✅ **WebSocket Communication**
- Browser ↔ Server WebSocket connections
- JWT-based authentication
- Event broadcasting to guild members
- Backpressure handling

✅ **Room Management**
- Create private voice channels
- Invite token generation
- Role-based access control
- Automatic cleanup

### 18.3 Partially Implemented

🚧 **Chat Integration**
- Event types defined
- Infrastructure ready
- Handler implementation pending

🚧 **Metrics & Monitoring**
- Console logging implemented
- Structured metrics pending
- Tracing integration pending

### 18.4 Not Yet Implemented

❌ **Multi-Guild Support**
- Currently single-guild only
- Architecture supports extension

❌ **Horizontal Scaling**
- Single-instance deployment
- Shared state (Redis) needed for multi-instance

❌ **Event Replay**
- No persistence layer
- Events lost during disconnect

❌ **Rate Limiting**
- No per-user rate limits
- Relies on Discord API limits
