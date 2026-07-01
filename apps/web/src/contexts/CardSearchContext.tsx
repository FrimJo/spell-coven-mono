import type { UseCardSearchHistoryReturn } from '@/types/card-search'
import type { ReactNode } from 'react'
import { createContext, use } from 'react'
import { useCardSearchHistory } from '@/hooks/useCardSearchHistory'

const CardSearchContext = createContext<UseCardSearchHistoryReturn | null>(null)

function CardSearchProviderState({
  children,
  roomId,
}: {
  children: ReactNode
  roomId: string
}) {
  const value = useCardSearchHistory(roomId)

  return (
    <CardSearchContext.Provider value={value}>
      {children}
    </CardSearchContext.Provider>
  )
}

export function CardSearchProvider({
  children,
  roomId,
}: {
  children: ReactNode
  roomId: string
}) {
  return (
    <CardSearchProviderState key={roomId} roomId={roomId}>
      {children}
    </CardSearchProviderState>
  )
}

export function useCardSearchContext() {
  const context = use(CardSearchContext)
  if (!context) {
    throw new Error(
      'useCardSearchContext must be used within CardSearchProvider',
    )
  }
  return context
}
