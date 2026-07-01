import type {
  MediaTrack,
  PeerMediaPresence,
  RemoteMediaStatus,
} from '@/types/media-session'
import type { Participant } from '@/types/participant'
import type { LucideIcon } from 'lucide-react'
import { memo, useRef } from 'react'
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
  PlayerNameBadge,
  VideoDisabledPlaceholder,
} from './PlayerVideoCardParts'
import { VIDEO_STYLE } from './videoStyles'

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
}: RemotePlayerCardProps) {
  const peerVideoEnabled = !remoteMediaStatus.videoMuted
  const peerAudioEnabled = !remoteMediaStatus.audioMuted

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
      className="border-surface-2 bg-surface-1 flex h-full flex-col overflow-hidden"
      data-testid="remote-player-card"
      data-player-id={playerId}
      data-player-name={playerName}
      data-livekit-connection-state={peerMediaPresenceState}
      data-video-subscribed={String(remoteMediaStatus.videoSubscribed)}
      data-audio-subscribed={String(remoteMediaStatus.audioSubscribed)}
      data-video-muted={String(remoteMediaStatus.videoMuted)}
      data-audio-muted={String(remoteMediaStatus.audioMuted)}
    >
      <div ref={videoContainerRef} className="relative min-h-0 flex-1 bg-black">
        {peerVideoEnabled ? (
          <>
            {remoteVideoTrack && (
              <LiveKitTrackElement
                testId="remote-player-video"
                kind="video"
                track={remoteVideoTrack}
                ariaLabel={`${playerName} camera`}
                muted={isMuted}
                style={VIDEO_STYLE}
              />
            )}
            {peerAudioEnabled && remoteAudioTrack && (
              <LiveKitTrackElement
                kind="audio"
                track={remoteAudioTrack}
                ariaLabel={`${playerName} audio`}
                muted={isMuted}
                testId="remote-player-audio"
              />
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

        <div className="absolute right-3 top-3 z-10 flex gap-2">
          {!peerAudioEnabled && (
            <div className="border-destructive/30 bg-destructive/20 flex size-9 items-center justify-center rounded-lg border backdrop-blur-sm">
              <MicOff className="text-destructive size-4" />
            </div>
          )}
          {!isOnline && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="border-warning/30 bg-warning/20 flex size-9 items-center justify-center rounded-lg border backdrop-blur-sm"
                  data-testid="remote-player-offline-warning"
                >
                  <Unplug className="text-warning size-4" />
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
                  className={`flex size-9 items-center justify-center rounded-lg border backdrop-blur-sm ${peerMediaPresenceWarning.borderClass} ${peerMediaPresenceWarning.bgClass} `}
                  title={`Video connection: ${peerMediaPresenceWarning.state}`}
                >
                  <PeerMediaPresenceWarningIcon
                    className={`size-4 ${peerMediaPresenceWarning.iconClass} `}
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
