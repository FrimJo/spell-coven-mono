# Cloudflare PeerJS Server

A Cloudflare Durable Objects-based WebSocket signaling server that implements the PeerJS protocol for coordinating peer-to-peer WebRTC connections between game players.

## Overview

This service replaces the existing Node.js PeerJS server with a globally distributed, edge-deployed solution that maintains connection state using Cloudflare Durable Objects and the WebSocket Hibernation API. The implementation is protocol-compatible with existing PeerJS clients, supports 2-4 concurrent peers per game room, and achieves sub-200ms signaling latency globally.

## Architecture

### Components

- **Worker Entry Point** (`src/index.ts`): HTTP request handler that routes WebSocket upgrades to Durable Objects
- **GameRoomCoordinator** (`src/durable-objects/GameRoomCoordinator.ts`): Durable Object that manages peer connections for a single game room
- **Protocol Handlers** (`src/protocol/`): Message validation and routing logic
- **Utilities** (`src/lib/`): Peer registry, rate limiter, and structured logging

### Key Features

- **Protocol Compatibility**: Implements PeerJS Server Protocol v0.3.x, compatible with PeerJS client v1.x
- **Global Distribution**: Deployed on Cloudflare Workers edge network for low latency worldwide
- **WebSocket Hibernation**: Efficient resource usage with automatic hibernation during inactivity
- **Rate Limiting**: 100 messages/second per peer to prevent abuse
- **Connection State Management**: Automatic cleanup of stale connections and heartbeat timeout detection
- **Multi-Peer Support**: Supports 2-4 concurrent peers per game room with mesh topology

## Development

### Prerequisites

- Node.js 18+ or Bun
- Cloudflare Workers account
- Wrangler CLI installed globally: `npm install -g wrangler`

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start local development server:
   ```bash
   npm run dev
   ```

   This starts a Miniflare server on `http://localhost:9000` (configured to match the old peerjs-server port)

3. Run tests:
   ```bash
   npm run test
   ```

4. Type checking:
   ```bash
   npm run typecheck
   ```

5. Linting:
   ```bash
   npm run lint
   ```

### Testing with PeerJS Client

Connect a PeerJS client to the local server:

```javascript
const peer = new Peer('peer-id', {
  host: 'localhost',
  port: 8787,
  path: '/peerjs',
  secure: false
});
```

## Deployment

### Production Deployment

1. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```

2. Deploy to production:
   ```bash
   npm run deploy
   ```

   Or deploy to a specific environment:
   ```bash
   wrangler deploy --env production
   ```

### Environment Variables

Configure environment variables in `wrangler.toml` or via Cloudflare dashboard:

- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins (optional, defaults to `*`)

### Custom Domain

To configure a custom domain, uncomment and update the `routes` section in `wrangler.toml`:

```toml
[env.production]
routes = [{ pattern = "peerjs.spell-coven.com", zone_name = "spell-coven.com" }]
```

## API Endpoints

### WebSocket Signaling

**Endpoint**: `wss://{host}/peerjs?key={apiKey}&id={peerId}&token={token}`

- `key`: API key (currently unused, reserved for future)
- `id`: Unique peer identifier (client-provided, 1-64 alphanumeric characters)
- `token`: Room token (game/room ID)

### Health Check

**Endpoint**: `GET /health`

Returns server health status:

```json
{
  "status": "ok",
  "timestamp": 1705420800000,
  "version": "1.0.0"
}
```

### Metrics

**Endpoint**: `GET /metrics`

Returns basic metrics (stub implementation):

```json
{
  "status": "ok",
  "timestamp": 1705420800000,
  "metrics": {
    "activeRooms": 0,
    "activePeers": 0,
    "messagesPerSecond": 0,
    "errorRate": 0
  }
}
```

## Protocol Messages

### Client → Server

- `HEARTBEAT`: Keep-alive message (sent every 5 seconds)
- `OFFER`: WebRTC offer message
- `ANSWER`: WebRTC answer message
- `CANDIDATE`: ICE candidate message
- `LEAVE`: Peer leaving notification

### Server → Client

- `OPEN`: Connection confirmed with assigned peer ID
- `OFFER`: Relayed offer message
- `ANSWER`: Relayed answer message
- `CANDIDATE`: Relayed candidate message
- `LEAVE`: Peer left notification
- `EXPIRE`: Peer timeout notification
- `ERROR`: Error message

## Configuration

### Rate Limiting

- Maximum: 100 messages/second per peer
- Window: 1 second (sliding window)
- Action on exceed: Error message sent, connection may be closed

### Connection Limits

- Maximum peers per room: 4
- Heartbeat timeout: 5 seconds
- Hibernation timeout: 5 minutes of inactivity

## Monitoring

### Logging

Structured JSON logs are output to Cloudflare Workers logs. View logs with:

```bash
wrangler tail
```

### Metrics

Monitor key metrics via the `/metrics` endpoint or Cloudflare dashboard:

- Active rooms
- Active peers
- Message rate
- Error rate

## Troubleshooting

### Common Issues

1. **WebSocket connection fails**: Check that all required query parameters (`key`, `id`, `token`) are provided
2. **Room full error (429)**: Maximum 4 peers per room, wait for a peer to disconnect
3. **Rate limit exceeded**: Reduce message frequency (limit: 100 msg/sec per peer)
4. **Peer timeout**: Ensure heartbeat messages are sent every 5 seconds

## License

Private - Internal use only

