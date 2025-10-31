import { Route } from '@/routes/game.$gameId'

/**
 * Hook to get authenticated user data
 * 
 * Throws an error if called in a component that isn't protected by the route guard.
 * This ensures auth is always defined - use this hook instead of optional chaining.
 * 
 * @returns Guaranteed non-null auth object with userId and accessToken
 * @throws Error if auth is not available (component rendered without authentication)
 */
export function useAuth() {
  const { auth } = Route.useLoaderData()
  
  if (!auth) {
    throw new Error('useAuth called without authentication - component should be protected by route guard')
  }
  
  return auth
}
