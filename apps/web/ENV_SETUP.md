# Environment Variables Setup

This project uses a centralized, type-safe environment variable configuration with Zod validation.

## Quick Start

1. **Copy the example file:**

   ```bash
   cp .env.example .env.development
   ```

2. **Fill in required values** (see below for where to get them)

3. **Start the dev server:**
   ```bash
   bun run dev
   ```

If any required environment variables are missing, you'll get a clear error message on startup.

## Configuration File

All environment variables are validated in `/src/env.ts` using Zod schemas. This provides:

- ✅ **Type safety** - Full TypeScript autocomplete
- ✅ **Runtime validation** - Catches missing/invalid vars at startup
- ✅ **Clear error messages** - Know exactly what's missing
- ✅ **Single source of truth** - One place to manage all env vars

## Usage

### In Server Code (`.server.ts` files)

```typescript
import { env } from '@/env'

// All environment variables are available
const botToken = env.DISCORD_BOT_TOKEN
const guildId = env.VITE_DISCORD_GUILD_ID
const hubSecret = env.HUB_SECRET
```

### In Client Code (components, hooks)

```typescript
import { env } from '@/env'

// Only VITE_* prefixed variables are available
const clientId = env.VITE_DISCORD_CLIENT_ID
const guildId = env.VITE_DISCORD_GUILD_ID
```

Or use the helper:

```typescript
import { getClientEnv } from '@/env'

const clientEnv = getClientEnv()
```

## Required Environment Variables

### Discord Configuration

| Variable                 | Required | Where to Get It                                                                                                           | Description                       |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `VITE_DISCORD_CLIENT_ID` | ✅ Yes   | [Discord Developer Portal](https://discord.com/developers/applications) → Your App → General Information → Application ID | Discord OAuth2 Client ID (public) |
| `VITE_DISCORD_GUILD_ID`  | ✅ Yes   | Discord → Right-click server → Copy Server ID (requires Developer Mode)                                                   | Your Discord server ID            |
| `DISCORD_BOT_TOKEN`      | ✅ Yes   | [Discord Developer Portal](https://discord.com/developers/applications) → Your App → Bot → Token                          | Bot token (keep secret!)          |
| `DISCORD_BOT_USER_ID`    | ✅ Yes   | Same as Application ID                                                                                                    | Bot's user ID                     |
| `DISCORD_CLIENT_SECRET`  | ✅ Yes   | [Discord Developer Portal](https://discord.com/developers/applications) → Your App → OAuth2 → Client Secret               | OAuth2 secret (keep secret!)      |

### Security Secrets

| Variable               | Required    | Description                                          |
| ---------------------- | ----------- | ---------------------------------------------------- |
| `HUB_SECRET`           | ✅ Yes      | HMAC secret for gateway communication (min 32 chars) |
| `ROOM_TOKEN_SECRET`    | ✅ Yes      | Secret for room invite tokens (min 32 chars)         |
| `WS_AUTH_SECRET`       | ❌ Optional | WebSocket authentication secret                      |
| `ADMIN_CLEANUP_SECRET` | ❌ Optional | Admin API secret for cleanup operations              |

**Generate secrets with:**

```bash
openssl rand -hex 32
```

### Application Configuration

| Variable                  | Required    | Default                 | Description                                |
| ------------------------- | ----------- | ----------------------- | ------------------------------------------ |
| `VITE_BASE_URL`           | ❌ Optional | `http://localhost:1234` | Base URL for the app                       |
| `VITE_EMBEDDINGS_VERSION` | ❌ Optional | `v1.3`                  | MTG embeddings version                     |
| `VITE_EMBEDDINGS_FORMAT`  | ❌ Optional | `float32`               | Embeddings format (`float32` or `float16`) |
| `VITE_QUERY_CONTRAST`     | ❌ Optional | `1.5`                   | Image contrast enhancement factor          |
| `VITE_BLOB_STORAGE_URL`   | ❌ Optional | -                       | Vercel Blob Storage URL                    |
| `BLOB_READ_WRITE_TOKEN`   | ❌ Optional | -                       | Blob storage access token                  |

### Gateway Configuration

| Variable         | Required    | Default               | Description                   |
| ---------------- | ----------- | --------------------- | ----------------------------- |
| `GATEWAY_WS_URL` | ❌ Optional | `ws://localhost:8080` | Discord Gateway WebSocket URL |
| `LINK_TOKEN`     | ❌ Optional | -                     | Gateway link token            |
| `WS_PORT`        | ❌ Optional | `4321`                | WebSocket server port         |

### JWT Configuration (if using external auth)

| Variable             | Required    | Description       |
| -------------------- | ----------- | ----------------- |
| `JWT_ISSUER`         | ❌ Optional | JWT issuer URL    |
| `JWT_AUDIENCE`       | ❌ Optional | JWT audience      |
| `JWT_PUBLIC_JWK_URL` | ❌ Optional | JWKS endpoint URL |

## Example `.env.development`

```bash
# Discord Configuration
VITE_DISCORD_CLIENT_ID=1430245817066717204
VITE_DISCORD_GUILD_ID=615950086152651036
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_BOT_USER_ID=1430245817066717204
DISCORD_CLIENT_SECRET=your-client-secret-here

# Security Secrets (generate with: openssl rand -hex 32)
HUB_SECRET=your-hub-secret-min-32-chars-here
ROOM_TOKEN_SECRET=your-room-token-secret-min-32-chars-here

# Application Configuration
VITE_BASE_URL=http://localhost:1234
VITE_EMBEDDINGS_VERSION=v1.3
VITE_EMBEDDINGS_FORMAT=float32
VITE_QUERY_CONTRAST=1.5
VITE_BLOB_STORAGE_URL=https://your-blob-storage.vercel-storage.com/

# Gateway Configuration
GATEWAY_WS_URL=ws://localhost:8080
WS_PORT=4321

# Logging
LOG_LEVEL=info
```

## Troubleshooting

### Error: "Environment variable validation failed"

The app will show exactly which variables are missing or invalid:

```
❌ Environment variable validation failed:
  - DISCORD_BOT_TOKEN: Required
  - HUB_SECRET: String must contain at least 32 character(s)

Please check your .env.development file and ensure all required variables are set.
```

**Fix:** Add the missing variables to your `.env.development` file and restart the dev server.

### Variables not updating

Environment variables are loaded at startup. After changing `.env.development`:

1. Stop the dev server (Ctrl+C)
2. Restart: `bun run dev`

### TypeScript errors

If you add new environment variables:

1. Add them to the schema in `/src/env.ts`
2. Update the `Env` type (it's auto-inferred from the schema)
3. Restart your IDE's TypeScript server

## Security Best Practices

✅ **DO:**

- Use `VITE_` prefix for public values (Client ID, Guild ID, Base URL)
- Keep secrets without `VITE_` prefix (Bot Token, Client Secret, Hub Secret)
- Generate strong secrets (min 32 characters)
- Use different secrets for development and production
- Add `.env.development.local` to `.gitignore` for local overrides

❌ **DON'T:**

- Commit `.env.development.local` or `.env.production` to git
- Use `VITE_` prefix for secrets (they'll be exposed to the browser!)
- Share bot tokens or secrets in chat/email
- Reuse secrets across projects

## Adding New Environment Variables

1. **Add to schema** in `/src/env.ts`:

   ```typescript
   const envSchema = z.object({
     // ... existing vars
     MY_NEW_VAR: z.string().min(1, 'My new var is required'),
   })
   ```

2. **Add to `.env.example`** with documentation

3. **Use in your code**:

   ```typescript
   import { env } from '@/env'

   const myVar = env.MY_NEW_VAR
   ```

4. **Restart dev server** to pick up changes
