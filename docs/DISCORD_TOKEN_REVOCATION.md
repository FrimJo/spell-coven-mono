# Discord Token Revocation in PKCE Flows

## Problem

The Discord OAuth2 token revocation endpoint (`/oauth2/token/revoke`) requires `client_secret` for authentication, which creates a security issue for browser-based applications using PKCE (Proof Key for Code Exchange).

### Current Error
```
POST https://discord.com/api/v10/oauth2/token/revoke 401 (Unauthorized)
Error: invalid_client
```

## Why This Happens

1. **PKCE is designed for public clients** (browser apps, mobile apps) that cannot securely store secrets
2. **Discord requires `client_secret`** for token revocation, even in PKCE flows
3. **You cannot safely include `client_secret`** in browser-side code (it would be exposed to users)

## Current Solution (Implemented)

The logout flow now gracefully handles revocation failures:

```typescript
// In useDiscordAuth.ts
if (token) {
  try {
    await getDiscordClient().revokeToken(token.accessToken)
  } catch (revokeErr) {
    console.warn('Token revocation failed (expected for PKCE flows):', revokeErr)
    // Continue with logout - token will expire naturally
  }
}

// Clear local state regardless
setToken(null)
clearStoredDiscordToken()
```

**This is acceptable because:**
- Discord OAuth tokens expire after 7 days
- Local storage is cleared, so the token is no longer usable in your app
- The user is effectively logged out from your application

## Better Long-Term Solution

For proper token revocation, implement a server-side proxy endpoint:

### 1. Add Environment Variable

```bash
# .env (server-side only, never commit!)
DISCORD_CLIENT_SECRET=your_client_secret_here
```

### 2. Create Server Endpoint

```typescript
// app/routes/api/auth/revoke.ts
import { json } from '@tanstack/start'

export async function POST({ request }: { request: Request }) {
  const { token } = await request.json()
  
  const params = new URLSearchParams({
    client_id: process.env.VITE_DISCORD_CLIENT_ID!,
    client_secret: process.env.DISCORD_CLIENT_SECRET!, // Server-side only
    token: token,
  })

  const response = await fetch('https://discord.com/api/v10/oauth2/token/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    return json({ error: 'Revocation failed' }, { status: response.status })
  }

  return json({ success: true })
}
```

### 3. Update Client Code

```typescript
// In useDiscordAuth.ts
if (token) {
  try {
    // Call your server endpoint instead of Discord directly
    await fetch('/api/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.accessToken }),
    })
  } catch (revokeErr) {
    console.warn('Token revocation failed:', revokeErr)
  }
}
```

## Security Considerations

### ❌ Never Do This
```typescript
// NEVER include client_secret in browser code!
const params = new URLSearchParams({
  client_id: 'xxx',
  client_secret: 'yyy', // ❌ Exposed to all users!
  token: accessToken,
})
```

### ✅ Do This Instead
- Store `DISCORD_CLIENT_SECRET` only on the server
- Use environment variables that are NOT prefixed with `VITE_`
- Create a server endpoint that proxies the revocation request
- Validate the request on your server before calling Discord

## References

- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2)
- [RFC 7636 - PKCE](https://tools.ietf.org/html/rfc7636)
- [RFC 7009 - Token Revocation](https://tools.ietf.org/html/rfc7009)

## Implementation Status

- ✅ **Phase 1**: Graceful handling of revocation failures (COMPLETED)
- ✅ **Phase 2**: Server-side revocation endpoint (IMPLEMENTED)

## Files Modified

1. **`/apps/web/src/routes/api/auth.revoke.ts`** - Server-side revocation endpoint
2. **`/apps/web/src/hooks/useDiscordAuth.ts`** - Updated to call server endpoint
3. **`/.env.example`** - Added `DISCORD_CLIENT_SECRET` placeholder
4. **`/.env.development.local`** - Add your actual client secret here (not committed)

## Testing

1. Ensure `DISCORD_CLIENT_SECRET` is set in your `.env.development.local`
2. Start the dev server: `pnpm --filter @repo/web dev`
3. Log in with Discord OAuth
4. Click logout - token should be properly revoked on Discord's side
5. Check browser console for success/error messages
