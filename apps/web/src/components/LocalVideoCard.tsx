import type { MediaTrack } from '@/types/media-session'
import type { Participant } from '@/types/participant'
import { memo, useCallback, useRef } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { Wifi } from 'lucide-react'

import { LiveKitTrackElement } from './LiveKitTrackElement'
import { PlayerStatsOverlay } from './PlayerStatsOverlay'
import { PlayerVideoCard } from './PlayerVideoCard'
import {
  LocalMediaControls,
  VideoDisabledPlaceholder,
} from './PlayerVideoCardParts'
import { VIDEO_STYLE } from './videoStyles'

interface LocalVideoCardProps {
  videoTrack?: MediaTrack | null
  /** Room transport is reconnecting; show a non-destructive badge over the preview. */
  isReconnecting?: boolean
  roomId?: string
  participant?: Participant
  currentUser?: Participant
  participants?: Participant[]
  gridIndex?: number
}

export const LocalVideoCard = memo(function LocalVideoCard({
  videoTrack,
  isReconnecting = false,
  roomId,
  participant,
  currentUser,
  participants,
  gridIndex: _gridIndex = 0,
}: LocalVideoCardProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null)

  const {
    mediaPreferences: {
      videoEnabled,
      audioEnabled,
      setVideoEnabled,
      setAudioEnabled,
    },
  } = useMediaStreams()

  const isAudioMuted = !audioEnabled

  const handleToggleAudio = useCallback(() => {
    setAudioEnabled(!audioEnabled)
  }, [setAudioEnabled, audioEnabled])

  const hasVideoStream = videoEnabled && !!videoTrack

  return (
    <PlayerVideoCard ref={videoContainerRef}>
      {hasVideoStream ? (
        <>
          <LiveKitTrackElement
            kind="video"
            track={videoTrack}
            ariaLabel={`${participant?.username ?? 'Your'} camera preview`}
            muted
            style={VIDEO_STYLE}
          />
        </>
      ) : (
        <VideoDisabledPlaceholder />
      )}

      {isReconnecting && (
        <div
          data-testid="local-player-reconnecting"
          className="border-warning/30 bg-warning/20 absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-lg border backdrop-blur-sm"
          title="Reconnecting video..."
        >
          <Wifi className="text-warning size-4" />
        </div>
      )}

      {roomId && participant && participants && (
        <PlayerStatsOverlay
          roomId={roomId}
          participant={participant}
          participants={participants}
          currentUserId={currentUser?.id}
          videoContainerRef={videoContainerRef}
        />
      )}

      <LocalMediaControls
        roomId={roomId ?? ''}
        videoEnabled={videoEnabled}
        isAudioMuted={isAudioMuted}
        onToggleVideo={setVideoEnabled}
        onToggleAudio={handleToggleAudio}
      />
    </PlayerVideoCard>
  )
})
