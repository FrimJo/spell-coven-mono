import { useState, useEffect } from 'react';
import { DiscordOAuthClient, type DiscordUser } from '@repo/discord-integration';
import { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI, DISCORD_SCOPES } from '../config/discord';
import { useDiscordAuth } from './useDiscordAuth';

/**
 * Discord User Hook
 * Fetches and caches authenticated user's Discord profile
 */

export interface UseDiscordUserReturn {
  user: DiscordUser | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useDiscordUser(): UseDiscordUserReturn {
  const { token, isAuthenticated } = useDiscordAuth();
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      setError(null);

      const client = new DiscordOAuthClient({
        clientId: DISCORD_CLIENT_ID,
        redirectUri: DISCORD_REDIRECT_URI,
        scopes: DISCORD_SCOPES,
      });

      const fetchedUser = await client.fetchUser(token.accessToken);
      setUser(fetchedUser);
    } catch (err) {
      console.error('Failed to fetch Discord user:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user when authenticated
  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUser();
    } else if (!isAuthenticated) {
      setUser(null);
    }
  }, [isAuthenticated, token]);

  return {
    user,
    isLoading,
    error,
    refetch: fetchUser,
  };
}
