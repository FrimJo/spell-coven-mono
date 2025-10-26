# Spell Coven — Gateway & Realtime Implementation Guide (Option C: Separate Services, Single-Guild) 

> Spec‑driven blueprint for a **thin public Hono API + WebSocket hub** and a **separate Discord Gateway worker**.  
> Single dedicated guild (server) today; architecture remains multi‑guild capable for the future.

---

## Overview

**Goals (MVP)**
- Users authenticate to **your app** (OAuth2 + PKCE → app session JWT).
- Browsers call **your Hono API** to create/delete Discord **voice channels** in **your one guild**.
- Browsers receive **realtime events** about rooms and voice joins/leaves over **WebSocket** from Hono.
- A separate, long‑lived **Discord Gateway worker** keeps the persistent WS to Discord and forwards events to Hono via a **signed internal webhook**.

**Non‑goals (MVP)**
- BYO‑guild multi‑tenancy (kept possible, but disabled).
- Exposing the Discord **bot token** to browsers (never).
- Hosting the Discord Gateway in serverless functions (it must be long‑lived).

---

## Architecture (Option C)

```
Browser (OAuth2+PKCE → your app JWT)
   ├─ POST /create-room      ───────────┐
   ├─ DELETE /end-room/:id             │           (public)
   └─ WS wss://api/ws  (events)        │
                                        ▼
                     Hono API + WS Hub (public)
                     • Verifies app JWT
                     • REST calls to Discord (bot token; server only)
                     • WebSocket fan-out to clients
                                        ▲
                                        │               (private, signed)
                 Discord Gateway Worker ────────────────┘
                 • Persistent WS to Discord (GUILDS, GUILD_VOICE_STATES)
                 • Posts minimal events to Hono /internal/events (HMAC+timestamp)
```

**Why separate services?**
- Independent deploy & scale (API can autoscale; worker stays stable and few).
- API redeploys won’t drop your Discord session.
- Clear secret boundary and simpler long‑term ops.

**Single‑Guild for MVP**
- Hard‑pin all actions/events to one `PRIMARY_GUILD_ID`.
- Keep contracts shaped for multi‑guild; later you just remove the pin and add per‑guild JWT claims.

---

## Environment Variables

Set these on each service (only what they need):

**Shared values**
```
PRIMARY_GUILD_ID=123456789012345678
HUB_SECRET=change-me                          # HMAC signing key for worker → Hono
```

**Hono service**
```
PORT=3000
DISCORD_BOT_TOKEN=...                         # used for REST; never exposed
JWT_ISSUER=https://your-app.example.com
JWT_AUDIENCE=spell-coven-web
JWT_PUBLIC_JWK_URL=https://.../jwks.json      # or static JWK for demo
```

**Gateway worker**
```
DISCORD_BOT_TOKEN=...
PRIMARY_GUILD_ID=123456789012345678
HUB_ENDPOINT=https://api.your-domain.com/internal/events
HUB_SECRET=change-me
```

> In your Discord app, set **Public Bot = OFF** so only you can add it to your guild.

---

## Message Contracts

### Client → Hono HTTP (Create / End Room)

```http
POST /create-room
Content-Type: application/json
Authorization: Bearer <your-app-session-jwt>

{
  "parentId": "optional-category-id",
  "name": "spell-coven-<nonce>",
  "userLimit": 4
}
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
{ "v":1, "type":"event", "event":"room.created", "payload": { "channelId":"c1", "name":"spell-coven-x" }, "ts":1730 }
{ "v":1, "type":"event", "event":"voice.joined", "payload": { "guildId":"123", "channelId":"c1", "userId":"u1" }, "ts":1730 }
```

### Client → Hono WS (Auth)

```json
{ "type": "auth", "token": "<your-app-session-jwt>" }
```

> Hono ignores any client‑provided guild and subscribes the socket to `PRIMARY_GUILD_ID` only.

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

## Intents & Discord Notes

- **Gateway intents** (minimum):
  - `GUILDS` (`1 << 0`)
  - `GUILD_VOICE_STATES` (`1 << 7`), to receive `VOICE_STATE_UPDATE`
- **Create voice channel:** `POST /guilds/{guild.id}/channels` with body `{ "type": 2, "name": "...", "user_limit": N }`
- **Bot permission on your guild:** `MANAGE_CHANNELS` (16). Add more only if needed later.

---

## Hono Service (Public API + WebSocket Hub)

**Install**

```bash
npm i hono @hono/node-server @hono/websocket zod jose
```

**`src/server.ts` (key points)**

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

// --- JWT verification (real)
const JWKS = jose.createRemoteJWKSet(new URL(process.env.JWT_PUBLIC_JWK_URL!));
async function verifyAppJWT(bearer?: string) {
  if (!bearer?.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jose.jwtVerify(bearer.slice(7), JWKS, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });
    return payload as { sub: string };
  } catch { return null; }
}

// --- WS registry (in-memory; no DB)
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
  const mac = crypto.createHmac('sha256', process.env.HUB_SECRET!).update(`${ts}.${body}`).digest('hex');
  return sig === `sha256=${mac}`;
}

const app = new Hono();
app.use('*', cors({ origin: ['https://your-web.app'], allowHeaders: ['Authorization','Content-Type','X-Idempotency-Key'] }));

// Health
app.get('/health', (c) => c.text('ok'));

// WS endpoint
app.get('/ws', websocket((ws) => {
  ws.on('message', async (raw) => {
    let msg: any; try { msg = JSON.parse(String(raw)); } catch { return; }
    if (msg.type === 'auth') {
      const auth = await verifyAppJWT(msg.token ? `Bearer ${msg.token}` : undefined);
      if (!auth) return ws.close(4401, 'unauthorized');
      sockets.add(ws);
      safeSend(ws, JSON.stringify({ v:1, type:'ack', event:'auth.ok', guildId: PRIMARY_GUILD_ID }));
    }
  });
  ws.on('close', () => sockets.delete(ws));
}));

// Create Room (HTTP) — pinned to PRIMARY_GUILD_ID
app.post('/create-room', async (c) => {
  const auth = await verifyAppJWT(c.req.header('authorization'));
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
  const auth = await verifyAppJWT(c.req.header('authorization'));
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

## Discord Gateway Worker (Private, Long‑Lived)

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

## Client Flow (MVP)

1) User signs in with **PKCE** → receives **your** app session JWT.  
2) **Create room** via `POST /create-room` → Hono calls Discord and returns `{ channelId }`.  
3) Client navigates to `/#/r?c=<channelId>` and connects to `wss://api/ws`.  
4) Client listens for events and filters by `channelId`:
   - `room.created` (show success, copy link)
   - `voice.joined` / `voice.left` (presence updates)
   - `room.deleted` (close UI / show ended state)

> No database required: use `channelId` in the URL as your logical room identifier.

---

## Security & Ops (lean but sane)

- **Bot token** only lives on server(s), never in the browser.
- **Internal webhook** uses **HMAC + timestamp**; reject >60s skew.
- **CORS** on Hono: allow only your web origin.
- **Backpressure**: close WS clients with large `bufferedAmount` (prevents hub stalls).
- **Healthchecks**: `/health` on Hono; worker relies on reconnect + your container healthchecks.

---

## Quick Test

1. Start **Hono** on `:3000`.  
2. Start **worker** with `HUB_ENDPOINT=http://localhost:3000/internal/events`.  
3. Connect a WS client and auth:
   ```bash
   wscat -c ws://localhost:3000/ws
   > {"type":"auth","token":"dev-token"}
   ```
4. Create a room:
   ```bash
   curl -X POST http://localhost:3000/create-room \
     -H "Authorization: Bearer dev-token" \
     -H "Content-Type: application/json" \
     -d '{"userLimit":4}'
   ```
5. Join/leave the new channel in Discord; see `voice.joined/left` events on the WS client.

---

## Future Enhancements (flip to multi‑guild later)

- Turn **Public Bot = ON**, add bot install flows.
- Add `guilds: [...]` to app JWT and honor `guildId` in API + WS subscriptions.
- Introduce **Redis pub/sub** to scale many Hono replicas.
- Add `/invite` with `permission_overwrites` for private rooms.
- Add idle cleanup timers and idempotency keys for `/create-room`.

---

**End of Guide.**
