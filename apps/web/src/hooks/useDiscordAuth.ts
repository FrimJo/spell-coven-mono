import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { DiscordToken } from '@repo/discord-integration/types'
import { DiscordTokenSchema } from '@repo/discord-integration/types'
import { isTokenExpired } from '@repo/discord-integration/utils'

import { TOKEN_REFRESH_BUFFER_MS } from '../config/discord'
import { getDiscordClient, STORAGE_KEY } from '../lib/discord-client'

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
      const newToken = await getDiscordClient().refreshToken(refreshToken)
      setToken(newToken)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newToken))
      setError(null)
    } catch (err) {
      console.error('Token refresh failed:', err)
      setError(err as Error)
      // Clear invalid token
      setToken(null)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Load token from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsedToken = DiscordTokenSchema.parse(JSON.parse(stored))

        // Check if token is expired
        if (isTokenExpired(parsedToken, 0)) {
          // Token expired, try to refresh
          refreshTokenSilently(parsedToken.refreshToken)
        } else {
          setToken(parsedToken)
        }
      }
    } catch (err) {
      console.error('Failed to load token from localStorage:', err)
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      setIsLoading(false)
    }
  }, [refreshTokenSilently])

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

      const client = getDiscordClient()
      if (token) {
        // Revoke token on Discord's side
        await client.revokeToken(token.accessToken)
      }

      // Clear local state
      setToken(null)
      localStorage.removeItem(STORAGE_KEY)
      client.clearStoredPKCE()
      setError(null)
    } catch (err) {
      console.error('Logout failed:', err)
      // Still clear local state even if revocation fails
      setToken(null)
      localStorage.removeItem(STORAGE_KEY)
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
