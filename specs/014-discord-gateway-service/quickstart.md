# Quick Start: Discord Gateway Service

**Version**: 1.0.0
**Last Updated**: 2025-10-26

## Overview

This guide walks you through setting up and running the Discord Gateway service locally for development.

**Important**: Discord provides the communication infrastructure for Spell Coven - room management, voice chat, and **video streaming** (players stream their webcams showing board state). While card recognition runs locally in each browser, Discord is **required** for players to see each other's boards.

**Architectural Separation**: Per Constitution v1.2.0:
- **Discord handles**: Room coordination, voice chat, video streaming (webcam for board state viewing)
- **Browser handles**: Card recognition on Discord video streams (CLIP/FAISS), game state, game tools

---

## Prerequisites

### 1. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to **Bot** section
4. Click **Add Bot**
5. Copy the **Bot Token** (keep this secret!)
6. Enable **Server Members Intent** and **Message Content Intent**
7. Set **Public Bot** to OFF (single-guild MVP)

### 2. Discord Guild Setup

1. Create a test Discord server (or use existing)
2. Copy the **Guild ID** (right-click server → Copy ID, enable Developer Mode if needed)
3. Invite your bot:
   - Go to **OAuth2 → URL Generator**
   - Select scopes: `bot`
   - Select permissions: `Manage Channels`, `View Channels`, `Connect`, `Speak`, `Video` (for webcam streaming)
   - Copy the generated URL and open in browser
   - Add bot to your test server

**Note**: The `Video` permission is essential - players will stream their webcams through Discord voice channels to show their board state to other players.

### 3. OAuth2 IdP (for JWT)

For development, you can use a mock JWT or set up a simple IdP:

**Option A: Mock JWT (Development Only)**
```bash
# Generate a test JWT at https://jwt.io
# Use RS256 algorithm
# Set claims: {"iss": "https://test.example.com", "aud": "spell-coven-web", "sub": "test-user", "exp": 9999999999}
```

**Option B: Use Existing IdP**
- Auth0, Clerk, Supabase, or similar
- Configure OAuth2 + PKCE flow
- Get JWKS URL (e.g., `https://your-auth.example.com/.well-known/jwks.json`)

---

## Installation

### 1. Install Dependencies

```bash
# From repo root
pnpm install

# Install gateway worker dependencies
cd packages/discord-gateway-worker
pnpm install

# Install web app dependencies (if not already installed)
cd ../../apps/web
pnpm install
```

### 2. Environment Configuration

**Gateway Worker** (`packages/discord-gateway-worker/.env`):
```bash
DISCORD_BOT_TOKEN=your-bot-token-here
PRIMARY_GUILD_ID=your-guild-id-here
HUB_ENDPOINT=http://localhost:3000/api/internal/events
HUB_SECRET=development-secret-change-in-production
```

**TanStack Start Backend** (`apps/web/.env.local`):
```bash
DISCORD_BOT_TOKEN=your-bot-token-here
PRIMARY_GUILD_ID=your-guild-id-here
HUB_SECRET=development-secret-change-in-production

# JWT Configuration
JWT_ISSUER=https://your-auth.example.com
JWT_AUDIENCE=spell-coven-web
JWT_PUBLIC_JWK_URL=https://your-auth.example.com/.well-known/jwks.json

# CORS
VITE_BASE_URL=http://localhost:3000
```

---

## Running Locally

### Terminal 1: Gateway Worker

```bash
cd packages/discord-gateway-worker
pnpm dev
```

**Expected Output**:
```
🔌 Connecting to Discord Gateway...
✅ Connected to Discord (session: abc123...)
💓 Heartbeat started (interval: 41250ms)
🎯 Subscribed to guild: 9876543210987654321
```

### Terminal 2: TanStack Start Backend

```bash
cd apps/web
pnpm dev
```

**Expected Output**:
```
▶ TanStack Start listening on http://localhost:3000
✅ WebSocket server ready
✅ Discord REST API configured
```

### Terminal 3: Test WebSocket Client

```bash
# Install wscat if not already installed
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000/api/ws

# Authenticate (replace with your JWT)
> {"type":"auth","token":"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."}

# Expected response
< {"v":1,"type":"ack","event":"auth.ok","guildId":"9876543210987654321"}
```

---

## Testing the Flow

### 1. Create a Voice Channel

```bash
curl -X POST http://localhost:3000/api/create-room \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-room","userLimit":4}'
```

**Expected Response**:
```json
{
  "channelId": "1234567890123456789",
  "name": "test-room",
  "guildId": "9876543210987654321"
}
```

**WebSocket Client Receives**:
```json
{
  "v": 1,
  "type": "event",
  "event": "room.created",
  "payload": {
    "channelId": "1234567890123456789",
    "name": "test-room",
    "guildId": "9876543210987654321",
    "userLimit": 4
  },
  "ts": 1730000000000
}
```

### 2. Join Voice Channel (in Discord Client)

1. Open Discord desktop/mobile app
2. Navigate to your test server
3. Click on the newly created voice channel

**WebSocket Client Receives**:
```json
{
  "v": 1,
  "type": "event",
  "event": "voice.joined",
  "payload": {
    "guildId": "9876543210987654321",
    "channelId": "1234567890123456789",
    "userId": "1111111111111111111"
  },
  "ts": 1730000000001
}
```

### 3. Leave Voice Channel (in Discord Client)

Click "Disconnect" in Discord

**WebSocket Client Receives**:
```json
{
  "v": 1,
  "type": "event",
  "event": "voice.left",
  "payload": {
    "guildId": "9876543210987654321",
    "channelId": null,
    "userId": "1111111111111111111"
  },
  "ts": 1730000000002
}
```

### 4. Delete Voice Channel

```bash
curl -X DELETE http://localhost:3000/api/end-room/1234567890123456789 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response**:
```json
{
  "ok": true
}
```

**WebSocket Client Receives**:
```json
{
  "v": 1,
  "type": "event",
  "event": "room.deleted",
  "payload": {
    "channelId": "1234567890123456789",
    "guildId": "9876543210987654321"
  },
  "ts": 1730000000003
}
```

---

## Troubleshooting

### Gateway Worker Won't Connect

**Symptom**: `❌ Failed to connect to Discord`

**Solutions**:
1. Check `DISCORD_BOT_TOKEN` is correct
2. Verify bot has required intents enabled in Developer Portal
3. Check internet connection
4. Review Discord API status: https://discordstatus.com

### WebSocket Auth Fails

**Symptom**: `Connection closed: 4401 unauthorized`

**Solutions**:
1. Verify JWT is valid (check expiration)
2. Check `JWT_ISSUER` and `JWT_AUDIENCE` match JWT claims
3. Verify `JWT_PUBLIC_JWK_URL` is accessible
4. Test JWT at https://jwt.io

### HMAC Verification Fails

**Symptom**: `403 Forbidden` on `/api/internal/events`

**Solutions**:
1. Verify `HUB_SECRET` matches in both services
2. Check system clocks are synchronized (NTP)
3. Review HMAC signature generation in gateway worker
4. Check timestamp is within 60 seconds

### Events Not Received

**Symptom**: WebSocket connected but no events

**Solutions**:
1. Verify `PRIMARY_GUILD_ID` matches in both services
2. Check gateway worker logs for event filtering
3. Ensure Discord events are actually happening (join/leave voice)
4. Check WebSocket client is authenticated (`auth.ok` received)

### Rate Limited by Discord

**Symptom**: `429 Too Many Requests`

**Solutions**:
1. Implement exponential backoff (already in DiscordRestClient)
2. Reduce request frequency
3. Check `Retry-After` header and wait
4. Review Discord rate limit documentation

---

## Development Tips

### Hot Reload

- **Gateway Worker**: Restart manually (persistent connection)
- **TanStack Start**: Auto-reloads on file changes
- **WebSocket Clients**: Reconnect automatically on disconnect

### Logging

**Enable Debug Logs**:
```bash
# Gateway Worker
DEBUG=discord:* pnpm dev

# TanStack Start
LOG_LEVEL=debug pnpm dev
```

### Testing Without Discord

Use mock Discord events for faster development:

```typescript
// In TanStack Start, manually trigger events
import { broadcast } from '~/server/ws-manager';

broadcast('voice.joined', {
  guildId: PRIMARY_GUILD_ID,
  channelId: 'mock-channel-id',
  userId: 'mock-user-id',
});
```

---

## Next Steps

1. **Implement DiscordRestClient**: Complete REST API operations
2. **Implement DiscordRtcClient**: Add voice streaming support
3. **Add React Hooks**: Create `useDiscordRoom()` and `useDiscordVoice()`
4. **Deploy to Production**: Follow deployment guide
5. **Add Tests**: Unit and integration tests

---

## Useful Commands

```bash
# Type check
pnpm check-types

# Lint
pnpm lint

# Format
pnpm format

# Run tests
pnpm test

# Build for production
pnpm build

# Start production server
pnpm start
```

---

## Resources

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord API Documentation](https://discord.com/developers/docs)
- [TanStack Start Documentation](https://tanstack.com/start)
- [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [JWT.io Debugger](https://jwt.io)

---

## Support

- **Issues**: Create GitHub issue with logs and reproduction steps
- **Questions**: Ask in Discord (link TBD)
- **Documentation**: See [spec.md](./spec.md) and [data-model.md](./data-model.md)
