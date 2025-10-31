import type {
  DiscordToken,
  DiscordUser,
  OAuthErrorResponse,
  PKCEChallenge,
} from '../types/auth.js'
import {
  DiscordTokenResponseSchema,
  DiscordTokenSchema,
  DiscordUserResponseSchema,
  DiscordUserSchema,
  OAuthErrorResponseSchema,
} from '../types/auth.js'

/**
 * Discord OAuth2 Client with PKCE (Proof Key for Code Exchange)
 * Implements RFC 7636 for secure client-side authentication
 *
 * Handles PKCE storage internally using configurable Storage provider
 * Storage must be provided in config (e.g., localStorage, sessionStorage)
 * NO React dependencies - pure Discord API logic
 */

export interface DiscordOAuthClientConfig {
  clientId: string
  redirectUri: string
  scopes: string[]
  storage: Storage // Storage provider for PKCE (e.g., localStorage, sessionStorage)
  pkceStorageKey?: string // Optional custom storage key (defaults to 'discord_pkce')
}

export class OAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public description?: string,
  ) {
    super(message)
    this.name = 'OAuthError'
  }
}

export class DiscordOAuthClient {
  private readonly clientId: string
  private readonly redirectUri: string
  private readonly scopes: string[]
  private readonly apiBase = 'https://discord.com/api/v10'
  private readonly pkceStorageKey: string
  private readonly storage: Storage

  constructor(config: DiscordOAuthClientConfig) {
    this.clientId = config.clientId
    this.redirectUri = config.redirectUri
    this.scopes = config.scopes
    this.storage = config.storage
    this.pkceStorageKey = config.pkceStorageKey || 'discord_pkce'
  }

  /**
   * Generate PKCE challenge and store it in localStorage
   * Uses crypto.subtle for SHA256 hashing (browser-native)
   *
   * @returns PKCE code_challenge to use in authorization URL
   */
  async generateAndStorePKCE(): Promise<string> {
    // Generate random code_verifier (43-128 characters)
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const codeVerifier = this.base64URLEncode(array)

    // Create code_challenge = Base64URL(SHA256(code_verifier))
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const codeChallenge = this.base64URLEncode(new Uint8Array(hash))

    const pkce: PKCEChallenge = {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    }

    // Store in storage provider
    this.storage.setItem(this.pkceStorageKey, JSON.stringify(pkce))

    return codeChallenge
  }

  /**
   * Generate PKCE challenge (without storing)
   * Uses crypto.subtle for SHA256 hashing (browser-native)
   *
   * @returns PKCE challenge with code_verifier and code_challenge
   * @deprecated Use generateAndStorePKCE() for OAuth flow
   */
  async generatePKCE(): Promise<PKCEChallenge> {
    // Generate random code_verifier (43-128 characters)
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const codeVerifier = this.base64URLEncode(array)

    // Create code_challenge = Base64URL(SHA256(code_verifier))
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const codeChallenge = this.base64URLEncode(new Uint8Array(hash))

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    }
  }

  /**
   * Retrieve and remove stored PKCE from storage
   *
   * @returns PKCE challenge or null if not found
   * @throws {OAuthError} if PKCE is not found or invalid
   */
  private retrieveAndClearPKCE(): PKCEChallenge {
    const pkceStr = this.storage.getItem(this.pkceStorageKey)
    if (!pkceStr) {
      throw new OAuthError(
        'PKCE challenge not found. Please try logging in again.',
        'pkce_not_found',
      )
    }

    try {
      const pkce = JSON.parse(pkceStr) as PKCEChallenge
      // Remove immediately (single-use)
      this.storage.removeItem(this.pkceStorageKey)
      return pkce
    } catch (err) {
      this.storage.removeItem(this.pkceStorageKey)
      const error = new OAuthError(
        'Invalid PKCE challenge format.',
        'pkce_invalid',
      )
      error.cause = err
      throw error
    }
  }

  /**
   * Clear stored PKCE from storage
   * Useful for cleanup on logout or error
   */
  clearStoredPKCE(): void {
    this.storage.removeItem(this.pkceStorageKey)
  }

  /**
   * Get Discord OAuth2 authorization URL
   *
   * @param codeChallenge PKCE code challenge from generatePKCE()
   * @param state Optional state parameter for CSRF protection and custom data passing
   * @returns Authorization URL to redirect user to
   */
  getAuthUrl(codeChallenge: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    if (state) {
      params.append('state', state)
    }

    return `https://discord.com/oauth2/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   * Automatically retrieves PKCE from localStorage
   *
   * @param code Authorization code from OAuth callback
   * @param codeVerifier Optional PKCE code verifier (if not using stored PKCE)
   * @returns Discord token with access_token, refresh_token, expires_at
   * @throws {OAuthError} if exchange fails
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier?: string,
  ): Promise<DiscordToken> {
    // Use provided codeVerifier or retrieve from storage
    const verifier = codeVerifier || this.retrieveAndClearPKCE().codeVerifier

    const params = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: verifier,
    })

    const response = await fetch(`${this.apiBase}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await this.parseOAuthError(response)
      throw new OAuthError(
        `Token exchange failed: ${error.error}`,
        error.error,
        error.error_description,
      )
    }

    const rawData = await response.json()

    // Validate Discord API response with Zod
    const data = DiscordTokenResponseSchema.parse(rawData)

    // Transform Discord API response to our schema
    const token: DiscordToken = {
      version: '1.0',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      scopes: data.scope.split(' '),
      tokenType: data.token_type,
    }

    // Validate transformed token with Zod
    return DiscordTokenSchema.parse(token)
  }

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken Refresh token from previous token exchange
   * @returns New Discord token
   * @throws {OAuthError} if refresh fails
   */
  async refreshToken(refreshToken: string): Promise<DiscordToken> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })

    const response = await fetch(`${this.apiBase}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await this.parseOAuthError(response)
      throw new OAuthError(
        `Token refresh failed: ${error.error}`,
        error.error,
        error.error_description,
      )
    }

    const rawData = await response.json()

    // Validate Discord API response with Zod
    const data = DiscordTokenResponseSchema.parse(rawData)

    const token: DiscordToken = {
      version: '1.0',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      scopes: data.scope.split(' '),
      tokenType: data.token_type,
    }

    return DiscordTokenSchema.parse(token)
  }

  /**
   * Fetch authenticated user's Discord profile
   *
   * @param accessToken Access token from token exchange
   * @returns Discord user profile
   * @throws {OAuthError} if fetch fails
   */
  async fetchUser(accessToken: string): Promise<DiscordUser> {
    const response = await fetch(`${this.apiBase}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await this.parseOAuthError(response)
      throw new OAuthError(
        `Failed to fetch user: ${error.error}`,
        error.error,
        error.error_description,
      )
    }

    const rawData = await response.json()

    // Validate Discord API response with Zod
    const data = DiscordUserResponseSchema.parse(rawData)

    // Transform Discord API response to our schema
    const user: DiscordUser = {
      version: '1.0',
      id: data.id,
      username: data.username,
      discriminator: data.discriminator,
      avatar: data.avatar,
      avatarUrl: this.getAvatarUrl(data.id, data.avatar),
      bot: data.bot,
      system: data.system,
      flags: data.flags,
    }

    return DiscordUserSchema.parse(user)
  }

  /**
   * Revoke access token (logout)
   *
   * ⚠️ IMPORTANT: Discord's token revocation endpoint requires client_secret,
   * which cannot be safely stored in browser-side PKCE flows.
   *
   * This method will fail with 401 Unauthorized when called from the browser.
   * For proper token revocation in PKCE flows, you should:
   * 1. Create a server-side endpoint (e.g., POST /api/auth/revoke)
   * 2. Store DISCORD_CLIENT_SECRET securely on the server
   * 3. Have the browser call your server endpoint
   * 4. Your server calls Discord's revoke endpoint with the secret
   *
   * Alternatively, tokens expire naturally after 7 days, so clearing local
   * storage is often sufficient for logout functionality.
   *
   * @param accessToken Access token to revoke
   * @throws {OAuthError} if revocation fails (expected in browser PKCE flows)
   */
  async revokeToken(accessToken: string): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      token: accessToken,
      // Note: client_secret is required by Discord but cannot be included
      // in browser-side code. This will result in 401 Unauthorized.
    })

    const response = await fetch(`${this.apiBase}/oauth2/token/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await this.parseOAuthError(response)
      throw new OAuthError(
        `Token revocation failed: ${error.error}`,
        error.error,
        error.error_description,
      )
    }
  }

  /**
   * Base64URL encode (RFC 4648)
   * @private
   */
  private base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer))
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  /**
   * Parse OAuth error response
   * @private
   */
  private async parseOAuthError(
    response: Response,
  ): Promise<OAuthErrorResponse> {
    try {
      const data = await response.json()
      return OAuthErrorResponseSchema.parse(data)
    } catch {
      return {
        error: 'unknown_error',
        error_description: `HTTP ${response.status}: ${response.statusText}`,
      }
    }
  }

  /**
   * Get Discord CDN avatar URL
   * @private
   */
  private getAvatarUrl(
    userId: string,
    avatar: string | null,
    size = 128,
  ): string | undefined {
    if (!avatar) return undefined

    const extension = avatar.startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=${size}`
  }
}
