import { queryOptions, useQuery } from '@tanstack/react-query'

import type { DiscordUser } from '@repo/discord-integration/types'

import { getDiscordClient } from '../lib/discord-client.js'
import { useDiscordAuth } from './useDiscordAuth.js'

/**
 * Discord User Hook
 * Fetches and caches authenticated user's Discord profile
 * Returns null while loading or if not authenticated
 */

export interface UseDiscordUserReturn {
  user: DiscordUser | null
  isLoading: boolean
  error: Error | null
}

export const discordUserQueryOptions = (accessToken?: string) =>
  queryOptions({
    queryKey: ['discordUser', accessToken],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No token available')
      }
      const fetchedUser = await getDiscordClient().fetchUser(accessToken)
      return fetchedUser
    },
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
  })

export function useDiscordUser(): UseDiscordUserReturn {
  const { token } = useDiscordAuth()

  const {
    data: user,
    isLoading,
    error,
  } = useQuery(discordUserQueryOptions(token?.accessToken))

  return {
    user: user ?? null,
    isLoading,
    error: error,
  }
}
