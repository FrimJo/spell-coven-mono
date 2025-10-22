import { useState, useEffect, useCallback, useRef } from 'react';
import { DiscordOAuthClient, type DiscordToken, type PKCEChallenge } from '@repo/discord-integration';
import { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI, DISCORD_SCOPES, TOKEN_REFRESH_BUFFER_MS } from '../config/discord';
import { isTokenExpired } from '@repo/discord-integration';

/**
 * Discord Authentication Hook
 * Bridge layer between DiscordOAuthClient and React UI
 *
 * Responsibilities:
 * - Manages OAuth flow (PKCE generation, token exchange)
 * - Stores tokens in localStorage
 * - Automatic token refresh (5 min buffer)
 * - Logout functionality
 */

const STORAGE_KEY = 'discord_token';
const PKCE_STORAGE_KEY = 'discord_pkce';

export interface UseDiscordAuthReturn {
  token: DiscordToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  handleCallback: (code: string) => Promise<void>;
}

export function useDiscordAuth(): UseDiscordAuthReturn {
  const [token, setToken] = useState<DiscordToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<DiscordOAuthClient | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  // Initialize OAuth client
  if (!clientRef.current) {
    clientRef.current = new DiscordOAuthClient({
      clientId: DISCORD_CLIENT_ID,
      redirectUri: DISCORD_REDIRECT_URI,
      scopes: DISCORD_SCOPES,
    });
  }

  const client = clientRef.current;

  // Load token from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedToken = JSON.parse(stored) as DiscordToken;

        // Check if token is expired
        if (isTokenExpired(parsedToken, 0)) {
          // Token expired, try to refresh
          refreshTokenSilently(parsedToken.refreshToken);
        } else {
          setToken(parsedToken);
        }
      }
    } catch (err) {
      console.error('Failed to load token from localStorage:', err);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Setup automatic token refresh
  useEffect(() => {
    if (!token) return;

    const scheduleRefresh = () => {
      const timeUntilRefresh = token.expiresAt - Date.now() - TOKEN_REFRESH_BUFFER_MS;

      if (timeUntilRefresh <= 0) {
        // Token needs immediate refresh
        refreshTokenSilently(token.refreshToken);
        return;
      }

      // Schedule refresh
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTokenSilently(token.refreshToken);
      }, timeUntilRefresh);
    };

    scheduleRefresh();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [token]);

  // Silent token refresh
  const refreshTokenSilently = async (refreshToken: string) => {
    try {
      const newToken = await client.refreshToken(refreshToken);
      setToken(newToken);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newToken));
      setError(null);
    } catch (err) {
      console.error('Token refresh failed:', err);
      setError(err as Error);
      // Clear invalid token
      setToken(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Login: Generate PKCE and redirect to Discord
  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Generate PKCE challenge
      const pkce: PKCEChallenge = await client.generatePKCE();

      // Store code_verifier for callback
      sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(pkce));

      // Redirect to Discord OAuth
      const authUrl = client.getAuthUrl(pkce.codeChallenge);
      window.location.href = authUrl;
    } catch (err) {
      console.error('Login failed:', err);
      setError(err as Error);
      setIsLoading(false);
    }
  }, [client]);

  // Handle OAuth callback
  const handleCallback = useCallback(
    async (code: string) => {
      try {
        setIsLoading(true);
        setError(null);

        // Retrieve PKCE from sessionStorage
        const pkceStr = sessionStorage.getItem(PKCE_STORAGE_KEY);
        if (!pkceStr) {
          throw new Error('PKCE challenge not found. Please try logging in again.');
        }

        const pkce = JSON.parse(pkceStr) as PKCEChallenge;
        sessionStorage.removeItem(PKCE_STORAGE_KEY);

        // Exchange code for token
        const newToken = await client.exchangeCodeForToken(code, pkce.codeVerifier);

        // Store token
        setToken(newToken);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newToken));
      } catch (err) {
        console.error('OAuth callback failed:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  // Logout: Revoke token and clear storage
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);

      if (token) {
        // Revoke token on Discord's side
        await client.revokeToken(token.accessToken);
      }

      // Clear local state
      setToken(null);
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(PKCE_STORAGE_KEY);
      setError(null);
    } catch (err) {
      console.error('Logout failed:', err);
      // Still clear local state even if revocation fails
      setToken(null);
      localStorage.removeItem(STORAGE_KEY);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, token]);

  return {
    token,
    isAuthenticated: !!token,
    isLoading,
    error,
    login,
    logout,
    handleCallback,
  };
}
