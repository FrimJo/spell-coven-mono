# Quick Start: Discord Gateway Real-Time Event System

**Feature**: Discord Gateway Real-Time Event System  
**Date**: 2025-01-02  
**Status**: Implementation Guide

## Architecture Overview

### Actual Implementation (WebSocket-Based)

```
Discord Gateway API (wss://gateway.discord.gg)
        │
        ▼
  [Discord Gateway Client - Integrated in TanStack Start]
   ┌─────────────────────────────────────────┐
   │ @repo/discord-gateway package           │
   │  - DiscordGatewayClient                 │
   │  - Maintains WebSocket to Discord       │
   │  - Handles heartbeats & reconnection    │
   │  - Processes VOICE_STATE_UPDATE         │
   │  - Owns DISCORD_BOT_TOKEN (server-only) │
   └──────────────┬──────────────────────────┘
                  │
                  ▼
   ┌─────────────────────────────────────────┐
   │ Event Bus (in-memory)                   │
   │  - Receives events from Gateway         │
   │  - Broadcasts to WebSocket clients      │
   │  - No persistence (stateless)           │
   └──────────────┬──────────────────────────┘
                  │  (WebSocket)
                  ▼
       Browser (React Frontend)
   - WebSocket connection to /api/ws
   - JWT authentication
   - Receives voice.joined/voice.left events
   - Server function calls via createServerFn()
```

### Important: WebSocket vs SSE

**The technical spec document (`spec-discord-gateway.md`) mentions two architectures:**
1. ✅ **WebSocket** (ACTUAL IMPLEMENTATION)
2. ❌ **SSE (Server-Sent Events)** (Alternative, NOT implemented)

**Why WebSocket was chosen:**
- Bidirectional communication (events + commands)
- Lower latency
- Single connection for both directions
- Already implemented and working

## Communication Patterns

### 1. Server → Browser: Real-Time Events (WebSocket)

**NOT using SSE** - Using WebSocket instead

**Endpoint**: `ws://localhost:3000/api/ws`

**Client Code**:
```typescript
// apps/web/src/hooks/useVoiceChannelEvents.ts
import { useEffect } from 'react'

export function useVoiceChannelEvents(options: {
  jwtToken: string
  onVoiceJoined?: (event: VoiceJoinedPayload) => void
  onVoiceLeft?: (event: VoiceLeftPayload) => void
}) {
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000/api/ws')
    
    ws.onopen = () => {
      // Authenticate with JWT
      ws.send(JSON.stringify({
        v: 1,
        type: 'auth',
        token: options.jwtToken,
        ts: Date.now()
      }))
    }
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      
      if (message.type === 'event') {
        if (message.event === 'voice.joined') {
          options.onVoiceJoined?.(message.payload)
        }
        if (message.event === 'voice.left') {
          options.onVoiceLeft?.(message.payload)
        }
      }
    }
    
    return () => ws.close()
  }, [options.jwtToken])
}
```

**Message Format**:
```typescript
// Server → Client
{
  v: 1,
  type: 'event',
  event: 'voice.joined',
  payload: {
    guildId: '123456789012345678',
    channelId: '123456789012345678',
    userId: '123456789012345678',
    username: 'PlayerName',
    avatar: 'a_1234567890abcdef'
  },
  ts: 1704240000000
}
```

### 2. Browser → Server: Commands (createServerFn)

**Using TanStack Start server functions** (NOT REST API)

**Server Code**:
```typescript
// apps/web/src/server/handlers/discord-rooms.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const createRoom = createServerFn({ method: 'POST' })
  .validator(z.object({
    name: z.string().min(1).max(100),
  }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')
    
    // Create Discord voice channel
    const channel = await discordClient.createVoiceChannel({
      guildId: process.env.VITE_DISCORD_GUILD_ID,
      name: data.name,
      userLimit: 4, // Max 4 players per spec
    })
    
    return { channelId: channel.id }
  })
```

**Client Code**:
```typescript
// apps/web/src/components/CreateRoomButton.tsx
import { createRoom } from '@/server/handlers/discord-rooms.server'

function CreateRoomButton() {
  const handleCreate = async () => {
    try {
      // Looks like a regular function call, executes on server
      const result = await createRoom({ 
        data: { name: 'My Game Room' } 
      })
      console.log('Room created:', result.channelId)
    } catch (error) {
      console.error('Failed to create room:', error)
    }
  }
  
  return <button onClick={handleCreate}>Create Room</button>
}
```

**Key Points**:
- ✅ No explicit HTTP calls (abstracted by TanStack Start)
- ✅ Full TypeScript type inference
- ✅ Automatic serialization/deserialization
- ✅ Zod validation on server
- ✅ Errors propagate as exceptions

## Key Files

### Packages

```
packages/discord-integration/     # Pure Discord API client
├── src/
│   ├── clients/                 # REST, OAuth, RTC clients
│   ├── types/
│   │   └── events.ts            # VoiceJoinedPayload, VoiceLeftPayload
│   └── utils/

packages/discord-gateway/         # Gateway WebSocket client
├── src/
│   ├── gateway.ts               # DiscordGatewayClient
│   ├── hmac.ts                  # HMAC utilities
│   └── types.ts                 # Gateway-specific types
```

### Web App

```
apps/web/
├── src/
│   ├── hooks/
│   │   ├── useVoiceChannelEvents.ts              # WebSocket listener
│   │   └── useVoiceChannelMembersFromEvents.ts   # Member list sync
│   │
│   ├── routes/
│   │   ├── api/
│   │   │   └── ws.ts                             # WebSocket route
│   │   └── game.$gameId.tsx                      # Game room route
│   │
│   └── server/
│       ├── handlers/
│       │   └── discord-rooms.server.ts           # Server functions
│       │
│       ├── managers/
│       │   └── ws-manager.ts                     # WebSocket manager
│       │
│       └── init/
│           └── discord-gateway-init.server.ts    # Gateway initialization
```

## Environment Variables

```bash
# Required
DISCORD_BOT_TOKEN=your-bot-token                  # Server-side only
VITE_DISCORD_GUILD_ID=your-guild-id              # Can be in client
SESSION_SECRET=your-session-secret                # Server-side only

# Optional
VITE_BASE_URL=http://localhost:3000              # Base URL
NODE_ENV=development                              # Environment
```

## Development Workflow

### 1. Start Development Server

```bash
cd /Users/frim/Home/mtg/spell-coven-mono
bun run dev
```

### 2. Check Gateway Initialization

Look for log message:
```
[Gateway Init] Discord Gateway initialized successfully
```

### 3. Create a Game Room

1. Navigate to home page
2. Click "Create Game"
3. Room created with private voice channel (max 4 players)
4. Invite token generated (24-hour expiry)
5. Redirected to `/game/{channelId}`

### 4. Join Voice Channel

1. Join Discord voice channel manually
2. WebSocket receives `voice.joined` event
3. Player appears in game room UI instantly (<300ms)

### 5. Monitor Events

Open browser console to see:
```
[WS] Connected to WebSocket
[WS] Authenticated successfully
[Event] voice.joined: { userId: '...', username: '...' }
```

## Testing

### Unit Tests (Optional per Constitution)

```bash
bun test
```

### Integration Tests (Optional per Constitution)

```bash
bun test:integration
```

### Manual Testing

1. **Real-time updates**: Join/leave voice channel, verify instant UI updates
2. **Reconnection**: Disconnect network, verify automatic reconnection
3. **Room cleanup**: Leave room idle for 1 hour, verify automatic cleanup
4. **Token expiry**: Wait 24 hours, verify invite token expires
5. **Player limit**: Try to add 5th player, verify rejection

## Common Issues

### WebSocket Connection Fails

**Symptom**: `[WS] Connection failed`

**Solution**:
1. Check `DISCORD_BOT_TOKEN` is set
2. Check bot has correct permissions
3. Check WebSocket route is registered

### Events Not Received

**Symptom**: Voice channel changes don't appear in UI

**Solution**:
1. Check WebSocket is authenticated (look for `auth.ok` message)
2. Check user is in correct guild
3. Check Discord Gateway is connected

### Session Expired

**Symptom**: `401 Unauthorized` errors

**Solution**:
1. Silent refresh will attempt automatically
2. If refresh fails, user redirected to Discord OAuth
3. After re-auth, user returned to game room

## Performance Targets

- **Event Latency**: <300ms p95 (Discord → Browser)
- **Connection Time**: <2s (user joins voice channel)
- **Uptime**: 99.9% monthly
- **Throughput**: 100 events/s, 100 concurrent connections

## Next Steps

1. Run `/speckit.tasks` to generate implementation tasks
2. Implement room cleanup background job (1-hour inactivity)
3. Implement session refresh logic
4. Add rate limit queue with exponential backoff
5. Enforce 4-player limit on room creation
6. Update token expiry to 24 hours

## References

- Feature Spec: `spec.md`
- Implementation Plan: `plan.md`
- Research: `research.md`
- Data Model: `data-model.md`
- WebSocket Protocol: `contracts/websocket-protocol.md`
- Technical Spec (Reference): `spec-discord-gateway.md` (Note: Mentions SSE, but WebSocket is used)
