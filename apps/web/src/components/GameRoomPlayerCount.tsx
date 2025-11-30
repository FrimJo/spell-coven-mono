import { Suspense } from 'react'
import { useSupabasePresence } from '@/hooks/useSupabasePresence'
import { getTempUser } from '@/lib/temp-user'
import { Loader2, Users } from 'lucide-react'

interface GameRoomPlayerCountProps {
  roomId: string
  maxPlayers?: number
  currentCount?: number
}

function PlayerCountContent({
  roomId,
  maxPlayers = 4,
  currentCount: providedCount,
}: GameRoomPlayerCountProps) {
  // Get user info for presence (shares store with other components)
  const tempUser = getTempUser()

  const { participants } = useSupabasePresence({
    roomId,
    userId: tempUser.id,
    username: tempUser.username,
  })

  const currentCount = providedCount ?? participants.length

  return (
    <div className="flex items-center gap-2 text-slate-400">
      <Users className="h-4 w-4" />
      <span className="text-sm">
        {currentCount}/{maxPlayers} Players
      </span>
    </div>
  )
}

function PlayerCountLoading() {
  return (
    <div className="flex items-center gap-2 text-slate-400">
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
