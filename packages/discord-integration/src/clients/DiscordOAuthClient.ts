import type { DiscordToken, DiscordUser, PKCEChallenge } from '../types/auth.js';
import { DiscordTokenSchema, DiscordUserSchema, OAuthErrorSchema } from '../types/auth.js';

/**
 * Discord OAuth2 Client with PKCE (Proof Key for Code Exchange)
 * Implements RFC 7636 for secure client-side authentication
 *
 * NO localStorage access - returns tokens to caller
 * NO React dependencies - pure Discord API logic
 */

export interface DiscordOAuthClientConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export class OAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public description?: string,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export class DiscordOAuthClient {
  private readonly clientId: string;
  private readonly redirectUri: string;
  private readonly scopes: string[];
  private readonly apiBase = 'https://discord.com/api/v10';

  constructor(config: DiscordOAuthClientConfig) {
    this.clientId = config.clientId;
    this.redirectUri = config.redirectUri;
    this.scopes = config.scopes;
  }

  /**
   * Generate PKCE challenge for OAuth2 flow
   * Uses crypto.subtle for SHA256 hashing (browser-native)
   *
   * @returns PKCE challenge with code_verifier and code_challenge
   */
  async generatePKCE(): Promise<PKCEChallenge> {
    // Generate random code_verifier (43-128 characters)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = this.base64URLEncode(array);

    // Create code_challenge = Base64URL(SHA256(code_verifier))
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const codeChallenge = this.base64URLEncode(new Uint8Array(hash));

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    };
  }

  /**
   * Get Discord OAuth2 authorization URL
   *
   * @param codeChallenge PKCE code challenge from generatePKCE()
   * @returns Authorization URL to redirect user to
   */
  getAuthUrl(codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   *
   * @param code Authorization code from OAuth callback
   * @param codeVerifier PKCE code verifier from generatePKCE()
   * @returns Discord token with access_token, refresh_token, expires_at
   * @throws {OAuthError} if exchange fails
   */
  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<DiscordToken> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch(`${this.apiBase}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await this.parseOAuthError(response);
      throw new OAuthError(`Token exchange failed: ${error.error}`, error.error, error.error_description);
    }

    const data = await response.json();

    // Transform Discord API response to our schema
    const token: DiscordToken = {
      version: '1.0',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      scopes: data.scope.split(' '),
      tokenType: 'Bearer',
    };

    // Validate with Zod
    return DiscordTokenSchema.parse(token);
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
    });

    const response = await fetch(`${this.apiBase}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await this.parseOAuthError(response);
      throw new OAuthError(`Token refresh failed: ${error.error}`, error.error, error.error_description);
    }

    const data = await response.json();

    const token: DiscordToken = {
      version: '1.0',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      scopes: data.scope.split(' '),
      tokenType: 'Bearer',
    };

    return DiscordTokenSchema.parse(token);
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
    });

    if (!response.ok) {
      const error = await this.parseOAuthError(response);
      throw new OAuthError(`Failed to fetch user: ${error.error}`, error.error, error.error_description);
    }

    const data = await response.json();

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
    };

    return DiscordUserSchema.parse(user);
  }

  /**
   * Revoke access token (logout)
   *
   * @param accessToken Access token to revoke
   * @throws {OAuthError} if revocation fails
   */
  async revokeToken(accessToken: string): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      token: accessToken,
    });

    const response = await fetch(`${this.apiBase}/oauth2/token/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await this.parseOAuthError(response);
      throw new OAuthError(`Token revocation failed: ${error.error}`, error.error, error.error_description);
    }
  }

  /**
   * Base64URL encode (RFC 4648)
   * @private
   */
  private base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Parse OAuth error response
   * @private
   */
  private async parseOAuthError(response: Response): Promise<{ error: string; error_description?: string }> {
    try {
      const data = await response.json();
      return OAuthErrorSchema.parse(data);
    } catch {
      return {
        error: 'unknown_error',
        error_description: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  }

  /**
   * Get Discord CDN avatar URL
   * @private
   */
  private getAvatarUrl(userId: string, avatar: string | null, size = 128): string | undefined {
    if (!avatar) return undefined;

    const extension = avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=${size}`;
  }
}
