# Voice Channel Dropout Detection - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Discord                                      │
│                                                                  │
│  User removed from voice channel                                │
│  Discord sends VOICE_STATE_UPDATE event                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           Discord Gateway Worker (Node.js)                       │
│                                                                  │
│  Maintains persistent WebSocket to Discord Gateway              │
│  Receives VOICE_STATE_UPDATE event                              │
│  Detects: channel_id was set, now null (user left)              │
│  Posts voice.left event to hub                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         TanStack Start Backend (Node.js)                         │
│                                                                  │
│  POST /api/internal/events                                      │
│  ├─ Verify HMAC signature                                       │
│  ├─ Parse voice.left event                                      │
│  └─ Broadcast to WebSocket clients                              │
│                                                                  │
│  WebSocket Manager                                              │
│  ├─ Maintains registry of connected clients                     │
│  ├─ Filters by guildId                                          │
│  └─ Sends message to all clients in guild                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Browser (React Frontend)                            │
│                                                                  │
│  WebSocket Connection (/api/ws)                                 │
│  ├─ Authenticates with JWT token                                │
│  └─ Listens for events                                          │
│                                                                  │
│  useVoiceChannelEvents Hook                                     │
│  ├─ Establishes WebSocket connection                            │
│  ├─ Filters events for current userId                           │
│  ├─ Calls onVoiceLeft callback                                  │
│  └─ Auto-reconnects on disconnect                               │
│                                                                  │
│  GameRoom Component                                             │
│  ├─ Receives onVoiceLeft event                                  │
│  ├─ Sets voiceDropoutOpen = true                                │
│  └─ Shows VoiceDropoutModal                                     │
│                                                                  │
│  VoiceDropoutModal Component                                    │
│  ├─ Displays warning message                                    │
│  ├─ "Rejoin" button → handleRejoin()                            │
│  └─ "Leave Game" button → onLeaveGame()                         │
└─────────────────────────────────────────────────────────────────┘
```

## Component Interaction Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    GameRoom Component                             │
│                                                                   │
│  State:                                                           │
│  ├─ voiceDropoutOpen: boolean                                    │
│  ├─ isRejoinLoading: boolean                                     │
│  └─ auth: { userId, accessToken }                               │
│                                                                   │
│  Hooks:                                                           │
│  ├─ useVoiceChannelEvents({                                      │
│  │   userId: auth.userId                                        │
│  │   jwtToken: auth.accessToken                                 │
│  │   onVoiceLeft: (event) => {                                  │
│  │     setVoiceDropoutOpen(true)                                │
│  │     toast.warning(...)                                       │
│  │   }                                                           │
│  │ })                                                            │
│  └─ useServerFn(validateVoiceChannelAccess)                     │
│                                                                   │
│  Handlers:                                                        │
│  └─ handleRejoin() → validateVoiceChannelFn()                   │
│                                                                   │
│  JSX:                                                             │
│  └─ <VoiceDropoutModal                                           │
│       open={voiceDropoutOpen}                                    │
│       onRejoin={handleRejoin}                                    │
│       onLeaveGame={onLeaveGame}                                  │
│       isRejoinLoading={isRejoinLoading}                          │
│     />                                                           │
└──────────────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
    ┌─────────────────┐          ┌──────────────────┐
    │ useVoiceChannel │          │ VoiceDropout     │
    │ Events Hook     │          │ Modal Component  │
    │                 │          │                  │
    │ ├─ Connect WS   │          │ ├─ Warning icon  │
    │ ├─ Auth JWT     │          │ ├─ Message text  │
    │ ├─ Listen       │          │ ├─ Rejoin btn    │
    │ ├─ Filter user  │          │ └─ Leave btn     │
    │ └─ Reconnect    │          └──────────────────┘
    └─────────────────┘
```

## WebSocket Message Flow

```
1. Browser connects to /api/ws
   ┌─────────────────────────────────────────┐
   │ Browser                    Backend       │
   │                                          │
   │ WebSocket.open()                        │
   │ ─────────────────────────────────────→  │
   │                                          │
   │ Send auth message                       │
   │ {                                        │
   │   v: 1,                                 │
   │   type: 'auth',                         │
   │   token: 'jwt-token'                    │
   │ }                                        │
   │ ─────────────────────────────────────→  │
   │                                          │
   │                    Verify JWT            │
   │                    Register connection   │
   │                                          │
   │                    Send auth.ok ack     │
   │ ←───────────────────────────────────── │
   │ {                                        │
   │   v: 1,                                 │
   │   type: 'ack',                          │
   │   event: 'auth.ok'                      │
   │ }                                        │
   └─────────────────────────────────────────┘

2. User leaves voice channel
   ┌─────────────────────────────────────────┐
   │ Discord Gateway Worker    Backend        │
   │                                          │
   │ VOICE_STATE_UPDATE event                │
   │ ─────────────────────────────────────→  │
   │                                          │
   │                    POST /api/internal/   │
   │                    events                │
   │                    Broadcast to guild    │
   │                                          │
   │                    Send voice.left event │
   │ ←───────────────────────────────────── │
   │ {                                        │
   │   v: 1,                                 │
   │   type: 'event',                        │
   │   event: 'voice.left',                  │
   │   payload: {                            │
   │     guildId: '...',                     │
   │     channelId: null,                    │
   │     userId: '...'                       │
   │   }                                      │
   │ }                                        │
   └─────────────────────────────────────────┘

3. Browser receives event
   ┌─────────────────────────────────────────┐
   │ Browser                                  │
   │                                          │
   │ onmessage event                         │
   │ ├─ Parse JSON                           │
   │ ├─ Check event type                     │
   │ ├─ Filter by userId                     │
   │ └─ Call onVoiceLeft callback            │
   │    └─ setVoiceDropoutOpen(true)         │
   │       └─ Show modal                     │
   └─────────────────────────────────────────┘
```

## State Machine: Voice Channel Status

```
                    ┌─────────────────┐
                    │  In Game Room   │
                    │  In Voice Chat  │
                    └────────┬────────┘
                             │
                    User removed from
                    voice channel
                             │
                             ▼
                    ┌─────────────────┐
                    │  Voice Dropout  │
                    │  Modal Shown    │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
         User clicks            User clicks
         "Rejoin"               "Leave Game"
                │                         │
                ▼                         ▼
        ┌──────────────┐         ┌──────────────┐
        │ Attempting   │         │  Navigating  │
        │ Rejoin...    │         │  to Landing  │
        └──────┬───────┘         └──────────────┘
               │
        ┌──────┴──────┐
        │             │
    Success       Failure
        │             │
        ▼             ▼
    ┌─────────┐   ┌──────────────┐
    │ Back in │   │ Modal stays  │
    │ Voice   │   │ open, show   │
    │ Chat    │   │ error toast  │
    └─────────┘   └──────────────┘
                        │
                   User retries
                        │
                        └─→ (loop back)
```

## Error Handling Flow

```
WebSocket Connection Errors
│
├─ Connection refused
│  └─ Retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
│
├─ JWT verification failed
│  └─ Close connection, log error
│
├─ Network timeout
│  └─ Retry with exponential backoff
│
└─ Max retries exceeded (5 attempts)
   └─ Call onError callback, stop retrying

Rejoin Errors
│
├─ User not in guild
│  └─ Show error toast, keep modal open
│
├─ Channel doesn't exist
│  └─ Show error toast, keep modal open
│
├─ User lacks permissions
│  └─ Show error toast, keep modal open
│
└─ Discord API error
   └─ Show error toast, keep modal open
```

## Performance Characteristics

```
Event Detection Latency:
  Discord event → Gateway Worker: ~10-50ms
  Gateway Worker → Backend: ~5-20ms
  Backend → WebSocket broadcast: ~5-10ms
  WebSocket → Browser: ~20-100ms
  ─────────────────────────────────
  Total: ~40-180ms (typically ~100ms)

Modal Rendering:
  Event received → Modal visible: ~0-50ms (instant)

Rejoin Attempt:
  Button click → Discord API call: ~500-1000ms
  Discord API response → Modal closes: ~50-100ms
  ─────────────────────────────────
  Total: ~550-1100ms

WebSocket Connection:
  Browser → Backend: ~100-200ms
  JWT verification: ~10-20ms
  Registration: ~5-10ms
  ─────────────────────────────────
  Total: ~115-230ms
```

## Security Model

```
┌─────────────────────────────────────────┐
│         Security Layers                 │
│                                         │
│ 1. HTTPS/WSS Transport                 │
│    └─ Encrypted in transit              │
│                                         │
│ 2. JWT Authentication                  │
│    └─ Signed token with expiration      │
│                                         │
│ 3. HMAC Verification                   │
│    └─ Internal events endpoint          │
│                                         │
│ 4. Guild Isolation                     │
│    └─ Events only to clients in guild   │
│                                         │
│ 5. User Filtering                      │
│    └─ Events only trigger for own user  │
│                                         │
│ 6. Rate Limiting                       │
│    └─ Backpressure handling (1MB limit) │
└─────────────────────────────────────────┘
```

## Deployment Considerations

```
Requirements:
├─ Node.js backend (WebSocket support)
├─ Discord Gateway Worker running
├─ HUB_SECRET configured
├─ JWT signing keys configured
└─ HTTPS/WSS enabled

Scaling:
├─ WebSocket connections per server: ~10k
├─ Event broadcast latency: <200ms
├─ Memory per connection: ~5-10KB
└─ Reconnection backoff prevents thundering herd

Monitoring:
├─ WebSocket connection count
├─ Event broadcast latency
├─ Reconnection rate
├─ Error rate by type
└─ User dropout frequency
```
