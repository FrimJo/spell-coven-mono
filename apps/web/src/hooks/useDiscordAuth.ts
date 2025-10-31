import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { DiscordToken } from '@repo/discord-integration/types'
import { useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'

import { TOKEN_REFRESH_BUFFER_MS } from '../config/discord'
import {
  clearStoredDiscordToken,
  ensureValidDiscordToken,
  getDiscordClient,
  refreshDiscordToken,
} from '../lib/discord-client'
import { revokeDiscordToken } from '../server/discord-auth'

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
  login: (returnUrl?: string) => Promise<void>
  logout: () => Promise<void>
}

export function useDiscordAuth(): UseDiscordAuthReturn {
  const [token, setToken] = useState<DiscordToken | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const refreshTimerRef = useRef<number | null>(null)
  
  // Server function for token revocation
  const revokeTokenFn = useServerFn(revokeDiscordToken)
  
  // Mutation for token revocation
  const revokeTokenMutation = useMutation({
    mutationFn: revokeTokenFn,
    onError: (err) => {
      console.warn('Token revocation failed:', err)
      // Continue with logout - token will expire naturally
    },
  })

  // Mutation for login
  const loginMutation = useMutation({
    mutationFn: async (returnUrl?: string) => {
      const client = getDiscordClient()
      // Generate PKCE and store it (client handles storage)
      const codeChallenge = await client.generateAndStorePKCE()

      // Encode returnUrl as state parameter for OAuth2 flow
      const state = returnUrl ? btoa(returnUrl) : undefined

      // Redirect to Discord OAuth with state parameter
      const authUrl = client.getAuthUrl(codeChallenge, state)
      window.location.href = authUrl
    },
    onError: (err) => {
      console.error('Login failed:', err)
    },
  })

  // Mutation for logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (token) {
        // Revoke token via server function mutation
        // This safely uses client_secret stored on the server
        await revokeTokenMutation.mutateAsync({
          data: {
            token: token.accessToken,
            token_type_hint: 'access_token',
          },
        })
      }
    },
    onSuccess: () => {
      // Clear local state
      setToken(null)
      clearStoredDiscordToken()
      getDiscordClient().clearStoredPKCE()
      setError(null)
    },
    onError: (err) => {
      console.error('Logout failed:', err)
      // Still clear local state even if revocation fails
      setToken(null)
      clearStoredDiscordToken()
      setError(err as Error)
    },
  })

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
  const login = useCallback(
    async (returnUrl?: string) => {
      setError(null)
      await loginMutation.mutateAsync(returnUrl)
    },
    [loginMutation],
  )

  // Logout: Revoke token and clear storage
  const logout = useCallback(async () => {
    setError(null)
    await logoutMutation.mutateAsync()
  }, [logoutMutation])

  return useMemo(
    () => ({
      token,
      isAuthenticated: !!token,
      isLoading: isLoading || loginMutation.isPending || logoutMutation.isPending,
      error: error || loginMutation.error || logoutMutation.error,
      login,
      logout,
    }),
    [error, isLoading, login, logout, token, loginMutation.isPending, loginMutation.error, logoutMutation.isPending, logoutMutation.error],
  )
}
