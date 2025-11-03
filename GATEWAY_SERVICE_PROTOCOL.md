# Gateway Service WebSocket Protocol

## Overview

The Gateway Service uses a typed WebSocket protocol to communicate between the standalone Discord Gateway Service and the TanStack Start backend. All messages use a discriminated union pattern with Zod validation for type safety.

## Message Types

### Discriminated Union

All messages follow this structure with a `type` discriminator:

```typescript
type GatewayServiceMessage =
  | GatewayServiceEventMessage
  | GatewayServiceCommandMessage
  | GatewayServiceAckMessage
  | GatewayServiceErrorMessage
```

### 1. Event Message (Gateway → Backend)

Discord events forwarded from the Gateway Service to the backend.

```typescript
{
  type: 'event',
  data: {
    event: GatewayDispatchEvents,  // e.g., "VOICE_STATE_UPDATE"
    payload: unknown                // Raw Discord event data
  },
  ts: number
}
```

**Example:**
```json
{
  "type": "event",
  "data": {
    "event": "VOICE_STATE_UPDATE",
    "payload": {
      "guild_id": "123456789",
      "channel_id": "987654321",
      "user_id": "555555555",
      "session_id": "abc123",
      "deaf": false,
      "mute": false,
      "self_deaf": false,
      "self_mute": false,
      "suppress": false
    }
  },
  "ts": 1699000000000
}
```

### 2. Command Message (Backend → Gateway)

Commands sent from the backend to the Gateway Service.

```typescript
{
  type: 'command',
  data: {
    command: string,
    payload: unknown
  },
  requestId?: string,  // Optional for tracking responses
  ts: number
}
```

**Example:**
```json
{
  "type": "command",
  "data": {
    "command": "send_message",
    "payload": {
      "channel_id": "123456789",
      "content": "Hello from backend!"
    }
  },
  "requestId": "req-abc-123",
  "ts": 1699000000000
}
```

### 3. Acknowledgment Message (Gateway → Backend)

Confirmation that a command was received and processed.

```typescript
{
  type: 'ack',
  data: unknown,        // Command result or confirmation
  requestId?: string,   // Matches the command's requestId
  ts: number
}
```

**Example:**
```json
{
  "type": "ack",
  "data": {
    "success": true,
    "message_id": "999999999"
  },
  "requestId": "req-abc-123",
  "ts": 1699000000100
}
```

### 4. Error Message (Gateway → Backend)

Error notification from the Gateway Service.

```typescript
{
  type: 'error',
  data: {
    message: string,
    code?: string
  },
  requestId?: string,   // If error relates to a specific command
  ts: number
}
```

**Example:**
```json
{
  "type": "error",
  "data": {
    "message": "Failed to send message: Missing permissions",
    "code": "MISSING_PERMISSIONS"
  },
  "requestId": "req-abc-123",
  "ts": 1699000000200
}
```

## Type Guards

Use type guards for type-safe message handling:

```typescript
import {
  isEventMessage,
  isCommandMessage,
  isAckMessage,
  isErrorMessage,
} from '@repo/discord-integration/types'

// Example usage
if (isEventMessage(message)) {
  // TypeScript knows message is GatewayServiceEventMessage
  const { event, payload } = message.data
  console.log(`Received ${event} event`)
}
```

## Zod Validation

All messages are validated using Zod schemas:

```typescript
import { GatewayServiceMessageSchema } from '@repo/discord-integration/types'

const result = GatewayServiceMessageSchema.safeParse(parsed)

if (!result.success) {
  console.error('Invalid message:', result.error)
  return
}

const message = result.data // Fully typed!
```

## Implementation Examples

### Backend (Receiving Events)

```typescript
ws.on('message', (data: Buffer) => {
  const parsed = JSON.parse(data.toString())
  const result = GatewayServiceMessageSchema.safeParse(parsed)
  
  if (!result.success) {
    console.error('Invalid message format:', result.error)
    return
  }
  
  const message = result.data

  if (isEventMessage(message)) {
    const { event, payload } = message.data
    // Forward to SSE clients
    sseManager.broadcastToGuild(guildId, event, payload)
  }
  
  if (isErrorMessage(message)) {
    console.error('Gateway error:', message.data.message)
  }
  
  if (isAckMessage(message)) {
    console.log('Command acknowledged:', message.requestId)
  }
})
```

### Backend (Sending Commands)

```typescript
function sendGatewayCommand(
  command: string,
  payload: unknown,
  requestId?: string,
): void {
  const message: GatewayServiceMessage = {
    type: 'command',
    data: { command, payload },
    requestId,
    ts: Date.now(),
  }
  
  ws.send(JSON.stringify(message))
}

// Usage
sendGatewayCommand('send_message', {
  channel_id: '123456789',
  content: 'Hello!'
}, 'req-001')
```

### Gateway Service (Broadcasting Events)

```typescript
import type { GatewayEventData } from '@repo/discord-integration/clients'

gatewayClient.onAnyEvent((event: GatewayEventData) => {
  const message: GatewayServiceMessage = {
    type: 'event',
    data: {
      event: event.type,
      payload: event.data,
    },
    ts: Date.now(),
  }
  
  wsServer.broadcast(JSON.stringify(message))
})
```

## Authentication

WebSocket connections must authenticate using the `LINK_TOKEN`:

```typescript
const ws = new WebSocket(gatewayUrl, {
  headers: {
    Authorization: `Bearer ${linkToken}`,
  },
})
```

The Gateway Service validates this token before accepting the connection.

## Event Flow

```
Discord API
    ↓
Discord Gateway Service
    ↓ (WebSocket: GatewayServiceEventMessage)
TanStack Start Backend
    ↓ (SSE: Raw Discord events)
Browser Client
```

## Benefits

✅ **Type Safety** - Full TypeScript support with discriminated unions
✅ **Runtime Validation** - Zod schemas catch invalid messages
✅ **Extensible** - Easy to add new message types
✅ **Self-Documenting** - Types serve as documentation
✅ **IDE Support** - Autocomplete and type checking
✅ **Error Prevention** - Catches mistakes at compile time

## Files

- **Types Definition**: `/packages/discord-integration/src/types/gateway-service.ts`
- **Backend Implementation**: `/apps/web/src/server/init/gateway-client-init.server.ts`
- **Gateway Service**: `/apps/discord-gateway/src/ws-server.ts`

## Discord Event Types

All Discord event types are derived from `discord-api-types`:

```typescript
import type { GatewayDispatchEvents } from 'discord-api-types/v10'

// GatewayDispatchEvents is a union of all Discord event names:
// "READY" | "MESSAGE_CREATE" | "VOICE_STATE_UPDATE" | ...
```

This ensures the protocol stays up-to-date with Discord's API automatically when updating the `discord-api-types` package.
