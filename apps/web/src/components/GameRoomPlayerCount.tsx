import { Suspense } from 'react'
import { useGameRoomParticipants } from '@/hooks/useGameRoomParticipants'
import { getTempUser } from '@/lib/temp-user'
import { Loader2, Users } from 'lucide-react'

interface GameRoomPlayerCountProps {
  roomId: string
  userId: string
}

function PlayerCountContent({ roomId, userId }: GameRoomPlayerCountProps) {
  // Get current user info for username
  const tempUser = getTempUser()
  const username = tempUser.username

  // Get game room participants (replaces Discord voice channel members)
  const { participants } = useGameRoomParticipants({
    roomId,
    userId,
    username,
    enabled: true,
  })

  return (
    <div className="flex items-center gap-2 text-slate-400">
      <Users className="h-4 w-4" />
      <span className="text-sm">{participants.length}/4 Players</span>
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
