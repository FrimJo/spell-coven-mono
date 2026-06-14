import type { RoomMediaSessionState } from '@/types/media-session'
import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { usePresence } from '@/contexts/PresenceContext'
import { useMediaDiagnostics } from '@/hooks/useMediaDiagnostics'
import { useRoomMediaSession } from '@/hooks/useRoomMediaSession'

const RoomMediaContext = createContext<RoomMediaSessionState | null>(null)

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

  useMediaDiagnostics(mediaSession)

  return (
    <RoomMediaContext.Provider value={mediaSession}>
      {children}
    </RoomMediaContext.Provider>
  )
}

export function useRoomMedia(): RoomMediaSessionState {
  const context = useContext(RoomMediaContext)
  if (!context) {
    throw new Error('useRoomMedia must be used within a RoomMediaProvider')
  }
  return context
}
