import { Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSupabasePresence } from '@/hooks/useSupabasePresence'
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
  // Get user info from auth context
  const { user } = useAuth()

  const { participants } = useSupabasePresence({
    roomId,
    userId: user?.id ?? '',
    username: user?.username ?? 'Unknown',
    avatar: user?.avatar,
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
