# Discord Gateway Real-Time Architecture

This document describes the implementation of the Discord Gateway real-time communication system as specified in `specs/017-discord-gateway-real/spec-discord-gateway.md`.

## Architecture Overview

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
   │  - Forwards to Event Bus                │
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

## Key Design Decisions

### 1. Separate Gateway Service
- **Why**: Isolates Discord Gateway connection from web app
- **Benefits**: 
  - Dedicated process for stateful Gateway connection
  - Can restart web app without losing Gateway connection
  - Clear separation of concerns
  - Easier to scale web app horizontally

### 2. WebSocket Communication (Gateway ↔ TanStack Start)
- **Why**: Duplex, low-latency communication
- **Benefits**:
  - Real-time event streaming
  - Future support for commands (Gateway → Discord)
  - Automatic reconnection with exponential backoff
  - LINK_TOKEN authentication for security

### 3. SSE to Browser (TanStack Start → Browser)
- **Why**: Simple, reliable, unidirectional event streaming
- **Benefits**:
  - Built-in browser support (EventSource API)
  - Automatic reconnection
  - No WebSocket complexity in browser
  - Session cookie authentication (no JWT needed)
  - Works through proxies and firewalls

### 4. Server Functions for Commands (Browser → TanStack Start)
- **Why**: Type-safe RPC abstraction
- **Benefits**:
  - Full TypeScript type inference
  - Zod validation
  - No manual HTTP requests
  - Automatic serialization/deserialization

## Component Breakdown

### Discord Gateway Service (`/apps/discord-gateway`)

**Files:**
- `src/index.ts` - Main entry point, service initialization
- `src/ws-server.ts` - WebSocket server for TanStack Start connections
- `package.json` - Dependencies and scripts
- `Dockerfile` - Production deployment

**Responsibilities:**
- Maintain persistent connection to Discord Gateway
- Handle heartbeats and reconnection
- Process Discord events (VOICE_STATE_UPDATE, etc.)
- Broadcast events to connected TanStack Start instances
- Handle commands from TanStack Start (future)

**Environment Variables:**
- `DISCORD_BOT_TOKEN` - Discord bot token (required)
- `VITE_DISCORD_GUILD_ID` - Primary guild ID (required)
- `LINK_TOKEN` - Shared secret for authentication (required)
- `GATEWAY_WS_PORT` - WebSocket server port (default: 8080)

### TanStack Start Backend (`/apps/web/src/server`)

**Files:**
- `gateway-client.ts` - WebSocket client to Gateway service
- `init/gateway-client-init.server.ts` - Gateway client initialization
- `config/services.ts` - Service factory and DI container
- `interfaces/` - Abstraction layer interfaces
- `adapters/` - Default implementations

**Responsibilities:**
- Connect to Gateway service via WebSocket
- Receive Discord events from Gateway
- Forward events to Event Bus
- Distribute events to SSE streams
- Handle server function calls from browser

**Environment Variables:**
- `GATEWAY_WS_URL` - Gateway service URL (default: ws://localhost:8080)
- `LINK_TOKEN` - Shared secret for authentication (required)
- `SESSION_SECRET` - Session encryption key (required)

### Browser (`/apps/web/src/hooks`)

**Files:**
- `useDiscordEventStream.ts` - SSE event listener hook
- `useVoiceChannelMembersFromSSE.ts` - Voice channel member tracking

**Responsibilities:**
- Connect to SSE stream (`/api/stream`)
- Receive Discord events in real-time
- Update UI based on events
- Call server functions for commands

**No Environment Variables** - Uses session cookie authentication

## Event Flow Example: Voice Channel Join

1. **User joins Discord voice channel**
   - Discord client sends VOICE_STATE_UPDATE to Discord Gateway

2. **Discord Gateway → Gateway Service**
   - Gateway service receives VOICE_STATE_UPDATE event
   - Processes event and extracts user data
   - Creates `voice.joined` event with payload

3. **Gateway Service → TanStack Start**
   - Broadcasts event via WebSocket to all connected TanStack Start instances
   - Message format: `{ type: 'event', data: { event: 'voice.joined', payload: {...} }, ts: ... }`

4. **TanStack Start → Event Bus**
   - Gateway client receives event
   - Forwards to Event Bus
   - Event Bus emits to all registered handlers

5. **Event Bus → SSE Streams**
   - SSE route handler receives event from Event Bus
   - Formats as SSE message: `event: voice.joined\ndata: {...}\n\n`
   - Sends to all connected browser clients

6. **Browser Updates UI**
   - EventSource receives `voice.joined` event
   - Hook processes event and updates state
   - React re-renders with new member in list

**Total Latency**: p95 ≤ 300ms (Discord → Browser)

## Abstraction Layer

The system uses interface-based abstractions to enable future integration of third-party services without changing business logic.

### IEventBus
- **Current**: `InMemoryEventBus` (single-instance)
- **Future**: `RedisEventBus` (horizontal scaling)

### IEventStore
- **Current**: `NoOpEventStore` (no persistence)
- **Future**: `SupabaseEventStore` or `PostgresEventStore` (event replay)

### IGatewayRegistry
- **Current**: `SingleInstanceRegistry` (single Gateway instance)
- **Future**: `RedisGatewayRegistry` (multi-instance coordination)

## Deployment

### Development

1. **Start Gateway Service:**
   ```bash
   cd apps/discord-gateway
   bun install
   cp .env.example .env
   # Configure .env
   bun run dev
   ```

2. **Start Web App:**
   ```bash
   cd apps/web
   bun install
   # Configure .env
   bun run dev
   ```

### Production (Docker Compose)

```bash
# Configure environment variables
cp .env.example .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables

Create `.env` file in project root:

```bash
# Discord Configuration
DISCORD_BOT_TOKEN=your-bot-token
VITE_DISCORD_GUILD_ID=your-guild-id

# Service Communication
LINK_TOKEN=your-shared-secret-token  # Generate with: openssl rand -hex 32

# Web App
SESSION_SECRET=your-session-secret   # Generate with: openssl rand -hex 32
VITE_BASE_URL=https://your-domain.com

# Gateway Service
GATEWAY_WS_PORT=8080
```

## Scaling

### Current: Single Instance
- Gateway Service: 1 instance (stateful)
- Web App: 1 instance
- Event Bus: In-memory
- No external dependencies

### Future: Horizontal Scaling

**Phase 1: Scale Web App**
- Gateway Service: 1 instance (stateful)
- Web App: N instances (behind load balancer)
- Event Bus: Redis Pub/Sub
- Session Store: Redis

**Phase 2: Event Persistence**
- Add Supabase/PostgreSQL for event store
- Enable event replay on reconnect
- Analytics and debugging capabilities

**Phase 3: Multi-Region**
- Multiple Gateway instances with sharding
- Redis for all coordination
- Global load balancing

## Monitoring

### Logs

**Gateway Service:**
```
[Gateway Service] Starting Discord Gateway service...
[Gateway] Connected (session: abc123...)
[Gateway WS] Server listening on port 8080
[Gateway WS] Client connected
[Gateway WS] Broadcast voice.joined: 1 success, 0 failed
```

**TanStack Start:**
```
[Gateway Client Init] Gateway client initialized successfully
[Gateway Client] Connected to Gateway service
[Gateway Client] Event received: voice.joined
[SSE] Client connected: user-123
```

**Browser:**
```
[Discord Events] Connecting to SSE stream...
[Discord Events] SSE connection established
[VoiceChannelMembers] Member joined: username
```

### Health Checks

**Gateway Service:** `http://localhost:8080/health` (TODO: implement)
**Web App:** `http://localhost:3000/api/health` (TODO: implement)

## Security

### Secrets Management
- `DISCORD_BOT_TOKEN` - Server-side only (Gateway service)
- `LINK_TOKEN` - Shared secret between services
- `SESSION_SECRET` - Web app session encryption
- All secrets in `.env` files, never committed

### Authentication
- **Gateway ↔ TanStack Start**: LINK_TOKEN via WebSocket header
- **TanStack Start ↔ Browser**: Session cookie (HTTP-only, secure)
- **No JWT needed for SSE** - Session cookie is sufficient

### Network Security
- Gateway service should not be publicly accessible
- Only TanStack Start should connect to Gateway service
- Use internal network in production
- HTTPS required for production web app

## Troubleshooting

### Gateway Service won't connect to Discord
- Check `DISCORD_BOT_TOKEN` is valid
- Check bot has required intents (GUILDS, GUILD_VOICE_STATES)
- Check network connectivity to Discord Gateway

### TanStack Start can't connect to Gateway Service
- Check `GATEWAY_WS_URL` is correct
- Check `LINK_TOKEN` matches on both services
- Check Gateway service is running and listening
- Check network connectivity between services

### Browser not receiving events
- Check SSE connection in Network tab (should be open)
- Check user is authenticated (session cookie present)
- Check Event Bus has handlers registered
- Check Gateway client is connected

### Events delayed or missing
- Check Gateway service logs for connection issues
- Check Event Bus is emitting events
- Check SSE stream is not buffered by proxy (X-Accel-Buffering: no)
- Check browser EventSource is not closed

## Testing

### Unit Tests
```bash
# Gateway service
cd apps/discord-gateway
bun test

# Web app
cd apps/web
bun test
```

### Integration Tests
```bash
# Test Gateway → TanStack Start → Browser flow
cd apps/web
bun test integration
```

### Manual Testing
1. Start Gateway service and web app
2. Create a game room
3. Join Discord voice channel
4. Verify player appears in list within 300ms
5. Leave voice channel
6. Verify player disappears from list

## Future Enhancements

### Short Term
- [ ] Health check endpoints
- [ ] Metrics (Prometheus)
- [ ] Structured logging (JSON)
- [ ] Rate limiting for server functions

### Medium Term
- [ ] Redis Event Bus for horizontal scaling
- [ ] Event persistence (Supabase/PostgreSQL)
- [ ] Chat message support
- [ ] Presence updates

### Long Term
- [ ] Multi-guild support
- [ ] Gateway sharding for large guilds
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Event replay on reconnect

## References

- **Spec**: `specs/017-discord-gateway-real/spec-discord-gateway.md`
- **Discord Gateway API**: https://discord.com/developers/docs/topics/gateway
- **Server-Sent Events**: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- **TanStack Start**: https://tanstack.com/start
