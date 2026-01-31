import type { DetectorType } from '@/lib/detectors'
import type { Participant } from '@/types/participant'
import { useCallback, useEffect, useRef, useState } from 'react'
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

  // Stable callback ref - only assigns the element to the ref
  // Stream attachment is handled separately in useEffect to avoid flickering
  // when the stream reference changes (e.g., when toggling audio)
  const handleVideoRef = useCallback(
    (videoElement: HTMLVideoElement | null) => {
      videoRef.current = videoElement
    },
    [],
  )

  // Attach stream to video element when VIDEO TRACKS change
  // This is separate from the ref callback to prevent flickering:
  // - Callback refs that depend on props cause React to call old(null) then new(element) when props change
  // - By using a stable callback ref + useEffect, we update the srcObject without remounting
  // - We compare actual video track objects, not stream reference, because combinedStream
  //   creates a new MediaStream object when audio changes (even if video tracks are the same)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return

    // Get video tracks from the new stream
    const newVideoTracks = stream.getVideoTracks()

    // Get video tracks from the currently attached stream
    const currentStream = video.srcObject as MediaStream | null
    const currentVideoTracks = currentStream?.getVideoTracks() ?? []

    // Only re-attach if video tracks have actually changed
    // This prevents flickering when only audio is toggled
    const tracksAreSame =
      newVideoTracks.length === currentVideoTracks.length &&
      newVideoTracks.every((track, i) => track === currentVideoTracks[i])

    if (tracksAreSame) {
      return
    }

    attachVideoStream(video, stream)
  }, [stream])

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
        <span className="rounded bg-brand-muted px-1.5 py-0.5 text-xs text-brand-muted-foreground">
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
