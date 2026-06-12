import type { DetectorType } from '@/lib/detectors'
import type {
  MediaTrack,
  PeerMediaPresence,
  RemoteMediaStatus,
} from '@/types/media-session'
import type { Participant } from '@/types/participant'
import type { LucideIcon } from 'lucide-react'
import { memo, useCallback, useRef } from 'react'
import { useCardDetector } from '@/hooks/useCardDetector'
import { MicOff, Unplug, Wifi, WifiOff } from 'lucide-react'

import { Card } from '@repo/ui/components/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { LiveKitTrackElement } from './LiveKitTrackElement'
import { PlayerStatsOverlay } from './PlayerStatsOverlay'
import {
  CardDetectionOverlay,
  CroppedCanvas,
  FullResCanvas,
  PlayerNameBadge,
  VIDEO_STYLE,
  VideoDisabledPlaceholder,
} from './PlayerVideoCardParts'

type WarningPeerMediaPresence = Exclude<PeerMediaPresence, 'connected'>

const PEER_MEDIA_PRESENCE_WARNING: Record<
  WarningPeerMediaPresence,
  {
    borderClass: string
    bgClass: string
    iconClass: string
    Icon: LucideIcon
  }
> = {
  pending: {
    borderClass: 'border-warning/30',
    bgClass: 'bg-warning/20',
    iconClass: 'text-warning',
    Icon: Wifi,
  },
  connecting: {
    borderClass: 'border-warning/30',
    bgClass: 'bg-warning/20',
    iconClass: 'text-warning',
    Icon: Wifi,
  },
  disconnected: {
    borderClass: 'border-destructive/30',
    bgClass: 'bg-destructive/20',
    iconClass: 'text-destructive',
    Icon: WifiOff,
  },
}

// Memoized remote player component to prevent unnecessary re-renders
interface RemotePlayerCardProps {
  playerId: string
  playerName: string
  participantData: Participant
  remoteVideoTrack: MediaTrack | null
  remoteAudioTrack: MediaTrack | null
  remoteMediaStatus: RemoteMediaStatus
  peerMediaPresenceState: PeerMediaPresence
  isMuted: boolean
  roomId: string
  localParticipant: Participant | undefined
  gameRoomParticipants: Participant[]
  isOnline: boolean // Presence-based online status (matches sidebar)
  // Card detection props
  enableCardDetection: boolean
  detectorType?: DetectorType
  usePerspectiveWarp: boolean
  onCardCrop?: (canvas: HTMLCanvasElement) => void
}

export const RemotePlayerCard = memo(function RemotePlayerCard({
  playerId,
  playerName,
  participantData,
  remoteVideoTrack,
  remoteAudioTrack,
  remoteMediaStatus,
  peerMediaPresenceState,
  isMuted,
  roomId,
  localParticipant,
  gameRoomParticipants,
  isOnline,
  enableCardDetection,
  detectorType,
  usePerspectiveWarp,
  onCardCrop,
}: RemotePlayerCardProps) {
  const peerVideoEnabled = !remoteMediaStatus.videoMuted
  const peerAudioEnabled = !remoteMediaStatus.audioMuted

  // Local video ref for card detection (separate from the shared remoteVideoRefs map)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Initialize card detector for this remote player's stream
  const { overlayRef, croppedRef, fullResRef } = useCardDetector({
    videoRef: videoRef,
    enableCardDetection:
      enableCardDetection && peerVideoEnabled && !!remoteVideoTrack,
    detectorType,
    usePerspectiveWarp,
    onCrop: onCardCrop,
    reinitializeTrigger: remoteVideoTrack ? 1 : 0,
  })

  const handleVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element
  }, [])

  const videoContainerRef = useRef<HTMLDivElement>(null)
  const peerMediaPresenceWarning =
    isOnline && peerMediaPresenceState !== 'connected'
      ? {
          state: peerMediaPresenceState,
          ...PEER_MEDIA_PRESENCE_WARNING[peerMediaPresenceState],
        }
      : null
  const PeerMediaPresenceWarningIcon = peerMediaPresenceWarning?.Icon

  return (
    <Card
      className="flex h-full flex-col overflow-hidden border-surface-2 bg-surface-1"
      data-testid="remote-player-card"
      data-player-id={playerId}
      data-player-name={playerName}
      data-livekit-connection-state={peerMediaPresenceState}
      data-video-subscribed={String(remoteMediaStatus.videoSubscribed)}
      data-audio-subscribed={String(remoteMediaStatus.audioSubscribed)}
      data-video-muted={String(remoteMediaStatus.videoMuted)}
      data-audio-muted={String(remoteMediaStatus.audioMuted)}
    >
      <div ref={videoContainerRef} className="min-h-0 bg-black relative flex-1">
        {peerVideoEnabled ? (
          <>
            {remoteVideoTrack && (
              <LiveKitTrackElement
                testId="remote-player-video"
                kind="video"
                track={remoteVideoTrack}
                muted={isMuted}
                style={VIDEO_STYLE}
                onVideoElement={handleVideoRef}
              />
            )}
            {peerAudioEnabled && remoteAudioTrack && (
              <LiveKitTrackElement
                kind="audio"
                track={remoteAudioTrack}
                muted={isMuted}
                testId="remote-player-audio"
              />
            )}
            {enableCardDetection && overlayRef && (
              <CardDetectionOverlay overlayRef={overlayRef} />
            )}
            {enableCardDetection && croppedRef && (
              <CroppedCanvas croppedRef={croppedRef} />
            )}
            {enableCardDetection && fullResRef && (
              <FullResCanvas fullResRef={fullResRef} />
            )}
          </>
        ) : (
          <div data-testid="remote-player-video-off">
            <VideoDisabledPlaceholder />
          </div>
        )}

        <PlayerNameBadge position="bottom-center">
          <span className="text-white">{playerName}</span>
        </PlayerNameBadge>

        {localParticipant && (
          <>
            <PlayerStatsOverlay
              roomId={roomId}
              participant={participantData}
              participants={gameRoomParticipants}
              currentUserId={localParticipant.id}
              videoContainerRef={videoContainerRef}
            />
          </>
        )}

        <div className="right-3 top-3 gap-2 absolute z-10 flex">
          {!peerAudioEnabled && (
            <div className="h-9 w-9 backdrop-blur-sm flex items-center justify-center rounded-lg border border-destructive/30 bg-destructive/20">
              <MicOff className="h-4 w-4 text-destructive" />
            </div>
          )}
          {!isOnline && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-9 w-9 backdrop-blur-sm flex items-center justify-center rounded-lg border border-warning/30 bg-warning/20"
                  data-testid="remote-player-offline-warning"
                >
                  <Unplug className="h-4 w-4 text-warning" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Disconnected</p>
              </TooltipContent>
            </Tooltip>
          )}
          {peerMediaPresenceWarning && PeerMediaPresenceWarningIcon && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  data-testid="remote-player-livekit-warning"
                  data-connection-state={peerMediaPresenceWarning.state}
                  className={`h-9 w-9 backdrop-blur-sm flex items-center justify-center rounded-lg border ${peerMediaPresenceWarning.borderClass} ${peerMediaPresenceWarning.bgClass}`}
                  title={`Video connection: ${peerMediaPresenceWarning.state}`}
                >
                  <PeerMediaPresenceWarningIcon
                    className={`h-4 w-4 ${peerMediaPresenceWarning.iconClass}`}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Video connection: {peerMediaPresenceWarning.state}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </Card>
  )
})
