# Quickstart: Cloudflare Durable Objects PeerJS Server

**Last Updated**: 2025-01-16  
**Estimated Time**: 15 minutes

## Overview

This guide walks you through setting up, testing, and deploying the Cloudflare PeerJS signaling server for local development and production.

---

## Prerequisites

- **Node.js**: v20+ (LTS recommended)
- **Bun**: Latest version (package manager)
- **Cloudflare Account**: Free tier is sufficient
- **Wrangler CLI**: Installed globally (`npm install -g wrangler`)

---

## 1. Project Setup

### Clone and Install

```bash
# Navigate to monorepo root
cd /Users/frim/Home/mtg/spell-coven-mono

# Install dependencies
bun install

# Navigate to the PeerJS server directory
cd apps/cloudflare-peerjs-server
```

### Configure Environment

Create a `.env.development` file:

```bash
# .env.development
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

Get your Cloudflare credentials:
```bash
# Login to Cloudflare
wrangler login

# Get account ID
wrangler whoami
```

---

## 2. Local Development

### Start Local Server

```bash
# Start Miniflare local development server
bun run dev

# Server starts on http://localhost:8787
```

Expected output:
```
⎔ Starting local server...
⎔ Listening on http://localhost:8787
⎔ Durable Objects ready
```

### Test WebSocket Connection

Open a new terminal and test the connection:

```bash
# Install wscat for WebSocket testing
npm install -g wscat

# Connect to local server
wscat -c "ws://localhost:8787/peerjs?key=peerjs&id=test-peer-1&token=test-room-123"

# You should receive an OPEN message:
# {"type":"OPEN","peerId":"test-peer-1"}

# Send a heartbeat:
{"type":"HEARTBEAT"}
```

### Test with PeerJS Client

Create a test HTML file (`test-client.html`):

```html
<!DOCTYPE html>
<html>
<head>
  <title>PeerJS Test Client</title>
  <script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>
</head>
<body>
  <h1>PeerJS Test Client</h1>
  <div id="status">Connecting...</div>
  <script>
    const peer = new Peer('test-peer-' + Math.random().toString(36).substr(2, 9), {
      host: 'localhost',
      port: 8787,
      path: '/peerjs',
      secure: false,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      }
    });

    peer.on('open', (id) => {
      document.getElementById('status').textContent = 'Connected! Peer ID: ' + id;
      console.log('Connected with peer ID:', id);
    });

    peer.on('error', (err) => {
      document.getElementById('status').textContent = 'Error: ' + err.message;
      console.error('PeerJS error:', err);
    });

    peer.on('connection', (conn) => {
      console.log('Incoming connection from:', conn.peer);
    });
  </script>
</body>
</html>
```

Open in browser: `open test-client.html`

---

## 3. Run Tests

### Unit Tests

```bash
# Run all unit tests
bun run test

# Run with coverage
bun run test:coverage

# Watch mode
bun run test:watch
```

### Integration Tests

```bash
# Run integration tests (requires Miniflare)
bun run test:integration

# Test specific scenario
bun run test -- signaling.test.ts
```

### Contract Tests

```bash
# Verify PeerJS protocol compatibility
bun run test:contract
```

Expected output:
```
✓ Protocol message validation (12 tests)
✓ WebSocket connection flow (8 tests)
✓ Multi-peer coordination (6 tests)
✓ Hibernation behavior (4 tests)

Test Suites: 4 passed, 4 total
Tests:       30 passed, 30 total
Time:        2.45s
```

---

## 4. Deploy to Cloudflare

### First-Time Setup

```bash
# Authenticate with Cloudflare
wrangler login

# Create Durable Object namespace
wrangler durable-objects:create GameRoomCoordinator

# Update wrangler.toml with the namespace ID (automatically done)
```

### Deploy to Production

```bash
# Deploy to Cloudflare Workers
bun run deploy

# Or manually with Wrangler
wrangler deploy
```

Expected output:
```
⛅️ wrangler 3.x.x
-------------------
✨ Built successfully
✨ Uploaded 1 file (12.34 KB)
✨ Published cloudflare-peerjs-server (1.23 sec)
   https://peerjs.spell-coven.workers.dev
```

### Verify Deployment

```bash
# Test health endpoint
curl https://peerjs.spell-coven.workers.dev/health

# Expected response:
# {"status":"ok","timestamp":1705420800000,"version":"1.0.0"}

# Test WebSocket connection
wscat -c "wss://peerjs.spell-coven.workers.dev/peerjs?key=peerjs&id=test-peer&token=test-room"
```

---

## 5. Configure Web Application

Update the Spell Coven web app to use the new signaling server:

### Update Environment Variables

Edit `apps/web/.env.development`:

```bash
# Local development
VITE_PEERJS_HOST=localhost
VITE_PEERJS_PORT=8787
VITE_PEERJS_PATH=/peerjs
VITE_PEERJS_SECURE=false

# Production
# VITE_PEERJS_HOST=peerjs.spell-coven.workers.dev
# VITE_PEERJS_PORT=443
# VITE_PEERJS_PATH=/peerjs
# VITE_PEERJS_SECURE=true
```

### Update PeerJS Client Configuration

In `apps/web/src/hooks/usePeerJS.ts`:

```typescript
const peer = new Peer(peerId, {
  host: import.meta.env.VITE_PEERJS_HOST,
  port: parseInt(import.meta.env.VITE_PEERJS_PORT),
  path: import.meta.env.VITE_PEERJS_PATH,
  secure: import.meta.env.VITE_PEERJS_SECURE === 'true',
  config: {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  }
});
```

### Test End-to-End

1. Start the PeerJS server: `cd apps/cloudflare-peerjs-server && bun run dev`
2. Start the web app: `cd apps/web && bun run dev`
3. Open two browser windows to `http://localhost:3000`
4. Create a game room in one window
5. Join the room in the second window
6. Verify video streams connect

---

## 6. Monitoring

### View Logs

```bash
# Tail production logs
wrangler tail

# Filter by log level
wrangler tail --format=pretty --level=error
```

### Check Metrics

```bash
# Get server metrics
curl https://peerjs.spell-coven.workers.dev/metrics

# Expected response:
# {
#   "activeRooms": 12,
#   "totalConnections": 45,
#   "messagesPerSecond": 23.4,
#   "uptimeSeconds": 3600,
#   "timestamp": 1705420800000
# }
```

### Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers & Pages → cloudflare-peerjs-server
3. View metrics: Requests, Errors, CPU Time, Durable Objects

---

## 7. Troubleshooting

### Connection Refused

**Problem**: `wscat` or browser can't connect to WebSocket

**Solution**:
```bash
# Check if server is running
curl http://localhost:8787/health

# Restart server
bun run dev
```

### Room Full Error

**Problem**: 5th peer can't join room

**Solution**: This is expected behavior. Maximum 4 peers per room.

### Rate Limit Exceeded

**Problem**: Client receives `rate-limit-exceeded` error

**Solution**: Reduce message frequency. Maximum 100 messages/second per peer.

### Hibernation Issues

**Problem**: Durable Object not waking up from hibernation

**Solution**:
```bash
# Check Wrangler version (must be 3.x+)
wrangler --version

# Update if needed
npm install -g wrangler@latest
```

### CORS Errors

**Problem**: Browser blocks WebSocket connection

**Solution**: Add CORS headers in `src/index.ts`:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

---

## 8. Next Steps

- **Performance Testing**: Use `k6` or `artillery` to load test with 1000+ concurrent connections
- **Monitoring Setup**: Integrate with Sentry or Datadog for error tracking
- **Custom Domain**: Configure custom domain in Cloudflare Dashboard
- **Rate Limiting**: Adjust rate limits based on production traffic patterns
- **Scaling**: Monitor Durable Objects usage and plan for horizontal scaling

---

## Common Commands Reference

```bash
# Development
bun run dev                  # Start local server
bun run test                 # Run tests
bun run test:watch           # Watch mode
bun run lint                 # Lint code
bun run typecheck            # Type check

# Deployment
bun run deploy               # Deploy to Cloudflare
wrangler tail                # View logs
wrangler durable-objects:list # List Durable Objects

# Debugging
wrangler dev --local         # Local mode (no Cloudflare API)
wrangler dev --remote        # Remote mode (uses Cloudflare API)
```

---

## Resources

- [Cloudflare Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [WebSocket Hibernation API](https://developers.cloudflare.com/durable-objects/api/websockets/)
- [PeerJS Documentation](https://peerjs.com/docs/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

---

## Support

- **Issues**: [GitHub Issues](https://github.com/spell-coven/spell-coven-mono/issues)
- **Discussions**: [GitHub Discussions](https://github.com/spell-coven/spell-coven-mono/discussions)
- **Cloudflare Community**: [Cloudflare Discord](https://discord.gg/cloudflaredev)
