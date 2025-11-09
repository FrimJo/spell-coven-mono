import type { DetectorType } from '@/lib/detectors'
import type { PeerConnectionState } from '@/lib/webrtc/types'
import { Suspense } from 'react'
import { useVoiceChannelMembersFromEvents } from '@/hooks/useVoiceChannelMembersFromEvents'
import { Loader2 } from 'lucide-react'

import { VideoStreamGrid } from './VideoStreamGrid'

interface GameRoomVideoGridProps {
  roomId: string
  userId: string
  playerName: string
  detectorType?: DetectorType
  usePerspectiveWarp: boolean
  onCardCrop: (canvas: HTMLCanvasElement) => void
  remoteStreams: Map<string, MediaStream | null>
  connectionStates: Map<string, PeerConnectionState>
  onLocalVideoStart: () => Promise<void>
  onLocalVideoStop: () => void
}

function VideoGridContent({
  roomId,
  userId,
  playerName,
  detectorType,
  usePerspectiveWarp,
  onCardCrop,
  remoteStreams,
  connectionStates,
  onLocalVideoStart,
  onLocalVideoStop,
}: GameRoomVideoGridProps) {
  const { members: voiceChannelMembers } = useVoiceChannelMembersFromEvents({
    gameId: roomId,
    userId: userId,
  })

  return (
    <VideoStreamGrid
      players={voiceChannelMembers.map((member) => ({
        id: member.id,
        name: member.username,
      }))}
      localPlayerName={playerName}
      enableCardDetection={true}
      detectorType={detectorType}
      usePerspectiveWarp={usePerspectiveWarp}
      onCardCrop={onCardCrop}
      remoteStreams={remoteStreams}
      connectionStates={connectionStates}
      onLocalVideoStart={onLocalVideoStart}
      onLocalVideoStop={onLocalVideoStop}
    />
  )
}

function VideoGridLoading() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50">
      <div className="flex flex-col items-center space-y-3">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
          <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/10" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-slate-200">
            Loading Video Streams
          </p>
          <p className="text-xs text-slate-400">Connecting to players...</p>
        </div>
      </div>
    </div>
  )
}

export function GameRoomVideoGrid(props: GameRoomVideoGridProps) {
  return (
    <Suspense fallback={<VideoGridLoading />}>
      <VideoGridContent {...props} />
    </Suspense>
  )
}
