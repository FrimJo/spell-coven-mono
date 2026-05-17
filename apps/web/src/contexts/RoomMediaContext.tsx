import type { RoomMediaContextValue } from '@/types/media-session'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect } from 'react'
import { usePresence } from '@/contexts/PresenceContext'
import { useRoomMediaSession } from '@/hooks/useRoomMediaSession'

const RoomMediaContext = createContext<RoomMediaContextValue | null>(null)

interface RoomMediaProviderProps {
  roomId: string
  children: ReactNode
}

export function RoomMediaProvider({
  roomId,
  children,
}: RoomMediaProviderProps) {
  const { sessionId, isConnected, isLoading } = usePresence()
  const mediaSession = useRoomMediaSession({
    roomId,
    sessionId,
    enabled: isConnected && !isLoading && !!sessionId,
  })

  useEffect(() => {
    ;(
      window as unknown as {
        __spellCovenMediaDiagnostics?: RoomMediaContextValue['diagnostics']
      }
    ).__spellCovenMediaDiagnostics = mediaSession.diagnostics
  }, [mediaSession.diagnostics])

  return (
    <RoomMediaContext.Provider value={mediaSession}>
      {children}
    </RoomMediaContext.Provider>
  )
}

export function useRoomMedia(): RoomMediaContextValue {
  const context = useContext(RoomMediaContext)
  if (!context) {
    throw new Error('useRoomMedia must be used within a RoomMediaProvider')
  }
  return context
}
