# Spell Coven — Gateway & Realtime Implementation Guide (Hono + WebSocket + Discord)

> Spec‑driven blueprint for building a secure gateway that talks to Discord (REST + Gateway) and your browser clients (HTTP + WebSocket). Uses **Hono** for the Node service.

---

## Overview

**Goals**
- Clients authenticate to *your* service (OAuth2+PKCE → your app session JWT).
- Clients create/close **Discord voice channels** via **HTTP POST** to your service.
- Clients receive **realtime events** (e.g., `voice.joined`, `voice.left`, `room.created`) over a **WebSocket**.
- A separate, always-on **Discord Gateway worker** maintains the persistent WS to Discord and relays events to your service.

**Non-goals**
- Exposing bot token to clients (never do this).
- Hosting the Discord Gateway inside a short‑lived serverless function.

---

## Architecture

```
Browser (OAuth2+PKCE)
   ├─ HTTP POST /create-room  ─────────────┐
   └─ WS wss://svc/ws  (events)            │
                                           ▼
                     Hono Node Service (your gateway)
                     • REST to Discord (Bot token; server only)
                     • WebSocket hub for clients
                                           ▲
                                           │
                 Discord Gateway Worker ───┘
                 • Persistent WS to Discord (intents: GUILDS, GUILD_VOICE_STATES)
                 • Emits events to Hono via HTTP (signed) or Redis pub/sub
```

**Why Hono?** Fast, ESM‑friendly, easy WS via `@hono/websocket`, deployable on Node/Bun/Workers.

---

## Environment Variables

Create a `.env` (or platform secrets) with:

```
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...             # if you later add /interactions
JWT_ISSUER=https://spell-coven-mono.vercel.app
JWT_AUDIENCE=spell-coven-web
JWT_PUBLIC_JWK=...                 # or HS secret for demo only
PORT=5000
REDIS_URL=redis://...              # optional, for horizontal scale
HUB_SECRET=change-me               # for worker -> hono internal webhook
HUB_ENDPOINT=https://your-hono.example.com/internal/events
```

**Never** expose `DISCORD_BOT_TOKEN` to the browser.

---

## Message Contracts

### Client → HTTP (create room)
```jsonc
POST /create-room
{
  "guildId": "123",
  "roomId": "uuid-...",
  "parentId": "optional-category-id",
  "name": "spell-coven-<roomId>",
  "userLimit": 4
}
```

### Server → Client (WebSocket events)

```jsonc
// envelope
{
  "type": "event",
  "event": "room.created" | "room.deleted" | "voice.joined" | "voice.left",
  "payload": { /* event-specific */ }
}
```

Examples:
```jsonc
{ "type": "event", "event": "room.created", "payload": { "roomId": "r1", "channelId": "c1", "name": "spell-coven-r1" } }
{ "type": "event", "event": "voice.joined",  "payload": { "guildId": "g1", "channelId": "c1", "userId": "u1" } }
```

### Client → WS (auth)
```json
{ "type": "auth", "token": "<your-app-session-jwt>", "guildId": "123" }
```

---

## Intents & Discord Facts

- **Gateway intents** needed:
  - `GUILDS` = `1 << 0`
  - `GUILD_VOICE_STATES` = `1 << 7` (to get `VOICE_STATE_UPDATE`)
- **Create voice channel:** `POST /guilds/{guild.id}/channels` with body `{ type: 2 }`.
- **Permissions (bitfields):**
  - `VIEW_CHANNEL` = `1024`
  - `CONNECT` = `1048576`
  - `SPEAK` = `2097152`

---

## Node Service (Hono) — HTTP + WebSocket Hub

**Install**

```bash
npm i hono @hono/node-server @hono/websocket zod jose
```

**`src/server.ts`**

```ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { websocket } from '@hono/websocket';

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN as string;
const PORT = Number(process.env.PORT || 3000);

// --- Simple in-memory WS registry (swap to Redis pub/sub for scale)
type WS = import('@hono/websocket').WSContextWebSocket;
const guildSockets = new Map<string, Set<WS>>();

function broadcast(guildId: string, event: string, payload: any) {
  const set = guildSockets.get(guildId);
  if (!set) return;
  const msg = JSON.stringify({ type: 'event', event, payload });
  for (const ws of set) {
    try { ws.send(msg); } catch {}
  }
}

// --- JWT verification (stub; replace with your jose/JWK verification)
async function verifyAppJWT(bearer?: string) {
  if (!bearer?.startsWith('Bearer ')) return null;
  const token = bearer.slice(7);
  return { userId: 'demo-user', token };
}

const app = new Hono();
app.use('*', cors());

// Health
app.get('/health', (c) => c.text('ok'));

// WebSocket endpoint
app.get('/ws', websocket((ws, c) => {
  let guildId: string | null = null;

  ws.on('message', async (raw) => {
    let msg: any;
    try { msg = JSON.parse(String(raw)); } catch { return; }

    if (msg.type === 'auth') {
      const auth = await verifyAppJWT(msg.token ? `Bearer ${msg.token}` : undefined);
      if (!auth) return ws.close(4401, 'unauthorized');
      guildId = String(msg.guildId || '');
      if (!guildId) return ws.close(4400, 'guildId required');

      if (!guildSockets.has(guildId)) guildSockets.set(guildId, new Set());
      guildSockets.get(guildId)!.add(ws);
      ws.send(JSON.stringify({ type: 'ack', event: 'auth.ok' }));
      return;
    }
  });

  ws.on('close', () => {
    if (guildId && guildSockets.has(guildId)) {
      guildSockets.get(guildId)!.delete(ws);
      if (guildSockets.get(guildId)!.size === 0) guildSockets.delete(guildId);
    }
  });
}));

// Create Room (HTTP)
const CreateRoom = z.object({
  guildId: z.string(),
  roomId: z.string(),
  parentId: z.string().optional(),
  name: z.string().optional(),
  userLimit: z.number().int().min(0).max(99).optional()
});

app.post('/create-room', async (c) => {
  const auth = await verifyAppJWT(c.req.header('authorization'));
  if (!auth) return c.json({ message: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = CreateRoom.safeParse(body);
  if (!parsed.success) return c.json({ message: 'Invalid body', issues: parsed.error.issues }, 400);
  const { guildId, roomId, parentId, name, userLimit = 4 } = parsed.data;

  const payload = {
    name: name || `spell-coven-${roomId}`,
    type: 2,
    parent_id: parentId ?? null,
    user_limit: userLimit
  };

  const r = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Audit-Log-Reason': 'Create Spell Coven session'
    },
    body: JSON.stringify(payload)
  });

  const data = await r.json();
  if (!r.ok) return c.json(data, r.status);

  // TODO: persist mapping in DB
  broadcast(guildId, 'room.created', { roomId, channelId: data.id, name: data.name });
  return c.json({ channelId: data.id, name: data.name });
});

// Internal ingest from Gateway Worker
app.post('/internal/events', async (c) => {
  const sig = c.req.header('X-Hub-Signature');
  if (sig !== process.env.HUB_SECRET) return c.json({ message: 'forbidden' }, 403);
  const { event, payload } = await c.req.json();
  // Optionally: map channelId -> roomId via DB before broadcasting
  broadcast(payload.guildId, event, payload);
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: PORT });
console.log(`▶ Hono listening on :${PORT}`);
```

---

## Discord Gateway Worker (relays to Hono)

**`worker/gateway.ts`**

```ts
import WebSocket from 'ws';

const GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const HUB_ENDPOINT = process.env.HUB_ENDPOINT!;
const HUB_SECRET = process.env.HUB_SECRET!;

let seq: number | null = null;
let ws: WebSocket;
let heartbeat: NodeJS.Timer;

function postToHub(event: string, payload: any) {
  return fetch(HUB_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature': HUB_SECRET },
    body: JSON.stringify({ event, payload })
  }).catch(() => {});
}

function identify() {
  const intents = (1 << 0) | (1 << 7); // GUILDS + GUILD_VOICE_STATES
  ws.send(JSON.stringify({ op: 2, d: { token: BOT_TOKEN, intents, properties: { os: 'linux', browser: 'sc-gw', device: 'sc-gw' } } }));
}

function connect() {
  ws = new WebSocket(GATEWAY);

  ws.on('message', async (raw) => {
    const pkt = JSON.parse(String(raw));
    if (pkt.s) seq = pkt.s;

    if (pkt.op === 10) { // HELLO
      identify();
      heartbeat = setInterval(() => ws.send(JSON.stringify({ op: 1, d: seq })), pkt.d.heartbeat_interval);
    }

    if (pkt.t === 'VOICE_STATE_UPDATE') {
      const { guild_id, channel_id, user_id } = pkt.d;
      const ev = channel_id ? 'voice.joined' : 'voice.left';
      await postToHub(ev, { guildId: guild_id, channelId: channel_id, userId: user_id });
    }

    if (pkt.t === 'CHANNEL_DELETE' && pkt.d.type === 2) {
      const { id: channelId, guild_id } = pkt.d;
      await postToHub('room.deleted', { guildId: guild_id, channelId });
    }
  });

  ws.on('close', () => { clearInterval(heartbeat); setTimeout(connect, 3000); });
}

connect();
```

---

## Security & Ops

- Use **jose** to verify your app JWTs (JWK). Scope claims to allowed `guildIds`.
- Add **rate limiting** to `/create-room` (IP + user) and **idempotency keys** (`X-Idempotency-Key`).
- Put **WAF**/CORS in front of Hono.
- For horizontal scale: one Gateway worker, many Hono nodes; connect them via **Redis pub/sub** (publish `voice.joined/left` to a channel and have each Hono instance rebroadcast to local sockets).
- Log Discord REST errors with `X-Audit-Log-Reason` context.
- Implement room cleanup: delete channel after N minutes idle, or on explicit end.

---

## Quick Test

1) Start Hono service on `:3000` and worker separately.
2) Connect a WS client and auth:
```bash
wscat -c ws://localhost:3000/ws
> {"type":"auth","token":"dev-token","guildId":"<GUILD_ID>"}
```
3) Create a room:
```bash
curl -X POST http://localhost:3000/create-room \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"guildId":"<GUILD_ID>","roomId":"test-1","userLimit":4}'
```
4) Join/leave the new channel in Discord; see `voice.joined/left` events in WS client.

---

## Future Enhancements

- `/end-room` (DELETE `/channels/{channel.id}`).
- `/invite` that adds `permission_overwrites` for invited user IDs or a shared role.
- `RESUME` handling in the worker (cache `session_id` + `seq`).

---

**End of Guide.**
