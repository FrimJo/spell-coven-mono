import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { generateWebSocketAuthToken } from '@/server/ws-auth'

interface UseWebSocketAuthTokenOptions {
  userId?: string
}

export function useWebSocketAuthToken({ userId }: UseWebSocketAuthTokenOptions = {}) {
  const generateWsTokenFn = useServerFn(generateWebSocketAuthToken)

  return useQuery({
    queryKey: ['wsToken', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required to generate WebSocket token')
      const result = await generateWsTokenFn({ data: { userId } })
      return result.token
    },
    enabled: !!userId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
  })
}
