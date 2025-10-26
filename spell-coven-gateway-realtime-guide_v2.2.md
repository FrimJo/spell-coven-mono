# Spell Coven — Gateway & Realtime Implementation Guide
**Separate Services (TanStack Start Backend + WebSocket Hub + Discord Gateway Worker), Single-Guild, PKCE Auth**

> Spec-driven blueprint for a **TanStack Start backend with server routes + WebSocket hub** and a **separate Discord Gateway worker**.
> Users authenticate with **OAuth2 + PKCE** to your app; TanStack Start verifies JWTs via **JWKS**.
> You operate in **one dedicated guild** today, while keeping contracts multi-guild capable.

---

## Overview

**Goals (MVP)**
- Users sign in to **your app** using **OAuth2 + PKCE** → receive **app session JWT** issued by your IdP.
- Browsers call **your TanStack Start backend** to create/delete Discord **voice channels** in **your one guild**.
- Browsers receive **realtime events** (`room.created`, `room.deleted`, `voice.joined`, `voice.left`) over a **WebSocket** hosted by TanStack Start.
- A separate, long-lived **Discord Gateway worker** keeps the persistent WS to Discord and forwards minimal events to TanStack Start via a **signed internal webhook**.

**Non-goals (MVP)**
- BYO-guild multi-tenancy (left possible for later).
- Exposing the **bot token** to browsers (never).
- Running the Discord Gateway on serverless (it must be long-lived).

---

## Architecture

```
Browser (OAuth2+PKCE → your app JWT)
   ├─ POST /api/create-room      ───────────┐
   ├─ DELETE /api/end-room/:id             │           (public)
   └─ WS wss://app/ws  (events)            │
                                            ▼
         TanStack Start Backend + WS Hub (public)
         • Server routes verify app JWT via JWKS
         • Discord REST (bot token; server-only)
         • WebSocket fan-out to clients
         • Built-in server functions & routing
                                            ▲
                                            │               (private, signed)
                 Discord Gateway Worker ────────────────┘
                 • Persistent WS to Discord (GUILDS, GUILD_VOICE_STATES)
                 • Posts events → TanStack Start /api/internal/events (HMAC + timestamp)
```

**Why separate services?**
- Independent scaling & deploys (TanStack Start can autoscale; worker stays stable).
- Backend deploys never flap your Discord session.
- Clear secret boundary (bot token never touches the public service).
- TanStack Start provides full-stack capabilities (SSR, server functions, routing).

**Single-Guild for MVP**
- Hard-pin all behavior to `PRIMARY_GUILD_ID` while preserving multi-guild-shaped contracts.

---

## Environment Variables

Set only what each service needs.

**Shared**
```
PRIMARY_GUILD_ID=123456789012345678
HUB_SECRET=change-me                       # HMAC key for worker → TanStack Start
```

**TanStack Start backend** (in `.env` or deployment config)
```
DISCORD_BOT_TOKEN=...                     # used for Discord REST; never exposed
# JWT (PKCE) verification
JWT_ISSUER=https://your-auth.example.com
JWT_AUDIENCE=spell-coven-web
JWT_PUBLIC_JWK_URL=https://your-auth.example.com/.well-known/jwks.json
# CORS
WEB_ORIGIN=https://your-web.app
```

**Gateway worker**
```
DISCORD_BOT_TOKEN=...
PRIMARY_GUILD_ID=123456789012345678
HUB_ENDPOINT=https://your-domain.com/api/internal/events
HUB_SECRET=change-me
```

> In Discord Developer Portal, set **Bot → Public Bot = OFF** so only you can add it to your guild.

---

## Message Contracts

### Client → TanStack Start HTTP (Create / End Room)

```http
POST /create-room
Authorization: Bearer <your-app-session-jwt>
Content-Type: application/json

{ "parentId": "optional-category-id", "name": "spell-coven-<nonce>", "userLimit": 4 }
```

**Response**
```json
{ "channelId": "c1", "name": "spell-coven-xyz", "guildId": "123" }
```

```http
DELETE /end-room/:channelId
Authorization: Bearer <your-app-session-jwt>
```

### TanStack Start → Client (WebSocket events)

Envelope:
```jsonc
{
  "v": 1,
  "type": "event",
  "event": "room.created" | "room.deleted" | "voice.joined" | "voice.left",
  "payload": { /* event-specific */ },
  "ts": 1730000000000
}
```

Examples:
```jsonc
{ "v":1, "type":"event", "event":"room.created", "payload": { "channelId":"c1", "name":"spell-coven-x", "guildId":"123" }, "ts":1730 }
{ "v":1, "type":"event", "event":"voice.joined", "payload": { "guildId":"123", "channelId":"c1", "userId":"u1" }, "ts":1730 }
```

### Client → TanStack Start WS (Auth)

```json
{ "type": "auth", "token": "<your-app-session-jwt>" }
```

> TanStack Start ignores any client-provided guild and subscribes the socket to `PRIMARY_GUILD_ID` only (MVP).

### Worker → TanStack Start (Internal events)

`POST /internal/events` with HMAC+timestamp headers
```
X-Hub-Timestamp: <unix-seconds>
X-Hub-Signature: sha256=<hex-hmac-of "<ts>.<body>">
```

Body:
```json
{ "event": "voice.joined", "payload": { "guildId":"123", "channelId":"c1", "userId":"u42" } }
```

---

## Discord Intents & Notes

- **Gateway intents:**
  - `GUILDS` (`1 << 0`)
  - `GUILD_VOICE_STATES` (`1 << 7`) for `VOICE_STATE_UPDATE`
- **Create voice channel:** `POST /guilds/{guild.id}/channels` with `{ "type": 2, "name": "...", "user_limit": N }`
- **Bot permission on your guild:** `MANAGE_CHANNELS` (16). Add others only if needed later.

---

## TanStack Start Backend (Public API + WebSocket Hub, with PKCE JWT verify)

**Install dependencies**

```bash
npm i jose ws
```

**Project structure**
```
app/
├── routes/
│   ├── api/
│   │   ├── create-room.ts
│   │   ├── end-room.$channelId.ts
│   │   ├── internal/
│   │   │   └── events.ts
│   │   └── ws.ts
│   └── __root.tsx
└── server/
    ├── ws-manager.ts
    └── discord.ts
```

**`app/server/ws-manager.ts` (WebSocket registry)**

```ts
import crypto from 'node:crypto';

export type WSConnection = {
  send: (msg: string) => void;
  close: (code?: number, reason?: string) => void;
  readyState: number;
  bufferedAmount: number;
};

const OPEN = 1;
const sockets = new Set<WSConnection>();

export function addSocket(ws: WSConnection) {
  sockets.add(ws);
}

export function removeSocket(ws: WSConnection) {
  sockets.delete(ws);
}

export function safeSend(ws: WSConnection, msg: string) {
  if (ws.readyState !== OPEN) return;
  if (ws.bufferedAmount > 1_000_000) {
    ws.close(1013, 'overloaded');
    return;
  }
  try {
    ws.send(msg);
  } catch {}
}

export function broadcast(event: string, payload: any) {
  const msg = JSON.stringify({
    v: 1,
    type: 'event',
    event,
    payload,
    ts: Date.now(),
  });
  for (const ws of sockets) {
    safeSend(ws, msg);
  }
}

export function verifyHmac(headers: Record<string, string>, body: string): boolean {
  const ts = Number(headers['x-hub-timestamp'] ?? '0');
  const sig = headers['x-hub-signature'] ?? '';
  if (Math.abs(Date.now() / 1000 - ts) > 60) return false;
  const mac = crypto
    .createHmac('sha256', process.env.HUB_SECRET!)
    .update(`${ts}.${body}`)
    .digest('hex');
  return sig === `sha256=${mac}`;
}
```

**`app/server/discord.ts` (Discord API helpers)**

```ts
const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const PRIMARY_GUILD_ID = process.env.PRIMARY_GUILD_ID!;

export async function createVoiceChannel(
  name: string,
  parentId?: string,
  userLimit: number = 4
) {
  const payload = {
    name: name.slice(0, 100) || `spell-coven-${Date.now()}`,
    type: 2, // voice channel
    parent_id: parentId ?? null,
    user_limit: userLimit,
  };

  const r = await fetch(`${DISCORD_API}/guilds/${PRIMARY_GUILD_ID}/channels`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Audit-Log-Reason': 'Create Spell Coven session',
    },
    body: JSON.stringify(payload),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(`Discord API error: ${data.message}`);

  return {
    channelId: data.id,
    name: data.name,
    guildId: PRIMARY_GUILD_ID,
  };
}

export async function deleteVoiceChannel(channelId: string) {
  const r = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });

  if (!r.ok) {
    const data = await r.json();
    throw new Error(`Discord API error: ${data.message}`);
  }
}
```

**`app/routes/api/create-room.ts` (Server route)**

```ts
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import * as jose from 'jose';
import { createVoiceChannel } from '~/server/discord';
import { broadcast } from '~/server/ws-manager';

const JWKS = jose.createRemoteJWKSet(
  new URL(process.env.JWT_PUBLIC_JWK_URL!)
);

async function verifyJWT(bearer?: string) {
  if (!bearer?.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jose.jwtVerify(bearer.slice(7), JWKS, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });
    return payload as { sub: string; exp: number };
  } catch {
    return null;
  }
}

export const Route = createFileRoute('/api/create-room')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await verifyJWT(request.headers.get('authorization') ?? undefined);
        if (!auth) {
          return json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { parentId, name, userLimit = 4 } = await request.json();

        try {
          const result = await createVoiceChannel(name, parentId, userLimit);
          broadcast('room.created', result);
          return json(result);
        } catch (error) {
          return json(
            { message: error instanceof Error ? error.message : 'Failed to create room' },
            { status: 500 }
          );
        }
      },
    },
  },
});
```

**`app/routes/api/end-room.$channelId.ts` (Server route)**

```ts
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import * as jose from 'jose';
import { deleteVoiceChannel } from '~/server/discord';
import { broadcast } from '~/server/ws-manager';

const PRIMARY_GUILD_ID = process.env.PRIMARY_GUILD_ID!;
const JWKS = jose.createRemoteJWKSet(
  new URL(process.env.JWT_PUBLIC_JWK_URL!)
);

async function verifyJWT(bearer?: string) {
  if (!bearer?.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jose.jwtVerify(bearer.slice(7), JWKS, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });
    return payload as { sub: string; exp: number };
  } catch {
    return null;
  }
}

export const Route = createFileRoute('/api/end-room/$channelId')({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const auth = await verifyJWT(request.headers.get('authorization') ?? undefined);
        if (!auth) {
          return json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { channelId } = params;

        try {
          await deleteVoiceChannel(channelId);
          broadcast('room.deleted', { channelId, guildId: PRIMARY_GUILD_ID });
          return json({ ok: true });
        } catch (error) {
          return json(
            { message: error instanceof Error ? error.message : 'Failed to delete room' },
            { status: 500 }
          );
        }
      },
    },
  },
});
```

**`app/routes/api/internal/events.ts` (Internal webhook from worker)**

```ts
import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { verifyHmac, broadcast } from '~/server/ws-manager';

const PRIMARY_GUILD_ID = process.env.PRIMARY_GUILD_ID!;

export const Route = createFileRoute('/api/internal/events')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const headers = Object.fromEntries(request.headers);

        if (!verifyHmac(headers, body)) {
          return json({ message: 'forbidden' }, { status: 403 });
        }

        const { event, payload } = JSON.parse(body);

        // Only process events for our guild
        if (payload.guildId !== PRIMARY_GUILD_ID) {
          return json({ ok: true });
        }

        broadcast(event, payload);
        return json({ ok: true });
      },
    },
  },
});
```

**`app/routes/api/ws.ts` (WebSocket endpoint)**

```ts
import { createFileRoute } from '@tanstack/react-router';
import * as jose from 'jose';
import { addSocket, removeSocket, safeSend } from '~/server/ws-manager';

const PRIMARY_GUILD_ID = process.env.PRIMARY_GUILD_ID!;
const JWKS = jose.createRemoteJWKSet(
  new URL(process.env.JWT_PUBLIC_JWK_URL!)
);

async function verifyJWT(bearer?: string) {
  if (!bearer?.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jose.jwtVerify(bearer.slice(7), JWKS, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });
    return payload as { sub: string; exp: number };
  } catch {
    return null;
  }
}

export const Route = createFileRoute('/api/ws')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // TanStack Start WebSocket support via upgrade
        if (request.headers.get('upgrade') === 'websocket') {
          // This requires WebSocket upgrade handling in your server config
          // See deployment-specific setup below
          return new Response('WebSocket upgrade required', { status: 426 });
        }
        return new Response('Not a WebSocket request', { status: 400 });
      },
    },
  },
});

// WebSocket message handler (called by server upgrade logic)
export async function handleWSMessage(ws: any, raw: string) {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === 'auth') {
    const ok = await verifyJWT(msg.token ? `Bearer ${msg.token}` : undefined);
    if (!ok) {
      ws.close(4401, 'unauthorized');
      return;
    }

    addSocket(ws);
    safeSend(
      ws,
      JSON.stringify({
        v: 1,
        type: 'ack',
        event: 'auth.ok',
        guildId: PRIMARY_GUILD_ID,
      })
    );
  }
}

export function handleWSClose(ws: any) {
  removeSocket(ws);
}
```

**Server configuration** (e.g., `entry.server.ts` or deployment adapter)

For WebSocket support in TanStack Start, you need to configure your server adapter. Example for Node.js:

```ts
import { createRequestHandler } from '@tanstack/react-start/server';
import { getRouterManifest } from '@tanstack/react-start/router-manifest';

const requestHandler = createRequestHandler({
  manifest: getRouterManifest(),
});

// For WebSocket upgrade handling (Node.js + http server)
import http from 'http';

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/ws' && req.headers.upgrade === 'websocket') {
    // Handle WebSocket upgrade
    // This is adapter-specific; see TanStack Start deployment docs
    return;
  }

  await requestHandler(req, res);
});

server.listen(3000, () => {
  console.log('▶ TanStack Start listening on :3000');
});
```

---

## Discord Gateway Worker (Private, Long-Lived)

**`worker/gateway.ts` (essentials)**

```ts
import WebSocket from 'ws';
import crypto from 'node:crypto';

const GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const PRIMARY_GUILD_ID = process.env.PRIMARY_GUILD_ID!;
const HUB_ENDPOINT = process.env.HUB_ENDPOINT!;
const HUB_SECRET = process.env.HUB_SECRET!;

let ws: WebSocket;
let seq: number | null = null;
let sessionId: string | null = null;
let hb: NodeJS.Timer;
let lastAck = Date.now();

function postToHub(event: string, payload: any) {
  const ts = Math.floor(Date.now()/1000);
  const body = JSON.stringify({ event, payload });
  const mac = crypto.createHmac('sha256', HUB_SECRET).update(`${ts}.${body}`).digest('hex');
  return fetch(HUB_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Timestamp': String(ts),
      'X-Hub-Signature': `sha256=${mac}`
    },
    body
  }).catch(() => {});
}

function send(op: number, d: any) { ws.send(JSON.stringify({ op, d })); }

function identify() {
  const intents = (1 << 0) | (1 << 7);
  send(2, { token: BOT_TOKEN, intents, properties: { os:'linux', browser:'sc-gw', device:'sc-gw' } });
}

function resume() {
  if (!sessionId) return identify();
  send(6, { token: BOT_TOKEN, session_id: sessionId, seq });
}

function connect(delay=0) {
  setTimeout(() => {
    ws = new WebSocket(GATEWAY);
    ws.on('message', async (raw) => {
      const pkt = JSON.parse(String(raw));
      if (pkt.s != null) seq = pkt.s;

      switch (pkt.op) {
        case 10: { // HELLO
          const interval = pkt.d.heartbeat_interval;
          clearInterval(hb);
          hb = setInterval(() => send(1, seq), interval);
          lastAck = Date.now();
          sessionId ? resume() : identify();
          break;
        }
        case 11: lastAck = Date.now(); break; // HEARTBEAT_ACK
        case 7:  ws.close(4000, 'reconnect'); break; // RECONNECT
        case 9:  sessionId = null; setTimeout(identify, Math.random()*5000); break; // INVALID_SESSION
      }

      if (pkt.t === 'READY') sessionId = pkt.d.session_id;

      if (pkt.t === 'VOICE_STATE_UPDATE') {
        const { guild_id, channel_id, user_id } = pkt.d;
        if (guild_id !== PRIMARY_GUILD_ID) return;
        const ev = channel_id ? 'voice.joined' : 'voice.left';
        await postToHub(ev, { guildId: guild_id, channelId: channel_id, userId: user_id });
      }

      if (pkt.t === 'CHANNEL_DELETE' && pkt.d.type === 2) {
        const { id: channelId, guild_id } = pkt.d;
        if (guild_id !== PRIMARY_GUILD_ID) return;
        await postToHub('room.deleted', { guildId: guild_id, channelId });
      }
    });

    ws.on('close', () => { clearInterval(hb); connect(1000 + Math.random()*2000); });

    // watchdog for missed ACKs
    setInterval(() => { if (Date.now() - lastAck > 90000) ws.terminate(); }, 15000);
  }, delay);
}

connect();
```

---

## Client (Browser) Integration with PKCE

After PKCE completes, you have your app JWT (`id_token` or access token). Use it for both REST and WS.

```ts
// REST: create a room
await fetch('https://your-domain.com/api/create-room', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ userLimit: 4 })
});

// WS: subscribe to events
const ws = new WebSocket('wss://your-domain.com/api/ws');
ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'auth', token: jwt })));
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'event' && msg.payload.channelId === currentChannelId) {
    // handle event
  }
});
```

**Token guidance**
- Keep tokens in memory where possible; rely on your IdP's refresh token rotation (httpOnly cookie managed by the IdP domain).
- Claims you need now:
```json
{ "iss":"https://your-auth.example.com", "aud":"spell-coven-web", "sub":"<user-id>", "exp": 1730000000 }
```
- Later (multi-guild), add `guilds: ["123","456"]` and enforce per-guild access.

**TanStack Start client-side hook example** (in your React component)

```tsx
import { useEffect, useState } from 'react';

export function useSpellCovenWS(jwt: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const socket = new WebSocket('wss://your-domain.com/api/ws');

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'auth', token: jwt }));
    });

    socket.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'event') {
        setEvents((prev) => [...prev, msg]);
      }
    });

    socket.addEventListener('error', (e) => {
      console.error('WS error:', e);
    });

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [jwt]);

  return { ws, events };
}
```

---

## Security & Ops (lean but sane)

- **Bot token isolation**: only on servers.
- **Internal webhook**: HMAC + timestamp; reject >60s skew.
- **CORS**: restrict to `WEB_ORIGIN`.
- **Backpressure**: close WS clients with large `bufferedAmount`.
- **Rate limiting**: basic per-IP+`sub` on `/create-room`; honor `X-Idempotency-Key` to avoid duplicate creates on retries.
- **Health**: `/health` endpoint; container healthchecks for worker (reconnect watchdog in code).

---

## Quick Test

1. Start **TanStack Start** on `:3000` (dev or production server).
2. Start **worker** with `HUB_ENDPOINT=http://localhost:3000/api/internal/events`.
3. Connect a WS client and auth:
   ```bash
   wscat -c ws://localhost:3000/api/ws
   > {"type":"auth","token":"<jwt-from-your-auth-server>"}
   ```
4. Create a room:
   ```bash
   curl -X POST http://localhost:3000/api/create-room \
     -H "Authorization: Bearer <jwt>" \
     -H "Content-Type: application/json" \
     -d '{"userLimit":4}'
   ```
5. Join/leave the created channel in Discord; observe `voice.joined/left` events on the WS client.

---

## TanStack Start Deployment Notes

### WebSocket Support by Platform

TanStack Start's WebSocket support depends on your deployment target:

**Node.js (Recommended for MVP)**
- Use `entry.server.ts` with native Node.js `http` module
- Implement WebSocket upgrade handling manually or via `ws` package
- Example: See server configuration section above

**Cloudflare Workers / Edge Runtime**
- Limited WebSocket support; consider separate WebSocket service
- Use Durable Objects for persistent connections
- Alternative: Keep gateway worker pattern, add separate WS relay

**Vercel / Serverless**
- Serverless functions don't support long-lived WebSocket connections
- Use Vercel KV or external service for real-time messaging
- Alternative: Deploy TanStack Start on Node.js infrastructure instead

### Recommended Setup for Spell Coven

For MVP, deploy TanStack Start on **Node.js** (e.g., Railway, Render, self-hosted):
1. Full WebSocket support out-of-the-box
2. Server routes work as-is
3. Easy to scale horizontally with load balancer
4. Discord Gateway worker runs separately (can be on any platform)

### Environment Setup

Create `.env.server` (or equivalent for your deployment):
```
# Discord
DISCORD_BOT_TOKEN=your-bot-token
PRIMARY_GUILD_ID=your-guild-id

# JWT
JWT_ISSUER=https://your-auth.example.com
JWT_AUDIENCE=spell-coven-web
JWT_PUBLIC_JWK_URL=https://your-auth.example.com/.well-known/jwks.json

# Security
HUB_SECRET=your-hmac-secret-key
WEB_ORIGIN=https://your-web.app
```

### Running Locally

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Production build
npm run build
npm run start
```

---

## Future Enhancements

- Enable **BYO-guild**: flip Public Bot on, add bot install flow, add `guilds` claim, honor `guildId` in API + WS.
- Add **Redis pub/sub** to scale many TanStack Start replicas for fan-out.
- Add `/invite` with `permission_overwrites` for private rooms.
- Add idle cleanup timers and idempotency storage for `/create-room`.
- Implement **persistent WebSocket state** using TanStack Start server functions + database.
- Add **rate limiting middleware** to server routes for `/api/create-room`.

---

**End of Guide.**
