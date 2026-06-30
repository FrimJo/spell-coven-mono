import type { FocusCapabilities } from '@/hooks/useCameraFocusControls'
import type { DeclineType } from '@/lib/permission-storage'
import {
  AlertCircle,
  Camera,
  CameraOff,
  Check,
  Focus,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  X,
} from 'lucide-react'

import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Label } from '@repo/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { Slider } from '@repo/ui/components/slider'
import { Switch } from '@repo/ui/components/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { AudioLevelIndicator } from '../AudioLevelIndicator'
import { MediaPermissionInline } from '../MediaPermissionInline'

interface HeaderProps {
  hasPermissions: boolean
  onCancel: () => void
}

export function MediaSetupHeader({ hasPermissions, onCancel }: HeaderProps) {
  return (
    <div className="mb-4 flex shrink-0 items-start justify-between">
      <div>
        <h2 className="text-text-primary text-lg font-semibold">
          Setup Audio & Video
        </h2>
        <p className="text-text-muted text-sm">
          {hasPermissions
            ? 'Configure your camera and audio devices before joining the game'
            : 'Grant camera and microphone access for the best experience'}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-text-muted ring-offset-surface-1 hover:text-text-secondary focus:ring-text-muted rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
        aria-label="Close"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export function MediaSetupErrorAlert({ message }: { message: string }) {
  if (!message) {
    return null
  }

  return (
    <Alert className="border-destructive/30 bg-destructive/50 text-destructive-foreground">
      <AlertCircle className="text-destructive size-4" />
      <AlertDescription className="text-destructive-foreground/90">
        {message}
      </AlertDescription>
    </Alert>
  )
}

interface VideoSetupSectionProps {
  hasPermissions: boolean
  isCheckingPermissions: boolean
  cameraPermissionState: PermissionState | 'unknown' | 'checking'
  microphonePermissionState: PermissionState | 'unknown' | 'checking'
  videoEnabled: boolean
  selectedVideoDeviceId: string
  videoDevices: MediaDeviceInfo[]
  noVideoDevicesAvailable: boolean
  isVideoPending: boolean
  onVideoToggle: (enabled: boolean) => void
  onVideoDeviceChange: (deviceId: string) => void
  onPermissionAccept: () => Promise<void>
  onPermissionDecline: (type: DeclineType) => void
  previewRef: React.RefObject<HTMLVideoElement | null>
  focusControls?: React.ReactNode
}

export function VideoSetupSection({
  hasPermissions,
  isCheckingPermissions,
  cameraPermissionState,
  microphonePermissionState,
  videoEnabled,
  selectedVideoDeviceId,
  videoDevices,
  noVideoDevicesAvailable,
  isVideoPending,
  onVideoToggle,
  onVideoDeviceChange,
  onPermissionAccept,
  onPermissionDecline,
  previewRef,
  focusControls,
}: VideoSetupSectionProps) {
  return (
    <div className="space-y-3">
      {hasPermissions ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {videoEnabled ? (
                <Camera className="text-brand-muted-foreground size-4" />
              ) : (
                <CameraOff className="text-text-placeholder size-4" />
              )}
              <Label
                className={
                  videoEnabled ? 'text-text-secondary' : 'text-text-placeholder'
                }
              >
                Camera Source
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted text-xs">
                {videoEnabled ? 'On' : 'Off'}
              </span>
              <Switch
                checked={videoEnabled}
                onCheckedChange={onVideoToggle}
                className="data-[state=checked]:bg-brand"
              />
            </div>
          </div>

          {videoEnabled ? (
            <>
              <Select
                value={selectedVideoDeviceId || undefined}
                onValueChange={onVideoDeviceChange}
                disabled={noVideoDevicesAvailable}
              >
                <SelectTrigger className="border-border-default bg-surface-2 text-text-secondary">
                  <SelectValue
                    placeholder={
                      noVideoDevicesAvailable
                        ? 'No cameras available'
                        : 'Select camera'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="border-border-default bg-surface-2">
                  {videoDevices
                    .filter((device) => device.deviceId !== '')
                    .map((device) => (
                      <SelectItem
                        key={device.deviceId}
                        value={device.deviceId}
                        className="text-text-secondary focus:bg-surface-3"
                      >
                        {device.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <div className="border-border-default bg-surface-0 relative aspect-video max-h-[40vh] min-h-[180px] w-full overflow-hidden rounded-lg border">
                <video
                  ref={previewRef}
                  playsInline
                  muted
                  aria-label="Selected camera preview"
                  className="size-full object-cover"
                />
                {noVideoDevicesAvailable ? (
                  <div className="bg-surface-1/95 absolute inset-0 flex items-center justify-center">
                    <div className="mx-auto max-w-sm space-y-4 p-4">
                      <div className="bg-warning/20 mx-auto flex size-12 items-center justify-center rounded-full">
                        <AlertCircle className="text-warning size-6" />
                      </div>

                      <div className="text-center">
                        <h3 className="text-text-primary text-lg font-semibold">
                          No Camera Detected
                        </h3>
                        <p className="text-text-muted mt-1 text-sm">
                          Your camera may be blocked at the system level
                        </p>
                      </div>

                      <div className="border-border-default bg-surface-2/50 rounded-lg border p-3">
                        <h4 className="text-text-secondary mb-2 text-xs font-medium">
                          To enable camera access:
                        </h4>
                        <ol className="text-text-muted space-y-1.5 text-xs">
                          <li className="flex items-start gap-2">
                            <span className="bg-surface-3 text-text-secondary flex size-4 shrink-0 items-center justify-center rounded-full text-[10px]">
                              1
                            </span>
                            <span>
                              Open System Settings → Privacy &amp; Security
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-surface-3 text-text-secondary flex size-4 shrink-0 items-center justify-center rounded-full text-[10px]">
                              2
                            </span>
                            <span>Click Camera in the sidebar</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-surface-3 text-text-secondary flex size-4 shrink-0 items-center justify-center rounded-full text-[10px]">
                              3
                            </span>
                            <span>Enable access for your browser</span>
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>
                ) : isVideoPending ? (
                  <div className="bg-surface-2/50 absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center space-y-3">
                      <Loader2 className="text-brand-muted-foreground size-8 animate-spin" />
                      <p className="text-text-secondary text-sm">
                        Initializing Camera
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="border-border-default bg-surface-1 relative aspect-video overflow-hidden rounded-lg border">
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="bg-surface-2 flex size-16 items-center justify-center rounded-full">
                  <CameraOff className="text-text-placeholder size-8" />
                </div>
                <p className="text-text-muted mt-4 text-sm">
                  Camera is turned off
                </p>
                <p className="text-text-placeholder mt-1 text-xs">
                  You can join the game without sharing video
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="border-border-default bg-surface-0 aspect-video overflow-hidden rounded-lg border">
          {isCheckingPermissions ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-brand-muted-foreground size-8 animate-spin" />
            </div>
          ) : (
            <MediaPermissionInline
              onAccept={onPermissionAccept}
              onDecline={onPermissionDecline}
              permissions={{ camera: true, microphone: true }}
              blocked={{
                camera: cameraPermissionState === 'denied',
                microphone: microphonePermissionState === 'denied',
              }}
              compact={false}
            />
          )}
        </div>
      )}

      {focusControls}
    </div>
  )
}

interface FocusSectionProps {
  focusCapabilities: FocusCapabilities | null
  focusMode: string
  focusDistance: number
  isFocusSupportForced: boolean
  onFocusModeChange: (mode: string) => void
  onFocusDistanceChange: (value: number[]) => void
}

export function CameraFocusSection({
  focusCapabilities,
  focusMode,
  focusDistance,
  isFocusSupportForced,
  onFocusModeChange,
  onFocusDistanceChange,
}: FocusSectionProps) {
  return (
    <div
      className={`border-border-default bg-surface-2/50 mt-3 space-y-3 rounded-lg border p-3 ${!focusCapabilities?.supportsFocus ? 'opacity-50' : ''} `}
    >
      <div className="flex items-center gap-2">
        <Focus className="text-brand-muted-foreground size-4" />
        <Label className="text-text-secondary text-sm">Camera Focus</Label>
        {!focusCapabilities?.supportsFocus && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="bg-surface-3 text-text-muted cursor-help rounded-sm px-1.5 py-0.5 text-xs">
                Not supported
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="border-border-strong bg-surface-2 text-text-secondary max-w-[200px] border"
            >
              This camera doesn&apos;t support focus control. Try using an
              external webcam like Logitech C920/C922.
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select
                value={focusMode}
                onValueChange={onFocusModeChange}
                disabled={!focusCapabilities?.supportsFocus}
              >
                <SelectTrigger
                  className={`border-border-strong bg-surface-3 text-text-secondary w-[140px] text-sm ${
                    !focusCapabilities?.supportsFocus
                      ? 'cursor-not-allowed'
                      : ''
                  } `}
                >
                  <SelectValue placeholder="Focus mode" />
                </SelectTrigger>
                <SelectContent className="border-border-default bg-surface-2">
                  {focusCapabilities?.focusModes.includes('continuous') && (
                    <SelectItem
                      value="continuous"
                      className="text-text-secondary focus:bg-surface-3"
                    >
                      Auto (Continuous)
                    </SelectItem>
                  )}
                  {focusCapabilities?.focusModes.includes('single-shot') && (
                    <SelectItem
                      value="single-shot"
                      className="text-text-secondary focus:bg-surface-3"
                    >
                      Auto (Single)
                    </SelectItem>
                  )}
                  {focusCapabilities?.focusModes.includes('manual') && (
                    <SelectItem
                      value="manual"
                      className="text-text-secondary focus:bg-surface-3"
                    >
                      Manual
                    </SelectItem>
                  )}
                  {!focusCapabilities?.supportsFocus && (
                    <>
                      <SelectItem
                        value="continuous"
                        className="text-text-secondary focus:bg-surface-3"
                      >
                        Auto (Continuous)
                      </SelectItem>
                      <SelectItem
                        value="manual"
                        className="text-text-secondary focus:bg-surface-3"
                      >
                        Manual
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          {!focusCapabilities?.supportsFocus && (
            <TooltipContent
              side="bottom"
              className="border-border-strong bg-surface-2 text-text-secondary border"
            >
              Focus control not supported by this camera
            </TooltipContent>
          )}
        </Tooltip>

        {focusCapabilities?.supportsFocus &&
          focusMode === 'manual' &&
          focusCapabilities.focusDistance && (
            <div className="flex flex-1 items-center gap-3">
              <span className="text-text-muted text-xs">Near</span>
              <Slider
                value={[focusDistance]}
                onValueChange={onFocusDistanceChange}
                min={focusCapabilities.focusDistance.min}
                max={focusCapabilities.focusDistance.max}
                step={focusCapabilities.focusDistance.step}
                className="**:data-[slot=slider-range]:bg-brand **:data-[slot=slider-thumb]:border-brand **:data-[slot=slider-track]:h-2 **:data-[slot=slider-track]:bg-border-strong flex-1"
              />
              <span className="text-text-muted text-xs">Far</span>
            </div>
          )}
      </div>

      <p className="text-text-placeholder text-xs">
        {!focusCapabilities?.supportsFocus
          ? 'Focus control is not available for this camera'
          : focusMode === 'manual'
            ? 'Adjust the slider to focus on your cards'
            : 'Camera will automatically adjust focus'}
      </p>
      {isFocusSupportForced && (
        <p className="text-warning text-xs">
          Browser didn&apos;t report focus support for this camera. Trying focus
          controls anyway.
        </p>
      )}
    </div>
  )
}

interface AudioInputSectionProps {
  audioEnabled: boolean
  selectedAudioInputDeviceId: string
  audioInputDevices: MediaDeviceInfo[]
  isAudioInputPending: boolean
  audioInputStream?: MediaStream
  onAudioToggle: (enabled: boolean) => void
  onAudioInputChange: (deviceId: string) => void
}

export function AudioInputSection({
  audioEnabled,
  selectedAudioInputDeviceId,
  audioInputDevices,
  isAudioInputPending,
  audioInputStream,
  onAudioToggle,
  onAudioInputChange,
}: AudioInputSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {audioEnabled ? (
            <Mic className="text-brand-muted-foreground size-4" />
          ) : (
            <MicOff className="text-text-placeholder size-4" />
          )}
          <Label
            className={
              audioEnabled ? 'text-text-secondary' : 'text-text-placeholder'
            }
          >
            Microphone
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs">
            {audioEnabled ? 'On' : 'Off'}
          </span>
          <Switch
            checked={audioEnabled}
            onCheckedChange={onAudioToggle}
            className="data-[state=checked]:bg-brand"
          />
        </div>
      </div>

      {audioEnabled ? (
        <>
          <div className="relative">
            <Select
              value={selectedAudioInputDeviceId || undefined}
              onValueChange={onAudioInputChange}
              disabled={isAudioInputPending}
            >
              <SelectTrigger className="border-border-default bg-surface-2 text-text-secondary">
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent className="border-border-default bg-surface-2">
                {audioInputDevices
                  .filter((device) => device.deviceId !== '')
                  .map((device) => (
                    <SelectItem
                      key={device.deviceId}
                      value={device.deviceId}
                      className="text-text-secondary focus:bg-surface-3"
                    >
                      {device.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {isAudioInputPending && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <Loader2 className="text-brand-muted-foreground size-4 animate-spin" />
              </div>
            )}
          </div>

          <AudioLevelIndicator audioStream={audioInputStream} />
        </>
      ) : (
        <div className="border-border-default bg-surface-1 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="bg-surface-2 flex size-10 items-center justify-center rounded-full">
              <MicOff className="text-text-placeholder size-5" />
            </div>
            <div>
              <p className="text-text-muted text-sm">
                Microphone is turned off
              </p>
              <p className="text-text-placeholder text-xs">
                You can join the game without sending audio
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface AudioOutputSectionProps {
  selectedAudioOutputDeviceId: string
  audioOutputDevices: Array<Pick<MediaDeviceInfo, 'deviceId' | 'label'>>
  isAudioOutputSupported: boolean
  isTestingOutput: boolean
  onAudioOutputChange: (deviceId: string) => void | Promise<void>
  onTestOutput: () => Promise<void>
}

export function AudioOutputSection({
  selectedAudioOutputDeviceId,
  audioOutputDevices,
  isAudioOutputSupported,
  isTestingOutput,
  onAudioOutputChange,
  onTestOutput,
}: AudioOutputSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Volume2 className="text-brand-muted-foreground size-4" />
        <Label className="text-text-secondary">Speaker / Headphones</Label>
      </div>

      <div className="flex gap-2">
        <Select
          value={selectedAudioOutputDeviceId || undefined}
          onValueChange={(deviceId) => void onAudioOutputChange(deviceId)}
          disabled={!isAudioOutputSupported}
        >
          <SelectTrigger className="border-border-default bg-surface-2 text-text-secondary flex-1">
            <SelectValue
              placeholder={
                isAudioOutputSupported
                  ? 'Select speaker'
                  : 'Not supported in this browser'
              }
            />
          </SelectTrigger>
          <SelectContent className="border-border-default bg-surface-2">
            {audioOutputDevices
              .filter((device) => device.deviceId !== '')
              .map((device) => (
                <SelectItem
                  key={device.deviceId}
                  value={device.deviceId}
                  className="text-text-secondary focus:bg-surface-3"
                >
                  {device.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => void onTestOutput()}
          disabled={
            isTestingOutput ||
            !selectedAudioOutputDeviceId ||
            !isAudioOutputSupported
          }
          className="border-border-default bg-surface-2 hover:bg-surface-3"
        >
          {isTestingOutput ? 'Playing...' : 'Test'}
        </Button>
      </div>

      <p className="text-text-placeholder text-xs">
        Click &quot;Test&quot; to play a short sound
      </p>
    </div>
  )
}

interface FooterProps {
  canComplete: boolean
  onCancel: () => void
  onComplete: () => void
}

export function MediaSetupFooter({
  canComplete,
  onCancel,
  onComplete,
}: FooterProps) {
  return (
    <div className="mt-6 flex shrink-0 justify-between gap-2">
      <Button
        variant="ghost"
        onClick={onCancel}
        className="text-text-muted hover:text-text-secondary"
        data-testid="media-setup-cancel-button"
      >
        <X className="mr-2 size-4" />
        Cancel
      </Button>

      <Button
        onClick={onComplete}
        disabled={!canComplete}
        className="bg-brand hover:bg-brand text-white"
        data-testid="media-setup-complete-button"
      >
        <Check className="mr-2 size-4" />
        Complete Setup
      </Button>
    </div>
  )
}
