import { Suspense } from 'react'
import { usePresence } from '@/contexts/PresenceContext'
import { Loader2, Users } from 'lucide-react'

interface GameRoomPlayerCountProps {
  roomId: string
  maxPlayers?: number
  currentCount?: number
}

function PlayerCountContent({
  maxPlayers = 4,
  currentCount: providedCount,
}: GameRoomPlayerCountProps) {
  // Use uniqueParticipants from context to count unique users (not duplicate sessions)
  const { uniqueParticipants } = usePresence()

  const currentCount = providedCount ?? uniqueParticipants.length

  return (
    <div className="flex items-center gap-2 text-muted">
      <Users className="h-4 w-4" />
      <span className="text-sm">
        {currentCount}/{maxPlayers} Players
      </span>
    </div>
  )
}

function PlayerCountLoading() {
  return (
    <div className="flex items-center gap-2 text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Loading...</span>
    </div>
  )
}

export function GameRoomPlayerCount(props: GameRoomPlayerCountProps) {
  return (
    <Suspense fallback={<PlayerCountLoading />}>
      <PlayerCountContent {...props} />
    </Suspense>
  )
}
