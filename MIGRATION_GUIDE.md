# Migration Guide: Integrated → Separate Gateway Service

This guide helps migrate from the integrated Discord Gateway (running in TanStack Start) to the new separate Gateway service architecture.

## Overview of Changes

### Before (Integrated)
```
Discord Gateway API
        ↓
TanStack Start (Discord Gateway Client)
        ↓
WebSocket Manager
        ↓
Browser (WebSocket + JWT auth)
```

### After (Separate Service)
```
Discord Gateway API
        ↓
Discord Gateway Service (separate process)
        ↓ (WebSocket + LINK_TOKEN)
TanStack Start (Gateway WebSocket Client)
        ↓
Event Bus
        ↓ (SSE + Session Cookie)
Browser (EventSource)
```

## Breaking Changes

### 1. Browser WebSocket → SSE

**Old:**
```typescript
import { useVoiceChannelEvents } from './hooks/useVoiceChannelEvents'

// Required JWT token
const { jwtToken } = useAuth()

useVoiceChannelEvents({
  jwtToken,
  onVoiceJoined: (event) => { /* ... */ },
  onVoiceLeft: (event) => { /* ... */ }
})
```

**New:**
```typescript
import { useDiscordEventStream } from './hooks/useDiscordEventStream'

// No JWT needed - uses session cookie
useDiscordEventStream({
  onVoiceJoined: (event) => { /* ... */ },
  onVoiceLeft: (event) => { /* ... */ },
  enabled: true
})
```

### 2. Voice Channel Members Hook

**Old:**
```typescript
import { useVoiceChannelMembersFromEvents } from './hooks/useVoiceChannelMembersFromEvents'

const { members } = useVoiceChannelMembersFromEvents({
  gameId,
  userId,
  jwtToken,  // Required
  enabled: !!jwtToken
})
```

**New:**
```typescript
import { useVoiceChannelMembersFromSSE } from './hooks/useVoiceChannelMembersFromSSE'

const { members } = useVoiceChannelMembersFromSSE({
  gameId,
  userId,
  enabled: true  // No JWT needed
})
```

### 3. Environment Variables

**Old (TanStack Start):**
```bash
DISCORD_BOT_TOKEN=...
VITE_DISCORD_GUILD_ID=...
HUB_SECRET=...  # HMAC signing
```

**New (Split):**

**Gateway Service (`.env` in `/apps/discord-gateway`):**
```bash
DISCORD_BOT_TOKEN=...
VITE_DISCORD_GUILD_ID=...
LINK_TOKEN=...  # Shared secret
GATEWAY_WS_PORT=8080
```

**TanStack Start (`.env` in `/apps/web`):**
```bash
GATEWAY_WS_URL=ws://localhost:8080
LINK_TOKEN=...  # Same as Gateway service
SESSION_SECRET=...
VITE_DISCORD_GUILD_ID=...
```

## Migration Steps

### Step 1: Install Dependencies

```bash
# Gateway service
cd apps/discord-gateway
bun install

# Web app (update dependencies if needed)
cd apps/web
bun install
```

### Step 2: Configure Environment Variables

1. **Generate secrets:**
   ```bash
   # Generate LINK_TOKEN
   openssl rand -hex 32
   
   # Generate SESSION_SECRET
   openssl rand -hex 32
   ```

2. **Gateway service `.env`:**
   ```bash
   cd apps/discord-gateway
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Web app `.env`:**
   ```bash
   cd apps/web
   # Add new variables:
   GATEWAY_WS_URL=ws://localhost:8080
   LINK_TOKEN=<same-as-gateway-service>
   # Remove old variables:
   # HUB_SECRET (no longer needed)
   ```

### Step 3: Update Browser Code

1. **Replace WebSocket hooks with SSE hooks:**

   Find all usages of:
   - `useVoiceChannelEvents` → `useDiscordEventStream`
   - `useVoiceChannelMembersFromEvents` → `useVoiceChannelMembersFromSSE`

2. **Remove JWT token dependencies:**
   - Remove `jwtToken` prop from hook calls
   - Remove JWT token generation/fetching code if only used for events

3. **Update event handlers:**
   - Event payloads remain the same
   - No changes needed to event handler logic

### Step 4: Start Services

**Development:**

```bash
# Terminal 1: Gateway service
cd apps/discord-gateway
bun run dev

# Terminal 2: Web app
cd apps/web
bun run dev
```

**Production (Docker):**

```bash
# Configure .env in project root
docker-compose up -d
```

### Step 5: Verify Migration

1. **Check Gateway service logs:**
   ```
   [Gateway Service] Starting Discord Gateway service...
   [Gateway] Connected (session: ...)
   [Gateway WS] Server listening on port 8080
   ```

2. **Check web app logs:**
   ```
   [Gateway Client Init] Gateway client initialized successfully
   [Gateway Client] Connected to Gateway service
   ```

3. **Test in browser:**
   - Open browser console
   - Navigate to game room
   - Check for: `[Discord Events] SSE connection established`
   - Join voice channel
   - Verify player appears in list

## Rollback Plan

If you need to rollback to the integrated architecture:

1. **Stop Gateway service:**
   ```bash
   # Development
   Ctrl+C in Gateway service terminal
   
   # Production
   docker-compose stop discord-gateway
   ```

2. **Revert web app initialization:**
   ```typescript
   // apps/web/src/server/init/start-ws.server.ts
   // Change back to:
   const { initializeDiscordGateway } = await import('./discord-gateway-init.server.js')
   await initializeDiscordGateway()
   ```

3. **Revert browser hooks:**
   - Use old `useVoiceChannelEvents` hook
   - Pass JWT token again

4. **Revert environment variables:**
   - Add back `HUB_SECRET`
   - Remove `GATEWAY_WS_URL` and `LINK_TOKEN`

## Troubleshooting

### Gateway service won't start

**Error:** `Missing required env var: DISCORD_BOT_TOKEN`
- **Solution:** Copy `.env.example` to `.env` and configure

**Error:** `Missing required env var: LINK_TOKEN`
- **Solution:** Generate with `openssl rand -hex 32` and add to `.env`

**Error:** `Address already in use`
- **Solution:** Change `GATEWAY_WS_PORT` or stop other service on port 8080

### Web app can't connect to Gateway

**Error:** `[Gateway Client] Error: connect ECONNREFUSED`
- **Solution:** Check Gateway service is running
- **Solution:** Check `GATEWAY_WS_URL` is correct (default: `ws://localhost:8080`)

**Error:** `[Gateway WS] Connection rejected: Invalid LINK_TOKEN`
- **Solution:** Ensure `LINK_TOKEN` matches in both services

### Browser not receiving events

**Error:** SSE connection fails with 401 Unauthorized
- **Solution:** Check user is authenticated (session cookie present)
- **Solution:** Check session is valid (not expired)

**Error:** SSE connection opens but no events received
- **Solution:** Check Gateway client is connected to Gateway service
- **Solution:** Check Event Bus has handlers registered
- **Solution:** Check browser console for errors

### Events delayed

**Symptom:** Events take >1 second to appear
- **Check:** Gateway service logs for connection issues
- **Check:** Network latency between services
- **Check:** Proxy/load balancer not buffering SSE stream

## Performance Comparison

### Before (Integrated)
- **Latency**: ~100-200ms (Discord → Browser)
- **Memory**: ~512MB (single process)
- **Scaling**: Vertical only (single instance)

### After (Separate Service)
- **Latency**: ~100-300ms (Discord → Browser, +1 hop)
- **Memory**: ~256MB (Gateway) + ~512MB (Web) = ~768MB total
- **Scaling**: Horizontal (web app can scale independently)

## Benefits of New Architecture

✅ **Isolation**: Gateway connection isolated from web app restarts
✅ **Scaling**: Web app can scale horizontally
✅ **Simplicity**: Browser uses standard SSE (no WebSocket complexity)
✅ **Security**: No JWT needed for events (session cookie sufficient)
✅ **Reliability**: Gateway reconnects independently of web app
✅ **Future-proof**: Ready for Redis/Supabase integration

## Next Steps

After successful migration:

1. **Monitor logs** for any errors or warnings
2. **Test all features** that depend on real-time events
3. **Update documentation** with new architecture
4. **Remove old code** (WebSocket hooks, JWT token generation)
5. **Consider Redis** for horizontal scaling (if needed)

## Support

If you encounter issues during migration:

1. Check logs in both Gateway service and web app
2. Verify environment variables are correct
3. Test with `curl` or Postman to isolate issues
4. Review `DISCORD_GATEWAY_ARCHITECTURE.md` for details
5. Check spec: `specs/017-discord-gateway-real/spec-discord-gateway.md`
