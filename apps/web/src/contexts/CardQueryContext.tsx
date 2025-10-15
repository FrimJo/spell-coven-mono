import type { UseCardQueryReturn } from '@/types/card-query'
import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { useCardQuery } from '@/hooks/useCardQuery'

const CardQueryContext = createContext<UseCardQueryReturn | null>(null)

export function CardQueryProvider({ children }: { children: ReactNode }) {
  const cardQuery = useCardQuery()

  return (
    <CardQueryContext.Provider value={cardQuery}>
      {children}
    </CardQueryContext.Provider>
  )
}

export function useCardQueryContext() {
  const context = useContext(CardQueryContext)
  if (!context) {
    throw new Error('useCardQueryContext must be used within CardQueryProvider')
  }
  return context
}
