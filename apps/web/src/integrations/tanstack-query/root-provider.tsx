import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

interface ProviderProps {
  children: ReactNode
  queryClient: QueryClient
}

export function Provider({ children, queryClient }: ProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
