import type { DetectorType } from '@/lib/detectors'
import type { Participant } from '@/types/participant'
import { useCallback, useRef, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { useCardDetector } from '@/hooks/useCardDetector'
import { attachVideoStream } from '@/lib/video-stream-utils'

import { PlayerStatsOverlay } from './PlayerStatsOverlay'
import { PlayerVideoCard } from './PlayerVideoCard'
import {
  CardDetectionOverlay,
  CroppedCanvas,
  FullResCanvas,
  LocalMediaControls,
  PlayerNameBadge,
  VideoDisabledPlaceholder,
} from './PlayerVideoCardParts'

interface LocalVideoCardProps {
  localPlayerName: string
  stream?: MediaStream | null
  enableCardDetection?: boolean
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
  onCardCrop?: (canvas: HTMLCanvasElement) => void
  roomId?: string
  participant?: Participant
  currentUser?: Participant
  participants?: Participant[]
}

export function LocalVideoCard({
  localPlayerName,
  stream,
  enableCardDetection = true,
  detectorType,
  usePerspectiveWarp = true,
  onCardCrop,
  roomId,
  participant,
  currentUser,
  participants,
}: LocalVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Get toggle functions and state from media stream context
  // Using context directly for proper resource release/acquisition
  const {
    toggleVideo,
    toggleAudio: toggleLocalAudio,
    mediaPreferences: { videoEnabled, audioEnabled },
  } = useMediaStreams()

  const [isTogglingVideo, setIsTogglingVideo] = useState(false)

  // Wrap toggle to handle loading state
  const handleToggleVideo = useCallback(
    async (enabled: boolean) => {
      setIsTogglingVideo(true)
      try {
        await toggleVideo(enabled)
      } finally {
        setIsTogglingVideo(false)
      }
    },
    [toggleVideo],
  )

  // Initialize card detector (only when stream exists)
  const { overlayRef, croppedRef, fullResRef } = useCardDetector({
    videoRef: videoRef,
    enableCardDetection: enableCardDetection && !!stream,
    detectorType,
    usePerspectiveWarp,
    onCrop: onCardCrop,
    reinitializeTrigger: stream ? 1 : 0,
  })

  // Audio muted state is derived from context's audioEnabled preference
  const isAudioMuted = !audioEnabled

  // Callback ref that combines ref assignment with stream attachment
  // Called when video element is mounted/unmounted
  const handleVideoRef = useCallback(
    (videoElement: HTMLVideoElement | null) => {
      // Attach stream when element is mounted and stream exists
      if (videoElement && stream) {
        videoRef.current = videoElement
        attachVideoStream(videoElement, stream)
      }
    },
    [stream],
  )

  const handleToggleAudio = useCallback(() => {
    // Toggle audio - context will release/acquire mic resources
    // isAudioMuted = !audioEnabled, so passing isAudioMuted toggles to the opposite state
    toggleLocalAudio(isAudioMuted)
  }, [toggleLocalAudio, isAudioMuted])

  // Show video only when enabled AND stream has video tracks
  const hasVideoStream =
    videoEnabled && stream && stream.getVideoTracks().length > 0

  return (
    <PlayerVideoCard>
      {hasVideoStream ? (
        <>
          <video
            ref={handleVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              zIndex: 0,
            }}
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

      {/* Player Info Badge */}
      <PlayerNameBadge>
        <span className="text-white">{localPlayerName}</span>
        <span className="rounded bg-purple-500/30 px-1.5 py-0.5 text-xs text-purple-300">
          You
        </span>
      </PlayerNameBadge>

      {/* Stats Overlay */}
      {roomId && participant && currentUser && participants && (
        <PlayerStatsOverlay
          roomId={roomId}
          participant={participant}
          currentUser={currentUser}
          participants={participants}
        />
      )}

      {/* Media Controls */}
      <LocalMediaControls
        videoEnabled={videoEnabled}
        isAudioMuted={isAudioMuted}
        onToggleVideo={handleToggleVideo}
        onToggleAudio={handleToggleAudio}
        isTogglingVideo={isTogglingVideo}
      />
    </PlayerVideoCard>
  )
}
