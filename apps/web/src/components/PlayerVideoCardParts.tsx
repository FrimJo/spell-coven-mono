import type { UseMediaDeviceOptions } from '@/hooks/useMediaDevice'
import type { PropsWithChildren } from 'react'
import { useMemo, useState } from 'react'
import { useMediaDevice } from '@/hooks/useMediaDevice'
import {
  Camera,
  Mic,
  MicOff,
  SwitchCamera,
  Video,
  VideoOff,
} from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/popover'

/**
 * Local player video element with stream
 */
interface LocalVideoProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
}

export function LocalVideo({ videoRef }: LocalVideoProps) {
  return (
    <video
      ref={videoRef}
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
  )
}

/**
 * Card detection overlay canvas
 */
interface CardDetectionOverlayProps {
  overlayRef: React.RefObject<HTMLCanvasElement | null>
}

export function CardDetectionOverlay({
  overlayRef,
}: CardDetectionOverlayProps) {
  return (
    <canvas
      ref={overlayRef}
      width={1280}
      height={720}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        cursor: 'pointer',
        zIndex: 1,
      }}
    />
  )
}

/**
 * Cropped card canvas (hidden)
 */
interface CroppedCanvasProps {
  croppedRef: React.RefObject<HTMLCanvasElement | null>
}

export function CroppedCanvas({ croppedRef }: CroppedCanvasProps) {
  return (
    <canvas
      ref={croppedRef}
      width={446}
      height={620}
      style={{ display: 'none' }}
    />
  )
}

/**
 * Full resolution canvas (hidden)
 */
interface FullResCanvasProps {
  fullResRef: React.RefObject<HTMLCanvasElement | null>
}

export function FullResCanvas({ fullResRef }: FullResCanvasProps) {
  return (
    <canvas
      ref={fullResRef}
      width={1280}
      height={720}
      style={{ display: 'none' }}
    />
  )
}

/**
 * Video disabled placeholder
 */
export function VideoDisabledPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
      <div className="space-y-2 text-center">
        <VideoOff className="mx-auto h-12 w-12 text-slate-600" />
        <p className="text-slate-600">Camera Off</p>
      </div>
    </div>
  )
}

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

export function LocalMediaControls({
  videoEnabled,
  isAudioMuted,
  onToggleVideo,
  onToggleAudio,
  isTogglingVideo = false,
}: LocalMediaControlsProps) {
  const [cameraPopoverOpen, setCameraPopoverOpen] = useState(false)

  // Memoize hook options to prevent infinite renders from recreated objects
  const videoDeviceOptions = useMemo<UseMediaDeviceOptions>(
    () => ({ kind: 'videoinput' }),
    [],
  )

  // Get camera data and control from hook - single source of truth
  // useMediaDevice handles persistence to localStorage internally
  const {
    devices: videoDevices,
    selectedDeviceId: selectedVideoId,
    start: switchVideoDevice,
  } = useMediaDevice(videoDeviceOptions)

  // Handle camera selection
  const handleSelectCamera = (deviceId: string) => {
    try {
      switchVideoDevice(deviceId) // Persists to localStorage internally
      setCameraPopoverOpen(false)
    } catch (error) {
      console.error('[LocalMediaControls] Failed to switch camera:', error)
    }
  }
  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <Button
        data-testid="video-toggle-button"
        size="sm"
        variant={videoEnabled ? 'outline' : 'destructive'}
        onClick={async () => {
          await onToggleVideo(!videoEnabled)
        }}
        disabled={isTogglingVideo}
        className={`h-10 w-10 p-0 ${
          videoEnabled
            ? 'border-slate-700 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
            : 'border-red-600 bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
        }`}
      >
        {videoEnabled ? (
          <Video className="h-5 w-5" />
        ) : (
          <VideoOff className="h-5 w-5" />
        )}
      </Button>
      <Button
        size="sm"
        variant={!isAudioMuted ? 'outline' : 'destructive'}
        onClick={onToggleAudio}
        className={`h-10 w-10 p-0 ${
          !isAudioMuted
            ? 'border-slate-700 bg-slate-950/90 text-white hover:bg-slate-800'
            : 'border-red-600 bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        {!isAudioMuted ? (
          <Mic className="h-5 w-5" />
        ) : (
          <MicOff className="h-5 w-5" />
        )}
      </Button>
      {/* Camera selector popover */}
      <Popover open={cameraPopoverOpen} onOpenChange={setCameraPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-10 w-10 border-slate-700 p-0 text-white hover:bg-slate-800"
          >
            <SwitchCamera className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 border-slate-800 bg-slate-950/95 p-0 backdrop-blur-sm"
          align="end"
          sideOffset={8}
        >
          <div className="border-b border-slate-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Select Camera</h3>
            <p className="text-xs text-slate-400">
              {videoDevices.length} camera
              {videoDevices.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {videoDevices.map((camera) => (
              <div
                key={camera.deviceId}
                onClick={() => void handleSelectCamera(camera.deviceId)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-slate-800/50 ${
                  selectedVideoId === camera.deviceId
                    ? 'bg-purple-500/20 text-white'
                    : 'text-slate-300'
                }`}
              >
                <Camera className="h-4 w-4" />
                <span className="text-sm">
                  {camera.label || `Camera ${videoDevices.indexOf(camera) + 1}`}
                </span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function PlayerNameBadge(props: PropsWithChildren) {
  return (
    <div className="absolute left-3 top-3 z-10 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2">{props.children}</div>
    </div>
  )
}
