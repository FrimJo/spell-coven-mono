# Contract: DiscordOAuthClient

**Package**: `@repo/discord-integration`  
**Version**: 1.0  
**Purpose**: OAuth2 authentication with PKCE for Discord API access

## Interface

```typescript
interface DiscordOAuthClient {
  /**
   * Generate PKCE challenge for OAuth flow
   * @returns PKCEChallenge with code_verifier and code_challenge
   */
  generatePKCE(): Promise<PKCEChallenge>;

  /**
   * Get Discord OAuth authorization URL
   * @param codeChallenge - PKCE code challenge from generatePKCE()
   * @param redirectUri - OAuth callback URL
   * @param scopes - Requested OAuth scopes
   * @returns Authorization URL to redirect user to
   */
  getAuthUrl(
    codeChallenge: string,
    redirectUri: string,
    scopes: string[]
  ): string;

  /**
   * Exchange authorization code for access token
   * @param code - Authorization code from Discord callback
   * @param codeVerifier - PKCE code verifier from generatePKCE()
   * @param redirectUri - Must match the redirect URI used in getAuthUrl()
   * @returns DiscordToken with access and refresh tokens
   * @throws {OAuthError} If exchange fails (invalid code, expired, etc.)
   */
  exchangeCodeForToken(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<DiscordToken>;

  /**
   * Refresh expired access token
   * @param refreshToken - Refresh token from DiscordToken
   * @returns New DiscordToken with updated access token
   * @throws {OAuthError} If refresh fails (invalid/revoked token)
   */
  refreshToken(refreshToken: string): Promise<DiscordToken>;

  /**
   * Fetch authenticated user's Discord profile
   * @param accessToken - Access token from DiscordToken
   * @returns DiscordUser profile information
   * @throws {ApiError} If fetch fails (invalid token, network error)
   */
  fetchUser(accessToken: string): Promise<DiscordUser>;
}
```

## Types

```typescript
interface PKCEChallenge {
  codeVerifier: string;    // 43-128 character random string
  codeChallenge: string;   // Base64URL(SHA256(codeVerifier))
  codeChallengeMethod: "S256";
}

interface DiscordToken {
  version: "1.0";
  accessToken: string;
  refreshToken: string;
  expiresAt: number;       // Unix timestamp (milliseconds)
  scopes: string[];
  tokenType: "Bearer";
}

interface DiscordUser {
  version: "1.0";
  id: string;              // Discord snowflake ID
  username: string;
  discriminator: string;   // "0" for new usernames, "####" for legacy
  avatar: string | null;   // Avatar hash or null
  avatarUrl?: string;      // Computed CDN URL
  bot?: boolean;
  system?: boolean;
  flags?: number;
}

interface OAuthError extends Error {
  code: "invalid_grant" | "invalid_request" | "access_denied" | "network_error";
  description?: string;
}
```

## Behavior Contracts

### generatePKCE()

**Preconditions**:
- Browser supports `crypto.getRandomValues()` and `crypto.subtle.digest()`

**Postconditions**:
- Returns PKCEChallenge with 43-128 character `codeVerifier`
- `codeChallenge` is Base64URL-encoded SHA256 hash of `codeVerifier`
- `codeChallengeMethod` is always "S256"

**Error Handling**:
- Throws if crypto APIs not available (unsupported browser)

### getAuthUrl()

**Preconditions**:
- `codeChallenge` is valid Base64URL string
- `redirectUri` is valid URL matching Discord app configuration
- `scopes` array contains at least `["identify"]`

**Postconditions**:
- Returns Discord OAuth URL with query parameters:
  - `client_id`: Discord application ID
  - `redirect_uri`: Encoded redirect URI
  - `response_type`: "code"
  - `scope`: Space-separated scopes
  - `code_challenge`: PKCE challenge
  - `code_challenge_method`: "S256"

**Error Handling**:
- No errors (pure function, validation done by Discord)

### exchangeCodeForToken()

**Preconditions**:
- `code` is valid authorization code from Discord callback
- `codeVerifier` matches the verifier used to generate `codeChallenge`
- `redirectUri` matches the URI used in getAuthUrl()

**Postconditions**:
- Returns DiscordToken with:
  - `accessToken`: Valid for 1-2 hours
  - `refreshToken`: Valid for 30 days
  - `expiresAt`: Timestamp when access token expires
  - `scopes`: Granted scopes (may differ from requested)

**Error Handling**:
- Throws `OAuthError` with `code: "invalid_grant"` if:
  - Authorization code is invalid or expired
  - Code verifier doesn't match challenge
  - Redirect URI doesn't match
- Throws `OAuthError` with `code: "network_error"` if:
  - Network request fails
  - Discord API is unavailable

### refreshToken()

**Preconditions**:
- `refreshToken` is valid and not revoked
- Refresh token has not expired (30 days from issuance)

**Postconditions**:
- Returns new DiscordToken with:
  - New `accessToken` (old one is invalidated)
  - Same `refreshToken` (reused)
  - New `expiresAt` timestamp
  - Same `scopes`

**Error Handling**:
- Throws `OAuthError` with `code: "invalid_grant"` if:
  - Refresh token is invalid or revoked
  - Refresh token has expired
  - User revoked app permissions
- Throws `OAuthError` with `code: "network_error"` if:
  - Network request fails

### fetchUser()

**Preconditions**:
- `accessToken` is valid and not expired
- Token has `identify` scope

**Postconditions**:
- Returns DiscordUser with user's profile information
- `avatarUrl` is computed from `avatar` hash if present

**Error Handling**:
- Throws `ApiError` if:
  - Access token is invalid or expired
  - Token lacks `identify` scope
  - Network request fails

## Usage Example

```typescript
import { DiscordOAuthClient } from '@repo/discord-integration';

const client = new DiscordOAuthClient({
  clientId: process.env.VITE_DISCORD_CLIENT_ID,
  redirectUri: 'http://localhost:3000/auth/discord/callback'
});

// Step 1: Generate PKCE challenge
const pkce = await client.generatePKCE();
// Store codeVerifier in sessionStorage for callback

// Step 2: Redirect user to Discord
const authUrl = client.getAuthUrl(
  pkce.codeChallenge,
  'http://localhost:3000/auth/discord/callback',
  ['identify', 'guilds', 'messages.read']
);
window.location.href = authUrl;

// Step 3: Handle callback (in /auth/discord/callback route)
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const codeVerifier = sessionStorage.getItem('code_verifier');

try {
  const token = await client.exchangeCodeForToken(code, codeVerifier, redirectUri);
  // Store token in localStorage
  localStorage.setItem('discord_token', JSON.stringify(token));
  
  // Fetch user profile
  const user = await client.fetchUser(token.accessToken);
  console.log('Authenticated as:', user.username);
} catch (error) {
  if (error instanceof OAuthError) {
    console.error('OAuth failed:', error.code, error.description);
  }
}

// Step 4: Refresh token before expiration
const storedToken = JSON.parse(localStorage.getItem('discord_token'));
if (Date.now() > storedToken.expiresAt - 5 * 60 * 1000) {  // 5 min buffer
  const newToken = await client.refreshToken(storedToken.refreshToken);
  localStorage.setItem('discord_token', JSON.stringify(newToken));
}
```

## Security Considerations

1. **Code Verifier Storage**: Store `codeVerifier` in sessionStorage (not localStorage) to limit exposure
2. **Token Storage**: Store tokens in localStorage with CSP headers to mitigate XSS
3. **HTTPS Required**: OAuth redirect URI must use HTTPS in production
4. **Client ID**: Public and safe to commit to git (no secret required with PKCE)
5. **Token Refresh**: Implement automatic refresh 5 minutes before expiration

## Testing Strategy

### Unit Tests
- Mock `crypto.getRandomValues()` and `crypto.subtle.digest()`
- Mock `fetch()` for Discord API calls
- Test PKCE generation produces valid challenge
- Test OAuth URL construction with correct parameters
- Test token exchange with valid/invalid codes
- Test token refresh with valid/revoked tokens
- Test error handling for network failures

### Integration Tests
- Test full OAuth flow with Discord's staging environment (if available)
- Test token refresh with real Discord API
- Verify PKCE security (code verifier validation)

## Dependencies

- **Browser APIs**: `crypto.getRandomValues()`, `crypto.subtle.digest()`, `fetch()`
- **Discord API**: OAuth2 endpoints (`/oauth2/authorize`, `/oauth2/token`)
- **Types**: `discord-api-types` for Discord API response types

## Version History

- **1.0** (2025-10-21): Initial contract definition
