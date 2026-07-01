import type { PropsWithChildren } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { isPhoneCameraPairingEnabled } from '@/env'
import { useDeviceList } from '@/hooks/useDeviceList'
import { usePhoneCameraPairing } from '@/hooks/usePhoneCameraPairing'
import {
  Camera,
  Check,
  ChevronUp,
  Copy,
  ExternalLink,
  Loader2,
  Mic,
  MicOff,
  Smartphone,
  Video,
  VideoOff,
  X,
} from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'

import { QrCode } from './QrCode'

/**
 * Video disabled placeholder
 */
export const VideoDisabledPlaceholder = memo(
  function VideoDisabledPlaceholder() {
    return (
      <div className="bg-surface-0 absolute inset-0 flex items-center justify-center">
        <div className="space-y-2 text-center">
          <VideoOff className="text-text-muted mx-auto size-12" />
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
  roomId: string
  videoEnabled: boolean
  isAudioMuted: boolean
  onToggleVideo: (enabled: boolean) => void
  onToggleAudio: () => void
}

export const LocalMediaControls = memo(function LocalMediaControls({
  roomId,
  videoEnabled,
  isAudioMuted,
  onToggleVideo,
  onToggleAudio,
}: LocalMediaControlsProps) {
  const [cameraPopoverOpen, setCameraPopoverOpen] = useState(false)
  const [micPopoverOpen, setMicPopoverOpen] = useState(false)
  const {
    mediaPreferences: {
      selectedVideoDeviceId,
      selectedVideoSource,
      selectedAudioInputDeviceId,
      setSelectedVideoDeviceId,
      setSelectedAudioInputDeviceId,
    },
  } = useMediaStreams()

  const videoDevices = useDeviceList('videoinput')
  const audioDevices = useDeviceList('audioinput')
  const {
    activePairing,
    phoneCamera,
    pairingUrl,
    status: phoneCameraStatus,
    isCreating: isCreatingPhonePairing,
    startPairing,
    cancelPairing,
    selectPhoneCamera,
  } = usePhoneCameraPairing({ roomId })
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
  const [hasCopiedPhonePairingLink, setHasCopiedPhonePairingLink] =
    useState(false)

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

  const handleStartPhoneCamera = useCallback(() => {
    setPhoneDialogOpen(true)
    setHasCopiedPhonePairingLink(false)
    void startPairing().catch((error) => {
      console.error(
        '[LocalMediaControls] Failed to start phone pairing:',
        error,
      )
    })
  }, [startPairing])

  const handlePhoneDialogOpenChange = useCallback((open: boolean) => {
    setPhoneDialogOpen(open)
    if (!open) {
      setHasCopiedPhonePairingLink(false)
    }
  }, [])

  const handleCopyPhonePairingLink = useCallback(() => {
    if (!pairingUrl) return

    void navigator.clipboard
      .writeText(pairingUrl)
      .then(() => setHasCopiedPhonePairingLink(true))
      .catch((error) => {
        console.error(
          '[LocalMediaControls] Failed to copy phone pairing link:',
          error,
        )
      })
  }, [pairingUrl])

  const handleSelectPhoneCamera = useCallback(() => {
    selectPhoneCamera()
    setCameraPopoverOpen(false)
  }, [selectPhoneCamera])

  const handleDisconnectPhoneCamera = useCallback(() => {
    void cancelPairing().catch((error) => {
      console.error(
        '[LocalMediaControls] Failed to cancel phone pairing:',
        error,
      )
    })
    setCameraPopoverOpen(false)
  }, [cancelPairing])

  useEffect(() => {
    if (
      activePairing &&
      phoneCamera?.video.track &&
      selectedVideoSource.type !== 'phone'
    ) {
      selectPhoneCamera()
    }
  }, [
    activePairing,
    phoneCamera?.video.track,
    selectedVideoSource.type,
    selectPhoneCamera,
  ])

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
    <>
      <div className="border-surface-2 bg-surface-0/95 absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm">
        {/* Video toggle with camera selector - Discord style compound button */}
        <div className="flex items-center">
          <Button
            data-testid="video-toggle-button"
            data-video-enabled={String(videoEnabled)}
            aria-pressed={videoEnabled}
            aria-label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            size="sm"
            variant={videoEnabled ? 'outline' : 'destructive'}
            onClick={() => {
              onToggleVideo(!videoEnabled)
            }}
            className={`size-10 rounded-r-none border-r-0 p-0 ${
              videoEnabled
                ? `border-surface-3 hover:bg-surface-2 text-white disabled:cursor-not-allowed disabled:opacity-50`
                : `border-destructive bg-destructive hover:bg-destructive text-white disabled:cursor-not-allowed disabled:opacity-50`
            } `}
          >
            {videoEnabled ? (
              <Video className="size-5" />
            ) : (
              <VideoOff className="size-5" />
            )}
          </Button>
          <DropdownMenu
            open={cameraPopoverOpen}
            onOpenChange={setCameraPopoverOpen}
            modal={false}
          >
            <DropdownMenuTrigger asChild>
              <Button
                data-testid="camera-device-dropdown-button"
                size="sm"
                variant={videoEnabled ? 'outline' : 'destructive'}
                aria-label="Select camera"
                className={`h-10 w-6 rounded-l-none p-0 ${
                  videoEnabled
                    ? `border-surface-3 hover:bg-surface-2 text-white`
                    : `border-destructive bg-destructive hover:bg-destructive text-white`
                } `}
              >
                <ChevronUp className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              data-testid="camera-device-dropdown"
              className="border-surface-2 bg-surface-0/95 w-80 p-0 backdrop-blur-sm"
              align="center"
              sideOffset={8}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <DropdownMenuLabel className="border-surface-2 border-b px-4 py-3">
                <h3 className="text-sm font-semibold text-white">
                  Select Camera
                </h3>
                <p className="text-text-muted text-xs">
                  {videoDevices.length} camera
                  {videoDevices.length !== 1 ? 's' : ''} available
                </p>
              </DropdownMenuLabel>
              <div className="max-h-64 overflow-y-auto p-2">
                {videoDevices.map((camera) => (
                  <DropdownMenuItem
                    key={camera.deviceId}
                    data-testid="camera-device-option"
                    onSelect={() => handleSelectCamera(camera.deviceId)}
                    className={`hover:bg-surface-2/50 focus:bg-surface-2/50 flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                      selectedVideoSource.type === 'device' &&
                      selectedVideoDeviceId === camera.deviceId
                        ? 'bg-brand/20 text-white'
                        : 'text-text-secondary'
                    } `}
                  >
                    <Camera className="size-4" />
                    <span className="text-sm">
                      {camera.label ||
                        `Camera ${videoDevices.indexOf(camera) + 1}`}
                    </span>
                  </DropdownMenuItem>
                ))}
                {isPhoneCameraPairingEnabled && (
                  <DropdownMenuItem
                    data-testid="phone-camera-option"
                    onSelect={
                      phoneCamera?.video.track
                        ? handleSelectPhoneCamera
                        : handleStartPhoneCamera
                    }
                    className={`hover:bg-surface-2/50 focus:bg-surface-2/50 flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                      selectedVideoSource.type === 'phone'
                        ? 'bg-brand/20 text-white'
                        : 'text-text-secondary'
                    } `}
                  >
                    <Smartphone className="size-4" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm">
                        {phoneCamera?.video.track
                          ? 'Phone camera'
                          : 'Connect phone camera'}
                      </span>
                      {activePairing && (
                        <span className="text-text-muted text-xs">
                          {phoneCameraStatus === 'live'
                            ? 'Connected'
                            : phoneCameraStatus === 'waiting' ||
                                phoneCameraStatus === 'claimed'
                              ? 'Waiting for phone'
                              : 'Disconnected'}
                        </span>
                      )}
                    </span>
                  </DropdownMenuItem>
                )}
                {isPhoneCameraPairingEnabled && activePairing && (
                  <DropdownMenuItem
                    data-testid="phone-camera-disconnect"
                    onSelect={handleDisconnectPhoneCamera}
                    className="hover:bg-destructive/20 focus:bg-destructive/20 text-destructive flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors"
                  >
                    <X className="size-4" />
                    <span className="text-sm">Disconnect phone camera</span>
                  </DropdownMenuItem>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Audio toggle with microphone selector - Discord style compound button */}
        <div className="flex items-center">
          <Button
            data-testid="audio-toggle-button"
            data-audio-enabled={String(!isAudioMuted)}
            aria-pressed={!isAudioMuted}
            aria-label={
              isAudioMuted ? 'Turn microphone on' : 'Turn microphone off'
            }
            size="sm"
            variant={!isAudioMuted ? 'outline' : 'destructive'}
            onClick={onToggleAudio}
            className={`size-10 rounded-r-none border-r-0 p-0 ${
              !isAudioMuted
                ? `border-surface-3 bg-surface-0/90 hover:bg-surface-2 text-white`
                : `border-destructive bg-destructive hover:bg-destructive text-white`
            } `}
          >
            {!isAudioMuted ? (
              <Mic className="size-5" />
            ) : (
              <MicOff className="size-5" />
            )}
          </Button>
          <DropdownMenu
            open={micPopoverOpen}
            onOpenChange={setMicPopoverOpen}
            modal={false}
          >
            <DropdownMenuTrigger asChild>
              <Button
                data-testid="microphone-device-dropdown-button"
                size="sm"
                variant={!isAudioMuted ? 'outline' : 'destructive'}
                aria-label="Select microphone"
                className={`h-10 w-6 rounded-l-none p-0 ${
                  !isAudioMuted
                    ? `border-surface-3 hover:bg-surface-2 text-white`
                    : `border-destructive bg-destructive hover:bg-destructive text-white`
                } `}
              >
                <ChevronUp className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              data-testid="microphone-device-dropdown"
              className="border-surface-2 bg-surface-0/95 w-80 p-0 backdrop-blur-sm"
              align="center"
              sideOffset={8}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <DropdownMenuLabel className="border-surface-2 border-b px-4 py-3">
                <h3 className="text-sm font-semibold text-white">
                  Select Microphone
                </h3>
                <p className="text-text-muted text-xs">
                  {audioDevices.length} microphone
                  {audioDevices.length !== 1 ? 's' : ''} available
                </p>
              </DropdownMenuLabel>
              <div className="max-h-64 overflow-y-auto p-2">
                {audioDevices.map((mic) => (
                  <DropdownMenuItem
                    key={mic.deviceId}
                    data-testid="microphone-device-option"
                    onSelect={() => handleSelectMicrophone(mic.deviceId)}
                    className={`hover:bg-surface-2/50 focus:bg-surface-2/50 flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                      selectedAudioInputDeviceId === mic.deviceId
                        ? 'bg-brand/20 text-white'
                        : 'text-text-secondary'
                    } `}
                  >
                    <Mic className="size-4" />
                    <span className="text-sm">
                      {mic.label ||
                        `Microphone ${audioDevices.indexOf(mic) + 1}`}
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={phoneDialogOpen} onOpenChange={handlePhoneDialogOpenChange}>
        <DialogContent className="border-surface-2 bg-surface-1 w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-[420px]">
          <DialogHeader className="border-surface-2 border-b px-5 py-4 pr-12">
            <DialogTitle className="text-white">
              Connect phone camera
            </DialogTitle>
            <DialogDescription className="text-text-muted leading-5">
              Scan this code with your phone. Keep the phone page open and
              unlocked while streaming.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 px-5 pb-5 pt-4">
            {pairingUrl ? (
              <>
                <div className="aspect-square w-full max-w-72 rounded-lg bg-white p-3 shadow-sm">
                  <QrCode value={pairingUrl} size={264} />
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPhonePairingLink}
                    className="border-surface-3 bg-surface-0/70 hover:bg-surface-2 text-white"
                  >
                    {hasCopiedPhonePairingLink ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {hasCopiedPhonePairingLink ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-surface-3 bg-surface-0/70 hover:bg-surface-2 text-white"
                  >
                    <a href={pairingUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Open link
                    </a>
                  </Button>
                </div>
              </>
            ) : (
              <div className="border-surface-2 bg-surface-2 flex aspect-square w-full max-w-72 items-center justify-center rounded-lg border">
                <Loader2 className="text-brand size-8 animate-spin" />
              </div>
            )}
            <div className="text-text-muted text-center text-sm leading-5">
              {isCreatingPhonePairing
                ? 'Creating pairing...'
                : phoneCameraStatus === 'live'
                  ? 'Phone camera is connected.'
                  : 'Waiting for your phone to connect.'}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
      className={`border-surface-2 bg-surface-0/90 absolute ${positionClasses} z-10 rounded-lg border px-3 py-2 backdrop-blur-sm`}
    >
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
})
