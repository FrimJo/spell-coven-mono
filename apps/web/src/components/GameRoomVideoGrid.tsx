import type { DetectorType } from '@/lib/detectors'
import type { ConnectionState, PeerTrackState } from '@/types/peerjs'
import { Suspense, useMemo } from 'react'
import { useGameRoomParticipants } from '@/hooks/useGameRoomParticipants'
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
  localTrackState: PeerTrackState
  remoteStreams: Map<string, MediaStream>
  connectionStates: Map<string, ConnectionState>
  peerTrackStates: Map<string, PeerTrackState>
  onToggleVideo: (enabled: boolean) => Promise<void>
  onToggleAudio: (enabled: boolean) => void
}

function VideoGridContent({
  roomId,
  userId,
  playerName,
  detectorType,
  usePerspectiveWarp,
  onCardCrop,
  localStream,
  localTrackState,
  remoteStreams,
  connectionStates,
  peerTrackStates,
  onToggleVideo,
  onToggleAudio,
}: GameRoomVideoGridProps) {
  const { participants: gameRoomParticipants } = useGameRoomParticipants({
    roomId,
    userId,
    username: playerName,
    enabled: true,
  })

  // Build player list: Include ALL participants (including self)
  // The local player should show their own video
  const players = useMemo(() => {
    const allPlayers = gameRoomParticipants.map((participant) => ({
      id: participant.id,
      name: participant.username,
      connectionState: connectionStates.get(participant.id) || 'disconnected',
      trackState: peerTrackStates.get(participant.id) || {
        videoEnabled: true,
        audioEnabled: true,
      },
    }))

    console.log('[GameRoomVideoGrid] Players list built:', {
      participantCount: gameRoomParticipants.length,
      playerCount: allPlayers.length,
      localUserId: userId,
      players: allPlayers.map((p) => ({ id: p.id, name: p.name })),
    })

    return allPlayers
  }, [gameRoomParticipants, connectionStates, peerTrackStates, userId])

  return (
    <VideoStreamGrid
      players={players}
      localPlayerName={playerName}
      localStream={localStream}
      localTrackState={localTrackState}
      enableCardDetection={true}
      detectorType={detectorType}
      usePerspectiveWarp={usePerspectiveWarp}
      onCardCrop={onCardCrop}
      remoteStreams={remoteStreams}
      connectionStates={connectionStates}
      peerTrackStates={peerTrackStates}
      onToggleVideo={onToggleVideo}
      onToggleAudio={onToggleAudio}
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
