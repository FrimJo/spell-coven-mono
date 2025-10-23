# @repo/discord-integration

Pure Discord API integration package for Spell Coven with **zero React dependencies**.

## Architecture: Separation of Concerns (SoC)

This package implements Discord API clients and managers with **strict separation of concerns**:

### Package Responsibilities (What this package DOES)

- ✅ Discord OAuth2 authentication with PKCE
- ✅ Discord Gateway (WebSocket) client for real-time events
- ✅ Discord REST API client for actions (messages, channels)
- ✅ Discord RTC client for video/voice streaming
- ✅ Type-safe schemas with Zod validation
- ✅ Event emitters for state changes

### Package Boundaries (What this package DOES NOT do)

- ❌ NO React dependencies or hooks
- ❌ NO browser storage (localStorage, IndexedDB) - returns tokens to caller
- ❌ NO UI components - presentation layer is in `apps/web`
- ❌ NO state management - stores are in `apps/web`

### Bridge Layer

React hooks in `apps/web/src/hooks/` are the **ONLY** bridge between this package and the UI:

- `useDiscordAuth()` - Consumes `DiscordOAuthClient`, manages localStorage
- `useDiscordConnection()` - Consumes `DiscordGatewayClient`, manages connection state
- `useDiscordMessages()` - Consumes `DiscordRestClient`, manages message cache
- `useDiscordVideo()` - Consumes `DiscordRtcClient`, manages MediaStream

## Installation

```bash
pnpm add @repo/discord-integration
```

## Usage

### OAuth Authentication (PKCE)

```typescript
import { DiscordOAuthClient } from '@repo/discord-integration/clients'

const client = new DiscordOAuthClient({
  clientId: 'YOUR_CLIENT_ID',
  redirectUri: 'http://localhost:3000/auth/discord/callback',
  scopes: ['identify', 'guilds', 'messages.read'],
})

// Generate PKCE challenge
const { codeVerifier, codeChallenge } = await client.generatePKCE()

// Get authorization URL
const authUrl = client.getAuthUrl(codeChallenge)

// Exchange code for token (after OAuth callback)
const token = await client.exchangeCodeForToken(code, codeVerifier)

// Refresh token before expiration
const newToken = await client.refreshToken(token.refreshToken)

// Fetch user profile
const user = await client.fetchUser(token.accessToken)
```

### Gateway Connection (WebSocket)

```typescript
import { DiscordGatewayClient } from '@repo/discord-integration/clients'

const gateway = new DiscordGatewayClient(token.accessToken)

// Listen for connection state changes
gateway.on('stateChange', (state) => {
  console.log('Gateway state:', state) // "connected", "reconnecting", etc.
})

// Listen for messages
gateway.on('message', (message) => {
  console.log('New message:', message)
})

// Connect to Gateway
await gateway.connect()

// Disconnect
await gateway.disconnect()
```

### REST API (Messages, Channels)

```typescript
import { DiscordRestClient } from '@repo/discord-integration/clients'

const rest = new DiscordRestClient(token.accessToken)

// Get channels
const channels = await rest.getChannels(guildId)

// Send message
const message = await rest.sendMessage(channelId, {
  content: 'Hello from Spell Coven!',
  embeds: [{ title: 'Card Lookup', description: 'Lightning Bolt' }],
})

// Get messages
const messages = await rest.getMessages(channelId, { limit: 50 })
```

## Type Safety

All entities use Zod schemas for runtime validation:

```typescript
import {
  DiscordTokenSchema,
  DiscordUserSchema,
} from '@repo/discord-integration/types'

// Validate token from localStorage
const token = DiscordTokenSchema.parse(
  JSON.parse(localStorage.getItem('discord_token')),
)

// Validate user from API
const user = DiscordUserSchema.parse(apiResponse)
```

## Testing

```bash
# Run unit tests
pnpm test

# Run tests with UI
pnpm test:ui

# Type check
pnpm type-check
```

## Security

- **PKCE OAuth2**: No client secret required - safe for browser use
- **Token Management**: Package returns tokens to caller - storage is caller's responsibility
- **Input Validation**: All inputs validated with Zod schemas
- **Rate Limiting**: Automatic exponential backoff for Discord API rate limits

## Documentation

- [Implementation Guide](../../specs/013-discord-api-integration/IMPLEMENTATION_GUIDE.md)
- [Data Model](../../specs/013-discord-api-integration/data-model.md)
- [API Contracts](../../specs/013-discord-api-integration/contracts/)
- [Quick Start](../../specs/013-discord-api-integration/quickstart.md)

## License

MIT
