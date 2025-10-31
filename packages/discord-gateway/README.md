# Discord Gateway

Supporting package that provides Discord Gateway client and event handling utilities for TanStack Start.

## Overview

This package is **no longer a standalone service**. It's now integrated into the TanStack Start web application as a supporting library (similar to `discord-integration`).

The package provides:

- `DiscordGatewayClient` - Maintains persistent WebSocket connection to Discord Gateway
- `HubClient` - Posts events to the web app's `/api/internal/events` endpoint
- `createDiscordGatewayEventHandler` - Processes Discord events and forwards them to the hub
- Handles heartbeats, reconnection, and session resumption
- Filters events to a single guild (PRIMARY_GUILD_ID)
- Forwards events via HMAC-signed webhooks

## Architecture

```
Discord Gateway ←→ DiscordGatewayClient → HubClient → /api/internal/events → wsManager → WebSocket Clients
                   (WebSocket)            (HMAC-signed HTTP)                (broadcast)
```

## Installation

This package is installed as a workspace dependency in `@repo/web`:

```bash
# From repo root
bun install
```

## Usage

The gateway is automatically initialized when the TanStack Start server starts. See `/apps/web/src/server/discord-gateway-init.ts` for initialization logic.

### Manual Initialization

```typescript
import { DiscordGatewayClient, HubClient, createDiscordGatewayEventHandler } from '@repo/discord-gateway'

const config = {
  botToken: process.env.DISCORD_BOT_TOKEN,
  primaryGuildId: process.env.VITE_DISCORD_GUILD_ID,
  hubEndpoint: 'http://localhost:1234/api/internal/events',
  hubSecret: process.env.HUB_SECRET,
}

const gateway = new DiscordGatewayClient(config)
const hub = new HubClient(config.hubEndpoint, config.hubSecret)

const eventHandler = createDiscordGatewayEventHandler(config, hub)
gateway.onEvent(eventHandler)

await gateway.connect()
```

## Environment Variables

Environment variables are loaded from the root `.env.development` and `.env.development.local` files:

| Variable                | Required | Description                                   |
| ----------------------- | -------- | --------------------------------------------- |
| `DISCORD_BOT_TOKEN`     | Yes      | Discord bot token from Developer Portal       |
| `VITE_DISCORD_GUILD_ID` | Yes      | Discord guild (server) ID to monitor          |
| `HUB_SECRET`            | Yes      | Shared secret for HMAC signature verification |
| `VITE_BASE_URL`         | No       | Base URL for hub endpoint (default: http://localhost:1234) |

**Example `.env.development.local`**:

```bash
DISCORD_BOT_TOKEN=your-bot-token-here
VITE_DISCORD_GUILD_ID=your-guild-id-here
HUB_SECRET=your-generated-secret-here
VITE_BASE_URL=http://localhost:1234
```

## Development

The gateway is automatically started when you run the web app:

```bash
cd apps/web
bun run dev
```

Check the logs for:
```
[Gateway Init] Discord Gateway initialized successfully
```

## Events

The gateway processes and forwards these Discord events:

### `room.created`
Sent when a voice channel is created in the guild.

```typescript
{
  guildId: string
  channelId: string
  name: string
  parentId?: string
  userLimit: number
}
```

### `room.deleted`
Sent when a voice channel is deleted from the guild.

```typescript
{
  guildId: string
  channelId: string
}
```

### `voice.joined`
Sent when a user joins a voice channel.

```typescript
{
  guildId: string
  channelId: string
  userId: string
  username: string
  avatar: string | null
}
```

### `voice.left`
Sent when a user leaves a voice channel.

```typescript
{
  guildId: string
  channelId: null
  userId: string
}
```

## Connection States

- `DISCONNECTED` - Not connected to Discord
- `CONNECTING` - Establishing WebSocket connection
- `IDENTIFYING` - Authenticating with Discord
- `CONNECTED` - Fully connected and receiving events
- `RECONNECTING` - Attempting to reconnect after disconnect

## Event Forwarding

The worker forwards these Discord events to TanStack Start:

| Discord Event        | Internal Event | Description               |
| -------------------- | -------------- | ------------------------- |
| `CHANNEL_CREATE`     | `room.created` | Voice channel created     |
| `CHANNEL_DELETE`     | `room.deleted` | Voice channel deleted     |
| `VOICE_STATE_UPDATE` | `voice.joined` | User joined voice channel |
| `VOICE_STATE_UPDATE` | `voice.left`   | User left voice channel   |

## Reconnection Strategy

The worker implements exponential backoff reconnection:

1. Attempt reconnection with 1s delay
2. Double delay on each failure (1s → 2s → 4s → 8s → 16s)
3. Maximum 5 reconnection attempts
4. Session resumption when possible (preserves event sequence)

## Deployment

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

### Render

1. Create new Web Service
2. Connect GitHub repository
3. Set build command: `bun run build`
4. Set start command: `bun run start`
5. Add environment variables

### Docker

```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
CMD ["bun", "run", "start"]
```

## Monitoring

### Logs

The worker logs important events:

- `[Gateway] Connecting to Discord Gateway...` - Connection initiated
- `[Gateway] Connected (session: abc123...)` - Successfully connected
- `[Gateway] Heartbeat started (interval: 41250ms)` - Heartbeat active
- `[Worker] Received Discord event: CHANNEL_CREATE` - Event received
- `[Hub] Posted event: room.created` - Event forwarded to backend

### Metrics

Monitor these metrics for production:

- Connection state (should be `CONNECTED`)
- Heartbeat acknowledgments (should be regular)
- Event forwarding success rate
- Reconnection frequency

## Troubleshooting

### Worker won't connect

**Symptom**: `Failed to connect to Discord`

**Solutions**:

1. Verify `DISCORD_BOT_TOKEN` is correct
2. Check bot has required intents enabled (GUILDS, GUILD_VOICE_STATES)
3. Verify internet connectivity
4. Check Discord API status: https://discordstatus.com

### Events not forwarding

**Symptom**: Worker connected but events not reaching backend

**Solutions**:

1. Verify `HUB_ENDPOINT` is correct and accessible
2. Check `HUB_SECRET` matches in both services
3. Verify `PRIMARY_GUILD_ID` is correct
4. Check backend logs for HMAC verification errors

### Frequent reconnections

**Symptom**: Worker repeatedly disconnecting and reconnecting

**Solutions**:

1. Check network stability
2. Verify bot token hasn't been regenerated
3. Check Discord API rate limits
4. Review Discord Gateway close codes in logs

## Security

### Bot Token

- **Never commit** bot token to version control
- Store in environment variables only
- Rotate token if compromised
- Use different tokens for dev/staging/prod

### HMAC Secret

- Generate strong random secret (32+ characters)
- Must match between worker and backend
- Rotate periodically
- Use different secrets for dev/staging/prod

## Development

### Project Structure

```
src/
├── gateway.ts      # Discord Gateway client
├── hub-client.ts   # HTTP client for TanStack Start
├── hmac.ts         # HMAC signature generation
├── types.ts        # TypeScript types
└── index.ts        # Entry point
```

### Adding New Events

1. Add event type to `types.ts`
2. Handle event in `gateway.ts` event handler
3. Forward to hub in `index.ts`
4. Update backend to handle new event type

## License

See repository root LICENSE file.
