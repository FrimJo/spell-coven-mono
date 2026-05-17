import type { DetectorType } from '@/lib/detectors'
import type { MediaTrack } from '@/types/media-session'
import type { Participant } from '@/types/participant'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { useRoomMedia } from '@/contexts/RoomMediaContext'
import { useCardDetector } from '@/hooks/useCardDetector'
import { attachVideoStream } from '@/lib/video-stream-utils'

import { LiveKitTrackElement } from './LiveKitTrackElement'
import { PlayerStatsOverlay } from './PlayerStatsOverlay'
import { PlayerVideoCard } from './PlayerVideoCard'
import {
  CardDetectionOverlay,
  CroppedCanvas,
  FullResCanvas,
  LocalMediaControls,
  VideoDisabledPlaceholder,
} from './PlayerVideoCardParts'

// Extract inline style to prevent recreation
const LOCAL_VIDEO_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  zIndex: 0,
}

interface LocalVideoCardProps {
  stream?: MediaStream | null
  videoTrack?: MediaTrack | null
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
  stream,
  videoTrack,
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

  // Get toggle functions and state from media stream context
  // Using context directly for proper resource release/acquisition
  const {
    toggleVideo,
    toggleAudio: toggleLocalAudio,
    mediaPreferences: { videoEnabled, audioEnabled },
  } = useMediaStreams()
  const { controls } = useRoomMedia()

  const [isTogglingVideo, setIsTogglingVideo] = useState(false)

  // Wrap toggle to handle loading state
  const handleToggleVideo = useCallback(
    async (enabled: boolean) => {
      setIsTogglingVideo(true)
      try {
        await toggleVideo(enabled)
        await controls.setCameraEnabled(enabled)
      } finally {
        setIsTogglingVideo(false)
      }
    },
    [toggleVideo, controls],
  )

  // Initialize card detector (only when stream exists)
  const { overlayRef, croppedRef, fullResRef } = useCardDetector({
    videoRef: videoRef,
    enableCardDetection: enableCardDetection && (!!videoTrack || !!stream),
    detectorType,
    usePerspectiveWarp,
    onCrop: onCardCrop,
    reinitializeTrigger: videoTrack ? 1 : stream ? 1 : 0,
  })

  // Audio muted state is derived from context's audioEnabled preference
  const isAudioMuted = !audioEnabled

  // Stable callback ref - only assigns the element to the ref
  // Stream attachment is handled separately in useEffect to avoid flickering
  // when the stream reference changes (e.g., when toggling audio)
  const handleVideoRef = useCallback(
    (videoElement: HTMLVideoElement | null) => {
      videoRef.current = videoElement
    },
    [],
  )

  // Keep video.srcObject in sync with the combinedStream from context.
  // We skip re-attach only when video tracks AND the MediaStream instance are
  // both unchanged. The stream identity check is necessary because
  // combinedStream is rebuilt on audio toggle; the old stream may still
  // reference stopped audio tracks, which can cause browsers to black out
  // the video surface.
  useEffect(() => {
    if (videoTrack) return
    const video = videoRef.current
    if (!video || !stream) return

    const currentStream = video.srcObject as MediaStream | null

    if (currentStream === stream) return

    const newVideoTracks = stream.getVideoTracks()
    const currentVideoTracks = currentStream?.getVideoTracks() ?? []

    const tracksAreSame =
      newVideoTracks.length === currentVideoTracks.length &&
      newVideoTracks.every((track, i) => track === currentVideoTracks[i])

    if (tracksAreSame) {
      video.srcObject = stream
      return
    }

    attachVideoStream(video, stream)
  }, [stream, videoTrack])

  const handleToggleAudio = useCallback(async () => {
    // Toggle audio - context will release/acquire mic resources
    // isAudioMuted = !audioEnabled, so passing isAudioMuted toggles to the opposite state
    toggleLocalAudio(isAudioMuted)
    await controls.setMicrophoneEnabled(isAudioMuted)
  }, [toggleLocalAudio, isAudioMuted, controls])

  // Show video only when enabled AND stream has video tracks
  const hasVideoStream =
    videoEnabled &&
    (!!videoTrack || (stream ? stream.getVideoTracks().length > 0 : false))

  return (
    <PlayerVideoCard ref={videoContainerRef}>
      {hasVideoStream ? (
        <>
          {videoTrack ? (
            <LiveKitTrackElement
              kind="video"
              track={videoTrack}
              muted
              style={LOCAL_VIDEO_STYLE}
              onVideoElement={handleVideoRef}
            />
          ) : (
            <video
              ref={handleVideoRef}
              autoPlay
              muted
              playsInline
              style={LOCAL_VIDEO_STYLE}
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
        <VideoDisabledPlaceholder />
      )}

      {/* Stats Overlay */}
      {roomId && participant && participants && (
        <PlayerStatsOverlay
          roomId={roomId}
          participant={participant}
          participants={participants}
          currentUserId={currentUser?.id}
          videoContainerRef={videoContainerRef}
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
})
