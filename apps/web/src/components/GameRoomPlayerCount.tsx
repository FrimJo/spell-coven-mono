import { Suspense } from 'react'
import { useVoiceChannelMembersFromEvents } from '@/hooks/useVoiceChannelMembersFromEvents'
import { Loader2, Users } from 'lucide-react'

interface GameRoomPlayerCountProps {
  roomId: string
  userId: string
}

function PlayerCountContent({ roomId, userId }: GameRoomPlayerCountProps) {
  const { members: voiceChannelMembers } = useVoiceChannelMembersFromEvents({
    gameId: roomId,
    userId: userId,
  })

  return (
    <div className="flex items-center gap-2 text-slate-400">
      <Users className="h-4 w-4" />
      <span className="text-sm">{voiceChannelMembers.length}/4 Players</span>
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
