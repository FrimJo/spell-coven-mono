# SSE Client-Side Type Safety

## Overview

The browser client now has fully typed and validated SSE (Server-Sent Events) messages using Zod schemas and discriminated unions.

## Type Definitions

**Location:** `/apps/web/src/types/sse-messages.ts`

### Message Types

All SSE messages follow a discriminated union pattern with a `type` field:

```typescript
type SSEMessage = 
  | SSEEventMessage
  | SSEAckMessage
  | SSEErrorMessage
```

### 1. SSE Event Message

Discord events or custom events forwarded to the browser.

```typescript
interface SSEEventMessage {
  v: 1                              // Protocol version
  type: 'event'                     // Message type
  event: GatewayDispatchEvents | string  // Event name
  payload: unknown                  // Event-specific data
  ts: number                        // Timestamp
}
```

**Examples:**
```json
{
  "v": 1,
  "type": "event",
  "event": "voice.joined",
  "payload": {
    "guildId": "123456789",
    "channelId": "987654321",
    "userId": "555555555",
    "username": "Player1",
    "avatar": "abc123"
  },
  "ts": 1699000000000
}
```

```json
{
  "v": 1,
  "type": "event",
  "event": "VOICE_STATE_UPDATE",
  "payload": {
    "guild_id": "123456789",
    "channel_id": "987654321",
    "user_id": "555555555",
    "session_id": "xyz789",
    "deaf": false,
    "mute": false
  },
  "ts": 1699000000000
}
```

### 2. SSE Acknowledgment Message

Connection established confirmation.

```typescript
interface SSEAckMessage {
  v: 1
  type: 'ack'
  event: 'connected'
  message?: string
  ts: number
}
```

**Example:**
```json
{
  "v": 1,
  "type": "ack",
  "event": "connected",
  "message": "Connected to SSE stream",
  "ts": 1699000000000
}
```

### 3. SSE Error Message

Error notification from the server.

```typescript
interface SSEErrorMessage {
  v: 1
  type: 'error'
  message: string
  code?: string
  ts: number
}
```

**Example:**
```json
{
  "v": 1,
  "type": "error",
  "message": "Failed to fetch guild data",
  "code": "GUILD_NOT_FOUND",
  "ts": 1699000000000
}
```

## Type Guards

Use type guards for type-safe message handling:

```typescript
import {
  isSSEEventMessage,
  isSSEAckMessage,
  isSSEErrorMessage,
} from '@/types/sse-messages'

// Example usage
if (isSSEEventMessage(message)) {
  // TypeScript knows message is SSEEventMessage
  console.log(`Event: ${message.event}`)
  console.log(`Payload:`, message.payload)
}
```

## Zod Validation

All messages are validated using Zod schemas:

```typescript
import { SSEMessageSchema } from '@/types/sse-messages'

const result = SSEMessageSchema.safeParse(parsed)

if (!result.success) {
  console.error('Invalid message format:', result.error)
  return
}

const message = result.data // Fully typed!
```

## Client-Side Implementation

**Location:** `/apps/web/src/hooks/useVoiceChannelEvents.ts`

### Updated Message Handling

```typescript
this.eventSource.onmessage = (event) => {
  try {
    const parsed = JSON.parse(event.data)
    
    // Validate with Zod schema
    const result = SSEMessageSchema.safeParse(parsed)
    
    if (!result.success) {
      console.error('Invalid message format:', result.error)
      return
    }
    
    const message = result.data

    // Handle acknowledgment
    if (isSSEAckMessage(message)) {
      console.log('Connection established')
      return
    }

    // Handle errors
    if (isSSEErrorMessage(message)) {
      console.error('Server error:', message.message)
      const error = new Error(message.message)
      this.listeners.forEach((listener) => {
        listener.onError?.(error)
      })
      return
    }

    // Handle events
    if (isSSEEventMessage(message)) {
      if (message.event === 'voice.joined') {
        const payload = message.payload as VoiceJoinedEventPayload
        // Handle voice.joined event
      }
      
      if (message.event === 'voice.left') {
        const payload = message.payload as VoiceLeftEventPayload
        // Handle voice.left event
      }
    }
  } catch (error) {
    console.error('Failed to parse message:', error)
  }
}
```

## Voice Event Payloads

### VoiceJoinedEventPayload

```typescript
interface VoiceJoinedEventPayload {
  guildId: string
  channelId: string
  userId: string
  username: string
  avatar: string | null
}
```

### VoiceLeftEventPayload

```typescript
interface VoiceLeftEventPayload {
  guildId: string
  channelId: null
  userId: string
}
```

## Benefits

✅ **Runtime Validation** - Zod catches invalid messages before they reach your code
✅ **Type Safety** - Full TypeScript support with discriminated unions
✅ **Type Guards** - Automatic type narrowing with `isSSEEventMessage()`, etc.
✅ **Error Handling** - Structured error messages with optional error codes
✅ **Protocol Versioning** - `v: 1` field allows for future protocol changes
✅ **IDE Support** - Autocomplete and type checking in your editor
✅ **Self-Documenting** - Types serve as documentation

## Complete Flow

```
Server (SSE Manager)
    ↓ Sends JSON via SSE
Browser (EventSource)
    ↓ Receives raw event.data
Parse JSON
    ↓
Validate with SSEMessageSchema
    ↓
Type guard (isSSEEventMessage, etc.)
    ↓ TypeScript knows exact type
Handle message with full type safety
```

## Example: Adding a New Event Type

If you need to add a new custom event:

1. **Add payload type** in `/apps/web/src/types/sse-messages.ts`:
```typescript
export interface MyCustomEventPayload {
  customField: string
  anotherField: number
}
```

2. **Handle in client** in `/apps/web/src/hooks/useVoiceChannelEvents.ts`:
```typescript
if (isSSEEventMessage(message)) {
  if (message.event === 'my.custom.event') {
    const payload = message.payload as MyCustomEventPayload
    // Handle your custom event
  }
}
```

3. **Send from server** in `/apps/web/src/server/managers/sse-manager.ts`:
```typescript
sseManager.broadcastToGuild(guildId, 'my.custom.event', {
  customField: 'value',
  anotherField: 42,
})
```

That's it! The Zod schema automatically validates the structure, and TypeScript provides type safety.
