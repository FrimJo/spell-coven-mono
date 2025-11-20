# Message Interface Validation Report

## Overview

This document validates the interface between the web application (`@web`) and the Cloudflare PeerJS server (`@cloudflare-peerjs-server`).

## Validation Date

2024-12-19

## 1. WebSocket Connection Interface

### ✅ Endpoint Path

- **Server expects**: `/peerjs/peerjs`
- **Client configures**: `path: '/peerjs'` (PeerJS library appends `/peerjs` automatically)
- **Status**: ✅ CORRECT - The comment in `index.ts` correctly explains this behavior

### ✅ Query Parameters

**Server requires** (from `GameRoomCoordinator.ts:84-86`):

- `key`: API key (currently unused but required)
- `id`: Peer ID (1-64 alphanumeric characters)
- `token`: Room token (game/room ID)

**PeerJS Library sends**:

- `key`: Automatically included by PeerJS library
- `id`: The peer ID passed to `new Peer(id, config)`
- `token`: **MISSING** - This is a custom parameter that PeerJS doesn't send by default

**Status**: ⚠️ **ISSUE FOUND** - The `token` parameter is required by the server but PeerJS library doesn't send it automatically.

### Recommendation

The PeerJS library needs to be configured to include the `token` query parameter. This can be done by:

1. Modifying the PeerJS connection URL construction, OR
2. Using a custom PeerJS configuration that includes the token

## 2. Message Format Interface

### Client → Server Messages

#### ✅ HEARTBEAT

```typescript
{
  type: "HEARTBEAT";
}
```

- **Status**: ✅ CORRECT - Matches PeerJS protocol

#### ✅ OFFER

```typescript
{
  type: 'OFFER',
  src: string,  // Source peer ID
  dst: string,  // Destination peer ID
  payload: {
    type: 'offer',
    sdp: string
  }
}
```

- **Status**: ✅ CORRECT - Matches PeerJS protocol v0.3.x
- **Validation**: Server validates `src` matches peer ID (prevents spoofing)
- **Validation**: Server validates `dst` peer exists before routing

#### ✅ ANSWER

```typescript
{
  type: 'ANSWER',
  src: string,  // Source peer ID
  dst: string,  // Destination peer ID
  payload: {
    type: 'answer',
    sdp: string
  }
}
```

- **Status**: ✅ CORRECT - Matches PeerJS protocol v0.3.x
- **Validation**: Server validates `src` matches peer ID
- **Validation**: Server validates `dst` peer exists before routing

#### ✅ CANDIDATE

```typescript
{
  type: 'CANDIDATE',
  src: string,  // Source peer ID
  dst: string,  // Destination peer ID
  payload: {
    candidate: string,
    sdpMid?: string | null,
    sdpMLineIndex?: number | null,
    usernameFragment?: string | null
  }
}
```

- **Status**: ✅ CORRECT - Matches PeerJS protocol v0.3.x
- **Validation**: Server validates `src` matches peer ID
- **Validation**: Server validates `dst` peer exists before routing

#### ✅ LEAVE

```typescript
{
  type: 'LEAVE',
  src: string  // Peer ID leaving
}
```

- **Status**: ✅ CORRECT - Matches PeerJS protocol v0.3.x
- **Validation**: Server validates `src` matches peer ID

### Server → Client Messages

#### ✅ OPEN

```typescript
{
  type: 'OPEN',
  peerId: string  // Confirmed peer ID
}
```

- **Status**: ✅ CORRECT - Sent immediately after WebSocket upgrade
- **Implementation**: Sent asynchronously after Response is returned (correct)

#### ✅ OFFER (Relayed)

```typescript
{
  type: 'OFFER',
  src: string,  // Source peer ID (dst removed by server)
  payload: {
    type: 'offer',
    sdp: string
  }
}
```

- **Status**: ✅ CORRECT - Server correctly removes `dst` field when relaying
- **Note**: PeerJS library expects this format

#### ✅ ANSWER (Relayed)

```typescript
{
  type: 'ANSWER',
  src: string,  // Source peer ID (dst removed by server)
  payload: {
    type: 'answer',
    sdp: string
  }
}
```

- **Status**: ✅ CORRECT - Server correctly removes `dst` field when relaying

#### ✅ CANDIDATE (Relayed)

```typescript
{
  type: 'CANDIDATE',
  src: string,  // Source peer ID (dst removed by server)
  payload: {
    candidate: string,
    sdpMid?: string | null,
    sdpMLineIndex?: number | null,
    usernameFragment?: string | null
  }
}
```

- **Status**: ✅ CORRECT - Server correctly removes `dst` field when relaying

#### ✅ LEAVE

```typescript
{
  type: 'LEAVE',
  peerId: string  // Peer ID that left
}
```

- **Status**: ✅ CORRECT - Broadcast to all other peers

#### ✅ EXPIRE

```typescript
{
  type: 'EXPIRE',
  peerId: string  // Peer ID that timed out
}
```

- **Status**: ✅ CORRECT - Sent when peer heartbeat times out

#### ✅ ERROR

```typescript
{
  type: 'ERROR',
  payload: {
    type: 'invalid-message' | 'unknown-peer' | 'rate-limit-exceeded' | 'room-full' | 'internal-error',
    message: string
  }
}
```

- **Status**: ✅ CORRECT - Proper error handling

## 3. Message Validation

### ✅ Schema Validation

- Uses Zod schemas for type-safe validation
- Validates all required fields
- Validates peer ID format (1-64 alphanumeric characters)
- Validates message size (< 1MB)

### ✅ Security Validation

- **Source Spoofing Prevention**: Server validates `src` matches peer ID (`routeMessage:262`)
- **Destination Validation**: Server validates `dst` peer exists before routing
- **Rate Limiting**: 100 messages/second per peer
- **Room Limits**: Maximum 4 peers per room

## 4. Message Routing Logic

### ✅ OFFER Routing

- Validates destination exists
- Transforms client message to server message format (removes `dst`)
- Sends to destination peer
- **Status**: ✅ CORRECT

### ✅ ANSWER Routing

- Validates destination exists
- Transforms client message to server message format (removes `dst`)
- Sends to destination peer
- **Status**: ✅ CORRECT

### ✅ CANDIDATE Routing

- Validates destination exists
- Transforms client message to server message format (removes `dst`)
- Sends to destination peer
- **Status**: ✅ CORRECT

### ✅ LEAVE Routing

- Broadcasts to all other peers (excludes sender)
- Removes peer from registry
- **Status**: ✅ CORRECT

### ✅ HEARTBEAT Handling

- Updates peer's last heartbeat timestamp
- Checks for timed-out peers after processing
- **Status**: ✅ CORRECT

## 5. Connection Lifecycle

### ✅ WebSocket Upgrade

- Validates required query parameters
- Validates peer ID format
- Checks room capacity
- Creates WebSocket pair
- Registers peer
- Sends OPEN message
- **Status**: ✅ CORRECT

### ✅ Connection Cleanup

- Handles WebSocket close events
- Handles WebSocket error events
- Broadcasts LEAVE/EXPIRE messages
- Removes peer from registry
- Resets rate limiter
- **Status**: ✅ CORRECT

## 6. Issues Found

### ⚠️ Issue #1: Missing Token Parameter

**Severity**: HIGH
**Location**:

- Server: `GameRoomCoordinator.ts:86` (requires token)
- Client: `PeerJSManager.ts:109` (does not include token)

**Description**: Server requires `token` query parameter, but PeerJS library doesn't send it by default. The PeerJS library constructs the WebSocket URL internally and doesn't expose a way to add custom query parameters.

**Impact**: WebSocket upgrade will fail with 400 error: "Missing required query parameters: key, id, token"

**Current State**:

- `PeerJSManager.ts` creates Peer instance with only standard PeerJS config (host, port, path, secure)
- No token/roomId is passed to PeerJS connection
- Server expects token in query parameters for routing to correct Durable Object

**Solution Options**:

1. **Modify PeerJS Library** (Recommended): Patch the PeerJS library to support custom query parameters:

   ```typescript
   // In PeerJSManager.ts, modify peerConfig to include token
   const peerConfig = {
     host: env.VITE_PEERJS_HOST,
     port: parseInt(env.VITE_PEERJS_PORT, 10),
     path: env.VITE_PEERJS_PATH,
     secure: env.VITE_PEERJS_SSL,
     // Add custom query params (requires PeerJS library modification)
     config: {
       token: roomId, // Need to pass roomId from GameRoom component
     },
   };
   ```

2. **Modify Server** (Alternative): Extract token from peer ID or make it optional:
   - If peer ID format can encode room ID, extract it server-side
   - Or use a different routing mechanism (e.g., subdomain, path-based routing)

3. **Use Proxy/Interceptor** (Workaround): Intercept WebSocket connection and modify URL before connection:
   - Override WebSocket constructor to add token parameter
   - This is fragile and not recommended for production

### ✅ Issue #2: None Found

All other message formats and routing logic are correct.

## 7. Recommendations

1. **Fix Token Parameter**: Ensure the web application includes the `token` query parameter when connecting to PeerJS server.

2. **Add Integration Tests**: Create tests that verify:
   - WebSocket connection with all required parameters
   - Message routing between peers
   - Error handling for invalid messages
   - Rate limiting behavior

3. **Document Token Usage**: Update README to clearly explain how to include the token parameter.

4. **Consider Making Token Optional**: If the token is only used for routing to the correct Durable Object, consider extracting it from the connection URL or making it optional if peer ID is sufficient.

## 8. Conclusion

The message interface between `@web` and `@cloudflare-peerjs-server` is **mostly correct** with one critical issue:

- ✅ All message formats match PeerJS protocol v0.3.x
- ✅ Message validation and routing logic is correct
- ✅ Security validations are in place
- ⚠️ **CRITICAL**: Token parameter must be included in WebSocket connection URL

The interface is well-designed and follows the PeerJS protocol correctly. The main issue is ensuring the web application properly includes the `token` parameter when establishing the WebSocket connection.

### Summary of Findings

**What Works:**

1. ✅ Message protocol formats (OFFER, ANSWER, CANDIDATE, LEAVE, HEARTBEAT)
2. ✅ Message routing and transformation logic
3. ✅ Security validations (source spoofing prevention, rate limiting)
4. ✅ Connection lifecycle management
5. ✅ Error handling and validation

**What Needs Fixing:**

1. ⚠️ **CRITICAL**: Token parameter not included in PeerJS WebSocket connection
   - `roomId` (game/room ID) is available in `GameRoom.tsx` but not passed to `PeerJSManager`
   - Server requires token for routing to correct Durable Object
   - Connection will fail with 400 error without token

**Next Steps:**

1. Modify `PeerJSManager` to accept and include token parameter
2. Pass `roomId` from `GameRoom` component to `usePeerJS` hook
3. Update `usePeerJS` to pass token to `PeerJSManager`
4. Modify PeerJS connection to include token in query parameters (may require library patching)
5. Test WebSocket connection with token parameter
