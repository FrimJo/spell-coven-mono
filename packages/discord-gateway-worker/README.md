# Discord Gateway Worker

Long-lived Node.js service that maintains a persistent WebSocket connection to Discord Gateway and forwards events to the TanStack Start backend.

## Overview

The Discord Gateway Worker is a separate service from the main web application. It:

- Maintains persistent WebSocket connection to Discord Gateway
- Handles heartbeats, reconnection, and session resumption
- Filters events to a single guild (PRIMARY_GUILD_ID)
- Forwards events to TanStack Start via HMAC-signed webhooks
- Provides health check endpoint for monitoring

## Architecture

```
Discord Gateway ←→ Gateway Worker → TanStack Start → WebSocket Clients
                   (WebSocket)      (HMAC-signed HTTP)  (WebSocket)
```

## Installation

```bash
# From repo root
pnpm install

# Or from this package
cd packages/discord-gateway-worker
pnpm install
```

## Configuration

The Gateway Worker uses **`dotenv-cli`** to load environment variables, following the **Vite/Next.js standard**:

### Loading Order (lowest to highest priority)

1. `.env` - Shared defaults for all environments (committed to Git)
2. `.env.local` - Local overrides for all environments (gitignored)
3. `.env.[mode]` - Environment-specific (e.g., `.env.development`, `.env.production`)
4. `.env.[mode].local` - Environment-specific local overrides (gitignored, **highest priority**)

The `mode` is determined by `NODE_ENV` (set in package.json scripts).

### Quick Setup

**For local development**, create `.env.development.local`:

```bash
# packages/discord-gateway-worker/.env.development.local

# Discord Bot Configuration
DISCORD_BOT_TOKEN=your-bot-token-here
PRIMARY_GUILD_ID=your-guild-id-here

# Hub Configuration (TanStack Start Backend)
HUB_ENDPOINT=https://localhost:1234/api/internal/events
HUB_SECRET=your-generated-secret-here

# Optional: Logging
LOG_LEVEL=info
```

**For shared defaults**, use `.env`:

```bash
# packages/discord-gateway-worker/.env

# Defaults that can be committed to Git
HUB_ENDPOINT=https://localhost:1234/api/internal/events
LOG_LEVEL=info
```

**Note**:

- `.env.*.local` files are gitignored and should contain secrets
- `.env.local` is NOT loaded in test mode (by convention)
- Use `.env.example` as a template

### Environment Variables

| Variable            | Required | Description                                   |
| ------------------- | -------- | --------------------------------------------- |
| `DISCORD_BOT_TOKEN` | Yes      | Discord bot token from Developer Portal       |
| `PRIMARY_GUILD_ID`  | Yes      | Discord guild (server) ID to monitor          |
| `HUB_ENDPOINT`      | Yes      | TanStack Start internal events endpoint URL   |
| `HUB_SECRET`        | Yes      | Shared secret for HMAC signature verification |
| `LOG_LEVEL`         | No       | Logging level (debug, info, warn, error)      |
| `PORT`              | No       | Health check server port (default: 3001)      |

## Usage

### Development

```bash
pnpm dev
```

### Production

```bash
# Build
pnpm build

# Start
pnpm start
```

## Health Check

The worker provides a health check endpoint:

```bash
curl http://localhost:3001/health
```

**Response (healthy)**:

```json
{
  "status": "ok",
  "state": "CONNECTED",
  "timestamp": "2025-10-26T22:00:00.000Z"
}
```

**Response (unhealthy)**:

```json
{
  "status": "unhealthy",
  "state": "RECONNECTING",
  "timestamp": "2025-10-26T22:00:00.000Z"
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
3. Set build command: `pnpm build`
4. Set start command: `pnpm start`
5. Add environment variables

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]
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
