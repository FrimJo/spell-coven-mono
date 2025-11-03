import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import type { DiscordToken } from '@repo/discord-integration/types'

import { TOKEN_REFRESH_BUFFER_MS } from '../config/discord.js'
import {
  clearStoredDiscordToken,
  ensureValidDiscordToken,
  getDiscordClient,
  refreshDiscordToken,
} from '../lib/discord-client.js'
import { revokeDiscordToken } from '../server/discord-auth.server.js'

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

export const discordTokenQueryOptions = queryOptions({
  queryKey: ['discordToken'],
  queryFn: async () => {
    try {
      const existing = await ensureValidDiscordToken()
      return existing
    } catch (err) {
      console.error('Failed to load Discord token:', err)
      clearStoredDiscordToken()
      return null
    }
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
  gcTime: 1000 * 60 * 10, // 10 minutes
  retry: false, // Don't retry if token is invalid
})

export interface UseDiscordAuthReturn {
  token: DiscordToken | null
  isAuthenticated: boolean
  isLoading: boolean
  error: Error | null
  login: (returnUrl?: string) => Promise<void>
  logout: () => Promise<void>
}

export function useDiscordAuth(): UseDiscordAuthReturn {
  const queryClient = useQueryClient()
  const refreshTimerRef = useRef<number | null>(null)
  const navigate = useNavigate()

  // Use TanStack Query to load and cache the Discord token
  const { data: token, isLoading, error } = useQuery(discordTokenQueryOptions)

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
      return authUrl
    },
    onSuccess: (authUrl) => {
      navigate({ href: authUrl, reloadDocument: true })
    },
    onError: (err) => {
      console.error('Login failed:', err)
    },
  })

  const { mutateAsync: loginAsync } = loginMutation

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
      // Clear query cache and local storage
      queryClient.setQueryData(['discordToken'], null)
      clearStoredDiscordToken()
      getDiscordClient().clearStoredPKCE()
    },
    onError: (err) => {
      console.error('Logout failed:', err)
      // Still clear local state even if revocation fails
      queryClient.setQueryData(['discordToken'], null)
      clearStoredDiscordToken()
    },
  })

  const { mutateAsync: logoutAsync } = logoutMutation

  // Silent token refresh
  const refreshTokenSilently = useCallback(
    async (refreshToken: string) => {
      try {
        const newToken = await refreshDiscordToken(refreshToken)
        queryClient.setQueryData(['discordToken'], newToken)
      } catch (err) {
        console.error('Token refresh failed:', err)
        // Clear invalid token
        queryClient.setQueryData(['discordToken'], null)
        clearStoredDiscordToken()
      }
    },
    [queryClient],
  )

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
      await loginAsync(returnUrl)
    },
    [loginAsync],
  )

  // Logout: Revoke token and clear storage
  const logout = useCallback(async () => {
    await logoutAsync()
  }, [logoutAsync])

  return useMemo(
    () => ({
      token: token ?? null,
      isAuthenticated: !!token,
      isLoading:
        isLoading || loginMutation.isPending || logoutMutation.isPending,
      error: error || loginMutation.error || logoutMutation.error,
      login,
      logout,
    }),
    [
      error,
      isLoading,
      login,
      logout,
      token,
      loginMutation.isPending,
      loginMutation.error,
      logoutMutation.isPending,
      logoutMutation.error,
    ],
  )
}
