# Spell Coven — Gateway & Realtime Implementation Guide
**Option C: Separate Services (Hono API/WS Hub + Discord Gateway Worker), Single-Guild, PKCE Auth**

> Spec-driven blueprint for a **thin public Hono API + WebSocket hub** and a **separate Discord Gateway worker**.  
> Users authenticate with **OAuth2 + PKCE** to your app; Hono verifies JWTs via **JWKS**.  
> You operate in **one dedicated guild** today, while keeping contracts multi-guild capable.

---

## Overview

**Goals (MVP)**
- Users sign in to **your app** using **OAuth2 + PKCE** → receive **app session JWT** issued by your IdP.
- Browsers call **your Hono API** to create/delete Discord **voice channels** in **your one guild**.
- Browsers receive **realtime events** (`room.created`, `room.deleted`, `voice.joined`, `voice.left`) over a **WebSocket** hosted by Hono.
- A separate, long-lived **Discord Gateway worker** keeps the persistent WS to Discord and forwards minimal events to Hono via a **signed internal webhook**.

**Non-goals (MVP)**
- BYO-guild multi-tenancy (left possible for later).
- Exposing the **bot token** to browsers (never).
- Running the Discord Gateway on serverless (it must be long-lived).

---

## Architecture (Option C)

```
Browser (OAuth2+PKCE → your app JWT)
   ├─ POST /create-room      ───────────┐
   ├─ DELETE /end-room/:id             │           (public)
   └─ WS wss://api/ws  (events)        │
                                        ▼
                     Hono API + WS Hub (public)
                     • Verifies app JWT via JWKS
                     • Discord REST (bot token; server-only)
                     • WebSocket fan-out to clients
                                        ▲
                                        │               (private, signed)
                 Discord Gateway Worker ────────────────┘
                 • Persistent WS to Discord (GUILDS, GUILD_VOICE_STATES)
                 • Posts events → Hono /internal/events (HMAC + timestamp)
```

**Why separate services?**
- Independent scaling & deploys (API can autoscale; worker stays stable).
- API deploys never flap your Discord session.
- Clear secret boundary (bot token never touches the public service).

**Single-Guild for MVP**
- Hard-pin all behavior to `PRIMARY_GUILD_ID` while preserving multi-guild-shaped contracts.

---

## Environment Variables

Set only what each service needs.

**Shared**
```
PRIMARY_GUILD_ID=123456789012345678
HUB_SECRET=change-me                       # HMAC key for worker → Hono
```

**Hono service**
```
PORT=3000
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
HUB_ENDPOINT=https://api.your-domain.com/internal/events
HUB_SECRET=change-me
```

> In Discord Developer Portal, set **Bot → Public Bot = OFF** so only you can add it to your guild.

---

## Message Contracts

### Client → Hono HTTP (Create / End Room)

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

### Hono → Client (WebSocket events)

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

### Client → Hono WS (Auth)

```json
{ "type": "auth", "token": "<your-app-session-jwt>" }
```

> Hono ignores any client-provided guild and subscribes the socket to `PRIMARY_GUILD_ID` only (MVP).

### Worker → Hono (Internal events)

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

## Hono Service (Public API + WebSocket Hub, with PKCE JWT verify)

**Install**

```bash
npm i hono @hono/node-server @hono/websocket zod jose
```

**`src/server.ts` (essentials)**

```ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { websocket } from '@hono/websocket';
import * as jose from 'jose';
import crypto from 'node:crypto';

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const PRIMARY_GUILD_ID = process.env.PRIMARY_GUILD_ID!;
const PORT = Number(process.env.PORT || 3000);
const WEB_ORIGIN = process.env.WEB_ORIGIN!;

// --- JWT verification via JWKS (PKCE-issued JWT)
const JWKS = jose.createRemoteJWKSet(new URL(process.env.JWT_PUBLIC_JWK_URL!));
async function verifyJWT(bearer?: string) {
  if (!bearer?.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jose.jwtVerify(bearer.slice(7), JWKS, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });
    return payload as { sub: string; exp: number };
  } catch { return null; }
}

// --- WS registry (in-memory; no DB for MVP)
type WS = import('@hono/websocket').WSContextWebSocket;
const sockets = new Set<WS>();
function safeSend(ws: WS, msg: string) {
  if (ws.readyState !== ws.OPEN) return;
  if (ws.bufferedAmount > 1_000_000) return ws.close(1013, 'overloaded');
  try { ws.send(msg); } catch {}
}
function broadcast(event: string, payload: any) {
  const msg = JSON.stringify({ v:1, type:'event', event, payload, ts: Date.now() });
  for (const ws of sockets) safeSend(ws, msg);
}

// --- HMAC verification for internal webhook
function verifyHmac(headers: Headers, body: string) {
  const ts = Number(headers.get('X-Hub-Timestamp') ?? '0');
  const sig = headers.get('X-Hub-Signature') ?? '';
  if (Math.abs(Date.now()/1000 - ts) > 60) return false;
  const mac = crypto.createHmac('sha256', process.env.HUB_SECRET!).
              update(`${ts}.${body}`).digest('hex');
  return sig === `sha256=${mac}`;
}

const app = new Hono();
app.use('*', cors({
  origin: [WEB_ORIGIN],
  allowHeaders: ['Authorization','Content-Type','X-Idempotency-Key'],
  allowMethods: ['GET','POST','DELETE']
}));

// Health
app.get('/health', (c) => c.text('ok'));

// WebSocket endpoint
app.get('/ws', websocket((ws) => {
  ws.on('message', async (raw) => {
    let msg: any; try { msg = JSON.parse(String(raw)); } catch { return; }
    if (msg.type === 'auth') {
      const ok = await verifyJWT(msg.token ? `Bearer ${msg.token}` : undefined);
      if (!ok) return ws.close(4401, 'unauthorized');
      sockets.add(ws);
      safeSend(ws, JSON.stringify({ v:1, type:'ack', event:'auth.ok', guildId: PRIMARY_GUILD_ID }));
    }
  });
  ws.on('close', () => sockets.delete(ws));
}));

// Create Room (HTTP) — pinned to PRIMARY_GUILD_ID
app.post('/create-room', async (c) => {
  const auth = await verifyJWT(c.req.header('authorization'));
  if (!auth) return c.json({ message: 'Unauthorized' }, 401);

  const { parentId, name, userLimit = 4 } = await c.req.json();
  const payload = {
    name: (name?.slice(0,100)) || `spell-coven-${Date.now()}`,
    type: 2,
    parent_id: parentId ?? null,
    user_limit: userLimit
  };

  const r = await fetch(`${DISCORD_API}/guilds/${PRIMARY_GUILD_ID}/channels`, {
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

  broadcast('room.created', { channelId: data.id, name: data.name, guildId: PRIMARY_GUILD_ID });
  return c.json({ channelId: data.id, name: data.name, guildId: PRIMARY_GUILD_ID });
});

// End Room
app.delete('/end-room/:channelId', async (c) => {
  const auth = await verifyJWT(c.req.header('authorization'));
  if (!auth) return c.json({ message: 'Unauthorized' }, 401);

  const channelId = c.req.param('channelId');
  const r = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
  });
  if (!r.ok) return c.json(await r.json(), r.status);

  broadcast('room.deleted', { channelId, guildId: PRIMARY_GUILD_ID });
  return c.json({ ok: true });
});

// Internal ingest from Worker
app.post('/internal/events', async (c) => {
  const body = await c.req.text();
  if (!verifyHmac(c.req.header(), body)) return c.json({ message: 'forbidden' }, 403);
  const { event, payload } = JSON.parse(body);
  if (payload.guildId !== PRIMARY_GUILD_ID) return c.json({ ok: true }); // ignore others
  broadcast(event, payload);
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: PORT });
console.log(`▶ Hono listening on :${PORT}`);
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
await fetch('https://api.your-domain.com/create-room', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ userLimit: 4 })
});

// WS: subscribe to events
const ws = new WebSocket('wss://api.your-domain.com/ws');
ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'auth', token: jwt })));
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'event' && msg.payload.channelId === currentChannelId) {
    // handle event
  }
});
```

**Token guidance**
- Keep tokens in memory where possible; rely on your IdP’s refresh token rotation (httpOnly cookie managed by the IdP domain).
- Claims you need now:
```json
{ "iss":"https://your-auth.example.com", "aud":"spell-coven-web", "sub":"<user-id>", "exp": 1730000000 }
```
- Later (multi-guild), add `guilds: ["123","456"]` and enforce per-guild access.

---

## Security & Ops (lean but sane)

- **Bot token isolation**: only on servers.
- **Internal webhook**: HMAC + timestamp; reject >60s skew.
- **CORS**: restrict to `WEB_ORIGIN`.
- **Backpressure**: close WS clients with large `bufferedAmount`.
- **Rate limiting**: basic per-IP+`sub` on `/create-room`; honor `X-Idempotency-Key` to avoid duplicate creates on retries.
- **Health**: `/health` on Hono; container healthchecks for worker (reconnect watchdog in code).

---

## Quick Test

1. Start **Hono** on `:3000`.  
2. Start **worker** with `HUB_ENDPOINT=http://localhost:3000/internal/events`.  
3. Connect a WS client and auth:
   ```bash
   wscat -c ws://localhost:3000/ws
   > {"type":"auth","token":"<jwt-from-your-auth-server>"}
   ```
4. Create a room:
   ```bash
   curl -X POST http://localhost:3000/create-room \
     -H "Authorization: Bearer <jwt>" \
     -H "Content-Type: application/json" \
     -d '{"userLimit":4}'
   ```
5. Join/leave the created channel in Discord; observe `voice.joined/left` events on the WS client.

---

## Future Enhancements

- Enable **BYO-guild**: flip Public Bot on, add bot install flow, add `guilds` claim, honor `guildId` in API + WS.
- Add **Redis pub/sub** to scale many Hono replicas for fan-out.
- Add `/invite` with `permission_overwrites` for private rooms.
- Add idle cleanup timers and idempotency storage for `/create-room`.

---

**End of Guide.**
