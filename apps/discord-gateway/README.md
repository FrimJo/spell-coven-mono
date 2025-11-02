# Discord Gateway Service

Separate Node.js service that maintains a persistent connection to Discord Gateway and forwards events to the TanStack Start backend.

## Architecture

```
Discord Gateway API (wss://gateway.discord.gg)
        │
        ▼
  Discord Gateway Service (this service)
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
  TanStack Start Backend (/apps/web)
```

## Setup

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Configure environment variables:

   ```bash
   DISCORD_BOT_TOKEN=your-bot-token
   VITE_DISCORD_GUILD_ID=your-guild-id
   GATEWAY_WS_PORT=8080
   LINK_TOKEN=your-shared-secret-token
   ```

3. Install dependencies:
   ```bash
   bun install
   ```

## Development

```bash
bun run dev
```

## Production

Build:

```bash
bun run build
```

Run:

```bash
bun run start
```

## Environment Variables

### Required

- `DISCORD_BOT_TOKEN` - Discord bot token (server-side only)
- `VITE_DISCORD_GUILD_ID` - Primary guild ID
- `LINK_TOKEN` - Shared secret for authenticating TanStack Start connections
- `GATEWAY_WS_PORT` - WebSocket server port (default: 8080)

### Optional

- `NODE_ENV` - Environment (development/production)

## WebSocket Protocol

### Authentication

Connections must include `Authorization: Bearer ${LINK_TOKEN}` header.

### Message Format

```typescript
interface GatewayMessage {
  type: 'event' | 'command' | 'ack' | 'error'
  data: unknown
  requestId?: string
  ts: number
}
```

### Events (Gateway → TanStack Start)

```typescript
{
  type: 'event',
  data: {
    event: 'voice.joined' | 'voice.left' | 'room.created' | 'room.deleted',
    payload: { /* event-specific data */ }
  },
  ts: number
}
```

### Commands (TanStack Start → Gateway)

```typescript
{
  type: 'command',
  data: {
    command: 'sendMessage' | 'addReaction',
    payload: { /* command-specific data */ }
  },
  requestId: string,
  ts: number
}
```

## Health Check

The service logs connection status and event throughput to stdout.

## Deployment

### Docker

See `docker-compose.yml` in project root for deployment configuration.

### Requirements

- Node.js 18+
- ~256MB memory
- Network access to Discord Gateway (wss://gateway.discord.gg)
- Internal network access from TanStack Start backend

### Scaling

This service should run as a **single instance** (stateful Discord Gateway connection).
For horizontal scaling of the web app, use Redis Pub/Sub (see spec §17).
