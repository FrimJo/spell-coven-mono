import type { DetectorType } from '@/lib/detectors'
import type { ConnectionState, PeerTrackState } from '@/types/peerjs'
import { Suspense, useMemo } from 'react'
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
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  connectionStates: Map<string, ConnectionState>
  peerTrackStates: Map<string, PeerTrackState>
  onToggleVideo: (enabled: boolean) => void
  onToggleAudio: (enabled: boolean) => void
  onSwitchCamera: (deviceId: string) => Promise<void>
}

function VideoGridContent({
  roomId,
  userId,
  playerName,
  detectorType,
  usePerspectiveWarp,
  onCardCrop,
  localStream,
  remoteStreams,
  connectionStates,
  peerTrackStates,
  onToggleVideo,
  onToggleAudio,
  onSwitchCamera,
}: GameRoomVideoGridProps) {
  const { members: voiceChannelMembers } = useVoiceChannelMembersFromEvents({
    gameId: roomId,
    userId: userId,
  })

  // Build player list with connection states
  const players = useMemo(
    () =>
      voiceChannelMembers.map((member) => ({
        id: member.id,
        name: member.username,
        connectionState: connectionStates.get(member.id) || 'disconnected',
        trackState: peerTrackStates.get(member.id) || {
          videoEnabled: true,
          audioEnabled: true,
        },
      })),
    [voiceChannelMembers, connectionStates, peerTrackStates],
  )

  return (
    <VideoStreamGrid
      players={players}
      localPlayerName={playerName}
      localStream={localStream}
      enableCardDetection={true}
      detectorType={detectorType}
      usePerspectiveWarp={usePerspectiveWarp}
      onCardCrop={onCardCrop}
      remoteStreams={remoteStreams}
      onToggleVideo={onToggleVideo}
      onToggleAudio={onToggleAudio}
      onSwitchCamera={onSwitchCamera}
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
