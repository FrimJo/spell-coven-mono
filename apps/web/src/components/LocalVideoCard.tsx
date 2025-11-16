import type { DetectorType } from '@/lib/detectors'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useCardDetector } from '@/hooks/useCardDetector'
import { useLocalVideoState } from '@/hooks/useLocalVideoState'
import { attachVideoStream } from '@/lib/video-stream-utils'

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
  stream: MediaStream
  videoRef: React.RefObject<HTMLVideoElement | null>
  enableCardDetection?: boolean
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
  onCardCrop?: (canvas: HTMLCanvasElement) => void
  onToggleVideo?: (enabled: boolean) => Promise<void>
}

export function LocalVideoCard({
  localPlayerName,
  stream,
  enableCardDetection = true,
  detectorType,
  usePerspectiveWarp = true,
  onCardCrop,
  onToggleVideo,
}: LocalVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Manage local video state
  const localVideoStateOptions = useMemo(
    () => ({
      stream,
      onVideoStateChanged: onToggleVideo,
      initialEnabled: true,
    }),
    [stream, onToggleVideo],
  )

  const { videoEnabled, toggleVideo, isTogglingVideo } = useLocalVideoState(
    localVideoStateOptions,
  )

  // Initialize card detector
  const { overlayRef, croppedRef, fullResRef } = useCardDetector({
    videoRef: videoRef,
    enableCardDetection,
    detectorType,
    usePerspectiveWarp,
    onCrop: onCardCrop,
    reinitializeTrigger: stream ? 1 : 0,
  })

  const [isAudioMuted, setIsAudioMuted] = useState(false)

  // Callback ref that combines ref assignment with stream attachment
  // Called when video element is mounted/unmounted
  const handleVideoRef = useCallback(
    (videoElement: HTMLVideoElement | null) => {
      // Attach stream when element is mounted
      if (videoElement) {
        videoRef.current = videoElement
        attachVideoStream(videoElement, stream)
      }
    },
    [stream],
  )

  const toggleLocalAudio = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const mediaStream = videoRef.current.srcObject as MediaStream
      const audioTracks = mediaStream.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsAudioMuted(!isAudioMuted)
    }
  }, [isAudioMuted, videoRef])

  return (
    <PlayerVideoCard>
      {videoEnabled ? (
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

      {/* Media Controls */}
      <LocalMediaControls
        videoEnabled={videoEnabled}
        isAudioMuted={isAudioMuted}
        onToggleVideo={toggleVideo}
        onToggleAudio={toggleLocalAudio}
        isTogglingVideo={isTogglingVideo}
      />
    </PlayerVideoCard>
  )
}
