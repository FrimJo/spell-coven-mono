# Gateway Integration Architecture

## Overview

The TanStack Start backend connects to the Discord Gateway Service via WebSocket to receive real-time Discord events and forward them to browser clients via Server-Sent Events (SSE).

## Architecture Flow

```
Discord API
    ↓ (Discord Gateway Protocol)
Discord Gateway Service (apps/discord-gateway)
    ↓ (WebSocket with LINK_TOKEN auth)
TanStack Start Backend (apps/web)
    ↓ (SSE with session cookie auth)
Browser Client
```

## Components

### 1. Discord Gateway Service (`apps/discord-gateway`)
- **Purpose**: Standalone Node.js service that maintains persistent connection to Discord Gateway
- **Port**: 8080 (configurable via `GATEWAY_WS_PORT`)
- **Authentication**: Requires `LINK_TOKEN` for incoming WebSocket connections
- **Events**: Forwards raw Discord events (e.g., `VOICE_STATE_UPDATE`) to connected clients

### 2. TanStack Start Backend (`apps/web`)
- **Gateway Client**: WebSocket client that connects to Gateway Service
- **SSE Manager**: Broadcasts events to browser clients via Server-Sent Events
- **Location**: `/apps/web/src/server/init/gateway-client-init.server.ts`

### 3. Browser Client
- **EventSource**: Connects to `/api/stream` endpoint
- **Authentication**: Session cookie (HTTP-only, secure)
- **Events**: Receives real-time Discord events (e.g., `voice.joined`, `voice.left`)

## Message Flow

### Discord Event → Browser

1. Discord sends `VOICE_STATE_UPDATE` to Gateway Service
2. Gateway Service broadcasts event via WebSocket:
   ```json
   {
     "type": "event",
     "data": {
       "event": "VOICE_STATE_UPDATE",
       "payload": { /* raw Discord data */ }
     },
     "ts": 1234567890
   }
   ```
3. Backend Gateway Client receives event and forwards to SSE Manager
4. SSE Manager broadcasts to all connected browser clients:
   ```
   data: {"v":1,"type":"event","event":"VOICE_STATE_UPDATE","payload":{...},"ts":1234567890}
   ```
5. Browser receives event via EventSource

### Browser Command → Discord (Future)

1. Browser calls server function via `createServerFn`
2. Server function calls `sendGatewayCommand(command, payload)`
3. Backend sends command to Gateway Service via WebSocket
4. Gateway Service processes command and interacts with Discord API

## Environment Variables

### Gateway Service (`apps/discord-gateway/.env.development`)
```bash
GATEWAY_WS_PORT=8080
LINK_TOKEN=your-shared-secret-token-here
DISCORD_BOT_TOKEN=your-bot-token
VITE_DISCORD_GUILD_ID=your-guild-id
```

### TanStack Start Backend (`apps/web/.env.development`)
```bash
GATEWAY_WS_URL=ws://localhost:8080
LINK_TOKEN=your-shared-secret-token-here
VITE_DISCORD_GUILD_ID=your-guild-id
```

**Important**: `LINK_TOKEN` must match in both services for authentication.

## Starting the Services

### Development

1. **Start Gateway Service** (Terminal 1):
   ```bash
   cd apps/discord-gateway
   bun run dev
   ```

2. **Start TanStack Start Backend** (Terminal 2):
   ```bash
   cd apps/web
   bun run dev
   ```

The backend will automatically connect to the Gateway Service on startup.

## Connection Management

### Automatic Reconnection
- Backend implements exponential backoff reconnection
- Max 10 reconnection attempts
- Delays: 1s, 2s, 4s, 8s, 16s, 30s (capped)

### Connection Status
```typescript
import { getGatewayStatus } from '@/server/init/gateway-client-init.server'

const status = getGatewayStatus()
console.log(status.connected) // true/false
console.log(status.reconnectAttempts) // number
```

### Manual Disconnect
```typescript
import { disconnectGateway } from '@/server/init/gateway-client-init.server'

disconnectGateway()
```

## Sending Commands (Future)

```typescript
import { sendGatewayCommand } from '@/server/init/gateway-client-init.server'

// Example: Send a Discord message
sendGatewayCommand('send_message', {
  channelId: '123456789',
  content: 'Hello from TanStack Start!'
})
```

## Event Types

The Gateway Service forwards raw Discord Gateway events. Common event types:

- `VOICE_STATE_UPDATE` - User joins/leaves voice channel
- `MESSAGE_CREATE` - New message in channel
- `GUILD_MEMBER_ADD` - User joins guild
- `GUILD_MEMBER_REMOVE` - User leaves guild

See [discord-api-types](https://www.npmjs.com/package/discord-api-types) for full event schemas.

## Debugging

### Backend Logs
```
[Gateway Client] Connecting to ws://localhost:8080...
[Gateway Client] Connected to Gateway Service
[Gateway Client] Received Discord event: VOICE_STATE_UPDATE
[SSE] Broadcasting VOICE_STATE_UPDATE to guild 123456789
```

### Gateway Service Logs
```
[Gateway WS] Client connected
[Gateway Service] Discord event: VOICE_STATE_UPDATE
[Gateway WS] Broadcast VOICE_STATE_UPDATE: 1 success, 0 failed
```

### Browser Console
```javascript
// EventSource connection
[VoiceChannelEvents] Connecting to SSE: /api/stream
[VoiceChannelEvents] SSE connected
[VoiceChannelEvents] Received voice.joined event: username
```

## Security

- **LINK_TOKEN**: Shared secret between Gateway Service and Backend (never exposed to browser)
- **Session Cookie**: Browser authentication (HTTP-only, secure)
- **No Direct Browser Access**: Browser cannot connect directly to Gateway Service
- **Server-Side Only**: Gateway client code never bundled for browser (`.server.ts` extension)

## Troubleshooting

### Backend can't connect to Gateway Service
- Check `GATEWAY_WS_URL` is correct (default: `ws://localhost:8080`)
- Verify Gateway Service is running
- Ensure `LINK_TOKEN` matches in both services

### Events not reaching browser
- Check SSE connection in browser DevTools (Network tab)
- Verify `VITE_DISCORD_GUILD_ID` matches in both services
- Check backend logs for event forwarding

### Gateway Service not receiving Discord events
- Verify `DISCORD_BOT_TOKEN` is valid
- Check bot has necessary permissions in Discord
- Ensure bot is in the guild specified by `VITE_DISCORD_GUILD_ID`
