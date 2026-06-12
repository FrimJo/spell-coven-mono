import type { DetectorType } from '@/lib/detectors'
import type { MediaTrack } from '@/types/media-session'
import type { Participant } from '@/types/participant'
import { memo, useCallback, useRef } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { useRoomMedia } from '@/contexts/RoomMediaContext'
import { useCardDetector } from '@/hooks/useCardDetector'
import { Wifi } from 'lucide-react'

import { LiveKitTrackElement } from './LiveKitTrackElement'
import { PlayerStatsOverlay } from './PlayerStatsOverlay'
import { PlayerVideoCard } from './PlayerVideoCard'
import {
  CardDetectionOverlay,
  CroppedCanvas,
  FullResCanvas,
  LocalMediaControls,
  VIDEO_STYLE,
  VideoDisabledPlaceholder,
} from './PlayerVideoCardParts'

interface LocalVideoCardProps {
  videoTrack?: MediaTrack | null
  /** Room transport is reconnecting; show a non-destructive badge over the preview. */
  isReconnecting?: boolean
  enableCardDetection?: boolean
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
  onCardCrop?: (canvas: HTMLCanvasElement) => void
  roomId?: string
  participant?: Participant
  currentUser?: Participant
  participants?: Participant[]
  gridIndex?: number
}

export const LocalVideoCard = memo(function LocalVideoCard({
  videoTrack,
  isReconnecting = false,
  enableCardDetection = true,
  detectorType,
  usePerspectiveWarp = true,
  onCardCrop,
  roomId,
  participant,
  currentUser,
  participants,
  gridIndex: _gridIndex = 0,
}: LocalVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomMedia = useRoomMedia()

  const handleVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element
  }, [])

  const {
    mediaPreferences: {
      videoEnabled,
      audioEnabled,
      setVideoEnabled,
      setAudioEnabled,
    },
  } = useMediaStreams()

  const { overlayRef, croppedRef, fullResRef } = useCardDetector({
    videoRef,
    enableCardDetection: enableCardDetection && !!videoTrack,
    detectorType,
    usePerspectiveWarp,
    onCrop: onCardCrop,
    reinitializeTrigger: videoTrack ? 1 : 0,
  })

  const isAudioMuted = !audioEnabled

  const handleToggleVideo = useCallback(
    (nextEnabled: boolean) => {
      setVideoEnabled(nextEnabled)
      void roomMedia.setCameraEnabled(nextEnabled)
    },
    [roomMedia, setVideoEnabled],
  )

  const handleToggleAudio = useCallback(() => {
    const nextEnabled = !audioEnabled
    setAudioEnabled(nextEnabled)
    void roomMedia.setMicrophoneEnabled(nextEnabled)
  }, [roomMedia, setAudioEnabled, audioEnabled])

  const hasVideoStream = videoEnabled && !!videoTrack

  return (
    <PlayerVideoCard ref={videoContainerRef}>
      {hasVideoStream ? (
        <>
          <LiveKitTrackElement
            kind="video"
            track={videoTrack}
            muted
            style={VIDEO_STYLE}
            onVideoElement={handleVideoRef}
          />
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
        <VideoDisabledPlaceholder />
      )}

      {isReconnecting && (
        <div
          data-testid="local-player-reconnecting"
          className="right-3 top-3 h-9 w-9 backdrop-blur-sm absolute z-10 flex items-center justify-center rounded-lg border border-warning/30 bg-warning/20"
          title="Reconnecting video..."
        >
          <Wifi className="h-4 w-4 text-warning" />
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
        videoEnabled={videoEnabled}
        isAudioMuted={isAudioMuted}
        onToggleVideo={handleToggleVideo}
        onToggleAudio={handleToggleAudio}
      />
    </PlayerVideoCard>
  )
})
