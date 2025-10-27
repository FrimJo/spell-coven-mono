import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { DiscordToken } from '@repo/discord-integration/types'

import { TOKEN_REFRESH_BUFFER_MS } from '../config/discord'
import {
  clearStoredDiscordToken,
  ensureValidDiscordToken,
  getDiscordClient,
  refreshDiscordToken,
} from '../lib/discord-client'

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

export interface UseDiscordAuthReturn {
  token: DiscordToken | null
  isAuthenticated: boolean
  isLoading: boolean
  error: Error | null
  login: () => Promise<void>
  logout: () => Promise<void>
}

export function useDiscordAuth(): UseDiscordAuthReturn {
  const [token, setToken] = useState<DiscordToken | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const refreshTimerRef = useRef<number | null>(null)

  // Silent token refresh
  const refreshTokenSilently = useCallback(async (refreshToken: string) => {
    try {
      const newToken = await refreshDiscordToken(refreshToken)
      setToken(newToken)
      setError(null)
    } catch (err) {
      console.error('Token refresh failed:', err)
      setError(err as Error)
      // Clear invalid token
      setToken(null)
      clearStoredDiscordToken()
    }
  }, [])

  // Load token from localStorage on mount
  useEffect(() => {
    let cancelled = false

    const loadToken = async () => {
      try {
        const existing = await ensureValidDiscordToken()
        if (!cancelled) {
          setToken(existing)
        }
      } catch (err) {
        console.error('Failed to load Discord token:', err)
        if (!cancelled) {
          clearStoredDiscordToken()
          setToken(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadToken()

    return () => {
      cancelled = true
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  // Setup automatic token refresh
  useEffect(() => {
    if (!token) return

    const scheduleRefresh = () => {
      const timeUntilRefresh =
        token.expiresAt - Date.now() - TOKEN_REFRESH_BUFFER_MS

      if (timeUntilRefresh <= 0) {
        // Token needs immediate refresh
        refreshTokenSilently(token.refreshToken)
        return
      }

      // Schedule refresh
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTokenSilently(token.refreshToken)
      }, timeUntilRefresh)
    }

    scheduleRefresh()

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [token, refreshTokenSilently])

  // Login: Generate PKCE and redirect to Discord
  const login = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const client = getDiscordClient()
      // Generate PKCE and store it (client handles storage)
      const codeChallenge = await client.generateAndStorePKCE()

      // Redirect to Discord OAuth
      const authUrl = client.getAuthUrl(codeChallenge)
      window.location.href = authUrl
    } catch (err) {
      console.error('Login failed:', err)
      setError(err as Error)
      setIsLoading(false)
    }
  }, [])

  // Logout: Revoke token and clear storage
  const logout = useCallback(async () => {
    try {
      setIsLoading(true)

      if (token) {
        // Revoke token on Discord's side
        await getDiscordClient().revokeToken(token.accessToken)
      }

      // Clear local state
      setToken(null)
      clearStoredDiscordToken()
      getDiscordClient().clearStoredPKCE()
      setError(null)
    } catch (err) {
      console.error('Logout failed:', err)
      // Still clear local state even if revocation fails
      setToken(null)
      clearStoredDiscordToken()
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  return useMemo(
    () => ({
      token,
      isAuthenticated: !!token,
      isLoading,
      error,
      login,
      logout,
    }),
    [error, isLoading, login, logout, token],
  )
}
