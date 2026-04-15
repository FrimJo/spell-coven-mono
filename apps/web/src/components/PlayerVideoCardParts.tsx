import type { PropsWithChildren } from 'react'
import { memo, useCallback, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { Camera, ChevronUp, Mic, MicOff, Video, VideoOff } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/popover'

// Extract inline styles
const VIDEO_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  zIndex: 0,
}

const CANVAS_OVERLAY_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  cursor: 'pointer',
  zIndex: 1,
}

const HIDDEN_CANVAS_STYLE: React.CSSProperties = { display: 'none' }

/**
 * Local player video element with stream
 */
interface LocalVideoProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
}

export const LocalVideo = memo(function LocalVideo({
  videoRef,
}: LocalVideoProps) {
  return <video ref={videoRef} autoPlay muted playsInline style={VIDEO_STYLE} />
})

/**
 * Card detection overlay canvas
 */
interface CardDetectionOverlayProps {
  overlayRef: React.RefObject<HTMLCanvasElement | null>
}

export const CardDetectionOverlay = memo(function CardDetectionOverlay({
  overlayRef,
}: CardDetectionOverlayProps) {
  return (
    <canvas
      ref={overlayRef}
      width={1280}
      height={720}
      style={CANVAS_OVERLAY_STYLE}
    />
  )
})

/**
 * Cropped card canvas (hidden)
 */
interface CroppedCanvasProps {
  croppedRef: React.RefObject<HTMLCanvasElement | null>
}

export const CroppedCanvas = memo(function CroppedCanvas({
  croppedRef,
}: CroppedCanvasProps) {
  return (
    <canvas
      ref={croppedRef}
      width={446}
      height={620}
      style={HIDDEN_CANVAS_STYLE}
    />
  )
})

/**
 * Full resolution canvas (hidden)
 */
interface FullResCanvasProps {
  fullResRef: React.RefObject<HTMLCanvasElement | null>
}

export const FullResCanvas = memo(function FullResCanvas({
  fullResRef,
}: FullResCanvasProps) {
  return (
    <canvas
      ref={fullResRef}
      width={1280}
      height={720}
      style={HIDDEN_CANVAS_STYLE}
    />
  )
})

/**
 * Video disabled placeholder
 */
export const VideoDisabledPlaceholder = memo(
  function VideoDisabledPlaceholder() {
    return (
      <div className="inset-0 absolute flex items-center justify-center bg-surface-0">
        <div className="space-y-2 text-center">
          <VideoOff className="h-12 w-12 mx-auto text-text-muted" />
          <p className="text-text-muted">Camera Off</p>
        </div>
      </div>
    )
  },
)

/**
 * Local player media controls (video, audio, camera selector)
 */
interface LocalMediaControlsProps {
  videoEnabled: boolean
  isAudioMuted: boolean
  onToggleVideo: (enabled: boolean) => Promise<void>
  onToggleAudio: () => void
  isTogglingVideo?: boolean
}

export const LocalMediaControls = memo(function LocalMediaControls({
  videoEnabled,
  isAudioMuted,
  onToggleVideo,
  onToggleAudio,
  isTogglingVideo = false,
}: LocalMediaControlsProps) {
  const [cameraPopoverOpen, setCameraPopoverOpen] = useState(false)
  const [micPopoverOpen, setMicPopoverOpen] = useState(false)
  const {
    video: { devices: videoDevices },
    audio: { devices: audioDevices },
    mediaPreferences: {
      selectedVideoDeviceId,
      selectedAudioInputDeviceId,
      setSelectedVideoDeviceId,
      setSelectedAudioInputDeviceId,
    },
  } = useMediaStreams()

  // Handle camera selection
  const handleSelectCamera = useCallback(
    (deviceId: string) => {
      try {
        setSelectedVideoDeviceId(deviceId)
        setCameraPopoverOpen(false)
      } catch (error) {
        console.error('[LocalMediaControls] Failed to switch camera:', error)
      }
    },
    [setSelectedVideoDeviceId],
  )

  // Handle microphone selection
  const handleSelectMicrophone = useCallback(
    (deviceId: string) => {
      try {
        setSelectedAudioInputDeviceId(deviceId)
        setMicPopoverOpen(false)
      } catch (error) {
        console.error(
          '[LocalMediaControls] Failed to switch microphone:',
          error,
        )
      }
    },
    [setSelectedAudioInputDeviceId],
  )
  return (
    <div className="bottom-4 gap-2 px-3 py-2 shadow-lg backdrop-blur-sm absolute left-1/2 z-20 flex -translate-x-1/2 items-center rounded-lg border border-surface-2 bg-surface-0/95">
      {/* Video toggle with camera selector - Discord style compound button */}
      <div className="flex items-center">
        <Button
          data-testid="video-toggle-button"
          size="sm"
          variant={videoEnabled ? 'outline' : 'destructive'}
          onClick={async () => {
            await onToggleVideo(!videoEnabled)
          }}
          disabled={isTogglingVideo}
          className={`h-10 w-10 p-0 rounded-r-none border-r-0 ${
            videoEnabled
              ? 'text-white border-surface-3 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50'
              : 'text-white border-destructive bg-destructive hover:bg-destructive disabled:cursor-not-allowed disabled:opacity-50'
          }`}
        >
          {videoEnabled ? (
            <Video className="h-5 w-5" />
          ) : (
            <VideoOff className="h-5 w-5" />
          )}
        </Button>
        <Popover open={cameraPopoverOpen} onOpenChange={setCameraPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={videoEnabled ? 'outline' : 'destructive'}
              className={`h-10 w-6 p-0 rounded-l-none ${
                videoEnabled
                  ? 'text-white border-surface-3 hover:bg-surface-2'
                  : 'text-white border-destructive bg-destructive hover:bg-destructive'
              }`}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-0 backdrop-blur-sm border-surface-2 bg-surface-0/95"
            align="center"
            sideOffset={8}
          >
            <div className="px-4 py-3 border-b border-surface-2">
              <h3 className="text-sm font-semibold text-white">
                Select Camera
              </h3>
              <p className="text-xs text-text-muted">
                {videoDevices.length} camera
                {videoDevices.length !== 1 ? 's' : ''} available
              </p>
            </div>
            <div className="max-h-64 p-2 overflow-y-auto">
              {videoDevices.map((camera) => (
                <div
                  key={camera.deviceId}
                  onClick={() => void handleSelectCamera(camera.deviceId)}
                  className={`gap-3 px-3 py-2.5 flex w-full cursor-pointer items-center rounded-md text-left transition-colors hover:bg-surface-2/50 ${
                    selectedVideoDeviceId === camera.deviceId
                      ? 'text-white bg-brand/20'
                      : 'text-text-secondary'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  <span className="text-sm">
                    {camera.label ||
                      `Camera ${videoDevices.indexOf(camera) + 1}`}
                  </span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Audio toggle with microphone selector - Discord style compound button */}
      <div className="flex items-center">
        <Button
          data-testid="audio-toggle-button"
          size="sm"
          variant={!isAudioMuted ? 'outline' : 'destructive'}
          onClick={onToggleAudio}
          className={`h-10 w-10 p-0 rounded-r-none border-r-0 ${
            !isAudioMuted
              ? 'text-white border-surface-3 bg-surface-0/90 hover:bg-surface-2'
              : 'text-white border-destructive bg-destructive hover:bg-destructive'
          }`}
        >
          {!isAudioMuted ? (
            <Mic className="h-5 w-5" />
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </Button>
        <Popover open={micPopoverOpen} onOpenChange={setMicPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={!isAudioMuted ? 'outline' : 'destructive'}
              className={`h-10 w-6 p-0 rounded-l-none ${
                !isAudioMuted
                  ? 'text-white border-surface-3 hover:bg-surface-2'
                  : 'text-white border-destructive bg-destructive hover:bg-destructive'
              }`}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-0 backdrop-blur-sm border-surface-2 bg-surface-0/95"
            align="center"
            sideOffset={8}
          >
            <div className="px-4 py-3 border-b border-surface-2">
              <h3 className="text-sm font-semibold text-white">
                Select Microphone
              </h3>
              <p className="text-xs text-text-muted">
                {audioDevices.length} microphone
                {audioDevices.length !== 1 ? 's' : ''} available
              </p>
            </div>
            <div className="max-h-64 p-2 overflow-y-auto">
              {audioDevices.map((mic) => (
                <div
                  key={mic.deviceId}
                  onClick={() => void handleSelectMicrophone(mic.deviceId)}
                  className={`gap-3 px-3 py-2.5 flex w-full cursor-pointer items-center rounded-md text-left transition-colors hover:bg-surface-2/50 ${
                    selectedAudioInputDeviceId === mic.deviceId
                      ? 'text-white bg-brand/20'
                      : 'text-text-secondary'
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  <span className="text-sm">
                    {mic.label || `Microphone ${audioDevices.indexOf(mic) + 1}`}
                  </span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
})

interface PlayerNameBadgeProps extends PropsWithChildren {
  position?: 'top-left' | 'bottom-center'
}

export const PlayerNameBadge = memo(function PlayerNameBadge({
  children,
  position = 'top-left',
}: PlayerNameBadgeProps) {
  const positionClasses =
    position === 'bottom-center'
      ? 'bottom-3 left-1/2 -translate-x-1/2'
      : 'left-3 top-3'

  return (
    <div
      className={`absolute border-surface-2 bg-surface-0/90 ${positionClasses} px-3 py-2 backdrop-blur-sm z-10 rounded-lg border`}
    >
      <div className="gap-2 flex items-center">{children}</div>
    </div>
  )
})
