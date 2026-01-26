import type { UseLocalVideoStateOptions } from '@/hooks/useLocalVideoState'
import type { DetectorType } from '@/lib/detectors'
import type { Participant } from '@/types/participant'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useCardDetector } from '@/hooks/useCardDetector'
import { useLocalVideoState } from '@/hooks/useLocalVideoState'
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
  stream: MediaStream
  enableCardDetection?: boolean
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
  onCardCrop?: (canvas: HTMLCanvasElement) => void
  onToggleVideo?: (enabled: boolean) => Promise<void>
  onToggleAudio?: (enabled: boolean) => void
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
  onToggleVideo,
  onToggleAudio,
  roomId,
  participant,
  currentUser,
  participants,
}: LocalVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Manage local video state
  const localVideoStateOptions = useMemo<UseLocalVideoStateOptions>(
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

  // Track audio muted state - initialize from stream tracks
  const [isAudioMuted, setIsAudioMuted] = useState(() => {
    const audioTracks = stream.getAudioTracks()
    return audioTracks.length > 0 && !audioTracks[0]?.enabled
  })

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
    const newMutedState = !isAudioMuted
    setIsAudioMuted(newMutedState)

    if (onToggleAudio) {
      // Use centralized toggle function if provided
      onToggleAudio(!newMutedState)
    } else {
      // Fallback to local implementation if prop not provided
      const audioTracks = stream.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = !newMutedState
      })
    }
  }, [onToggleAudio, isAudioMuted, stream])

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
        onToggleVideo={toggleVideo}
        onToggleAudio={toggleLocalAudio}
        isTogglingVideo={isTogglingVideo}
      />
    </PlayerVideoCard>
  )
}
