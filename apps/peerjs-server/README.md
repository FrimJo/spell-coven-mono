# PeerJS Server

A standalone PeerJS signaling server for WebRTC peer-to-peer connections.

## Overview

This service provides WebRTC signaling for the Spell Coven application, enabling peer-to-peer video streaming between players in game rooms.

## Getting Started

### Development

```bash
# Install dependencies
bun install

# Start the server
bun run dev
```

The server will start on `ws://localhost:9000/peerjs`

### Production

```bash
# Build
bun run build

# Start
bun run start
```

## Configuration

Environment variables (`.env.development`):

- `PEERJS_PORT` - Port to listen on (default: 9000)
- `PEERJS_PATH` - WebSocket path (default: /peerjs)
- `NODE_ENV` - Environment (development/production)

## Architecture

The PeerServer handles:
- WebSocket connections from PeerJS clients
- Signaling for peer discovery and connection establishment
- Connection state management
- Client connection/disconnection events

## Integration with Web App

The web app's `usePeerJS` hook connects to this server:

```typescript
const peer = new Peer(localPlayerId, {
  host: 'localhost',
  port: 9000,
  path: '/peerjs',
  secure: false, // true in production with HTTPS
})
```

## Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use HTTPS with SSL certificates
3. Update `secure: true` in PeerJS client config
4. Configure firewall to allow WebSocket connections on port 9000

## Monitoring

The server logs:
- Client connections: `[PeerServer] Client connected: {clientId}`
- Client disconnections: `[PeerServer] Client disconnected: {clientId}`
- Server initialization: `[PeerServer] PeerServer initialized successfully`
