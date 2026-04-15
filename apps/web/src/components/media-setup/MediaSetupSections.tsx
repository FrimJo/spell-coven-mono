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
        <h2 className="text-lg font-semibold text-text-primary">
          Setup Audio & Video
        </h2>
        <p className="text-sm text-text-muted">
          {hasPermissions
            ? 'Configure your camera and audio devices before joining the game'
            : 'Grant camera and microphone access for the best experience'}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="rounded-sm text-text-muted opacity-70 ring-offset-surface-1 transition-opacity hover:text-text-secondary hover:opacity-100 focus:ring-2 focus:ring-text-muted focus:ring-offset-2 focus:outline-none"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
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
      <AlertCircle className="h-4 w-4 text-destructive" />
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
            <div className="gap-2 flex items-center">
              {videoEnabled ? (
                <Camera className="h-4 w-4 text-brand-muted-foreground" />
              ) : (
                <CameraOff className="h-4 w-4 text-text-placeholder" />
              )}
              <Label
                className={
                  videoEnabled ? 'text-text-secondary' : 'text-text-placeholder'
                }
              >
                Camera Source
              </Label>
            </div>
            <div className="gap-2 flex items-center">
              <span className="text-xs text-text-muted">
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

              <div className="aspect-video relative max-h-[40vh] min-h-[180px] w-full overflow-hidden rounded-lg border border-border-default bg-surface-0">
                <video
                  ref={previewRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {noVideoDevicesAvailable ? (
                  <div className="inset-0 absolute flex items-center justify-center bg-surface-1/95">
                    <div className="max-w-sm space-y-4 p-4 mx-auto">
                      <div className="h-12 w-12 mx-auto flex items-center justify-center rounded-full bg-warning/20">
                        <AlertCircle className="h-6 w-6 text-warning" />
                      </div>

                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-text-primary">
                          No Camera Detected
                        </h3>
                        <p className="mt-1 text-sm text-text-muted">
                          Your camera may be blocked at the system level
                        </p>
                      </div>

                      <div className="p-3 rounded-lg border border-border-default bg-surface-2/50">
                        <h4 className="mb-2 text-xs font-medium text-text-secondary">
                          To enable camera access:
                        </h4>
                        <ol className="space-y-1.5 text-xs text-text-muted">
                          <li className="gap-2 flex items-start">
                            <span className="h-4 w-4 flex shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] text-text-secondary">
                              1
                            </span>
                            <span>
                              Open System Settings → Privacy &amp; Security
                            </span>
                          </li>
                          <li className="gap-2 flex items-start">
                            <span className="h-4 w-4 flex shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] text-text-secondary">
                              2
                            </span>
                            <span>Click Camera in the sidebar</span>
                          </li>
                          <li className="gap-2 flex items-start">
                            <span className="h-4 w-4 flex shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] text-text-secondary">
                              3
                            </span>
                            <span>Enable access for your browser</span>
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>
                ) : isVideoPending ? (
                  <div className="inset-0 absolute flex items-center justify-center bg-surface-2/50">
                    <div className="space-y-3 flex flex-col items-center">
                      <Loader2 className="h-8 w-8 animate-spin text-brand-muted-foreground" />
                      <p className="text-sm text-text-secondary">
                        Initializing Camera
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="aspect-video relative overflow-hidden rounded-lg border border-border-default bg-surface-1">
              <div className="inset-0 absolute flex flex-col items-center justify-center">
                <div className="h-16 w-16 flex items-center justify-center rounded-full bg-surface-2">
                  <CameraOff className="h-8 w-8 text-text-placeholder" />
                </div>
                <p className="mt-4 text-sm text-text-muted">
                  Camera is turned off
                </p>
                <p className="mt-1 text-xs text-text-placeholder">
                  You can join the game without sharing video
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="aspect-video overflow-hidden rounded-lg border border-border-default bg-surface-0">
          {isCheckingPermissions ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-muted-foreground" />
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
      className={`mt-3 space-y-3 p-3 rounded-lg border border-border-default bg-surface-2/50 ${
        !focusCapabilities?.supportsFocus ? 'opacity-50' : ''
      }`}
    >
      <div className="gap-2 flex items-center">
        <Focus className="h-4 w-4 text-brand-muted-foreground" />
        <Label className="text-sm text-text-secondary">Camera Focus</Label>
        {!focusCapabilities?.supportsFocus && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="rounded px-1.5 py-0.5 text-xs cursor-help bg-surface-3 text-text-muted">
                Not supported
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-[200px] border border-border-strong bg-surface-2 text-text-secondary"
            >
              This camera doesn&apos;t support focus control. Try using an
              external webcam like Logitech C920/C922.
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="gap-3 flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select
                value={focusMode}
                onValueChange={onFocusModeChange}
                disabled={!focusCapabilities?.supportsFocus}
              >
                <SelectTrigger
                  className={`text-sm w-[140px] border-border-strong bg-surface-3 text-text-secondary ${
                    !focusCapabilities?.supportsFocus
                      ? 'cursor-not-allowed'
                      : ''
                  }`}
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
              className="border border-border-strong bg-surface-2 text-text-secondary"
            >
              Focus control not supported by this camera
            </TooltipContent>
          )}
        </Tooltip>

        {focusCapabilities?.supportsFocus &&
          focusMode === 'manual' &&
          focusCapabilities.focusDistance && (
            <div className="gap-3 flex flex-1 items-center">
              <span className="text-xs text-text-muted">Near</span>
              <Slider
                value={[focusDistance]}
                onValueChange={onFocusDistanceChange}
                min={focusCapabilities.focusDistance.min}
                max={focusCapabilities.focusDistance.max}
                step={focusCapabilities.focusDistance.step}
                className="[&_[data-slot=slider-track]]:h-2 flex-1 [&_[data-slot=slider-range]]:bg-brand [&_[data-slot=slider-thumb]]:border-brand [&_[data-slot=slider-track]]:bg-border-strong"
              />
              <span className="text-xs text-text-muted">Far</span>
            </div>
          )}
      </div>

      <p className="text-xs text-text-placeholder">
        {!focusCapabilities?.supportsFocus
          ? 'Focus control is not available for this camera'
          : focusMode === 'manual'
            ? 'Adjust the slider to focus on your cards'
            : 'Camera will automatically adjust focus'}
      </p>
      {isFocusSupportForced && (
        <p className="text-xs text-warning">
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
        <div className="gap-2 flex items-center">
          {audioEnabled ? (
            <Mic className="h-4 w-4 text-brand-muted-foreground" />
          ) : (
            <MicOff className="h-4 w-4 text-text-placeholder" />
          )}
          <Label
            className={
              audioEnabled ? 'text-text-secondary' : 'text-text-placeholder'
            }
          >
            Microphone
          </Label>
        </div>
        <div className="gap-2 flex items-center">
          <span className="text-xs text-text-muted">
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
              <div className="right-10 absolute top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-brand-muted-foreground" />
              </div>
            )}
          </div>

          <AudioLevelIndicator audioStream={audioInputStream} />
        </>
      ) : (
        <div className="p-4 rounded-lg border border-border-default bg-surface-1">
          <div className="gap-3 flex items-center">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-surface-2">
              <MicOff className="h-5 w-5 text-text-placeholder" />
            </div>
            <div>
              <p className="text-sm text-text-muted">
                Microphone is turned off
              </p>
              <p className="text-xs text-text-placeholder">
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
      <div className="gap-2 flex items-center">
        <Volume2 className="h-4 w-4 text-brand-muted-foreground" />
        <Label className="text-text-secondary">Speaker / Headphones</Label>
      </div>

      <div className="gap-2 flex">
        <Select
          value={selectedAudioOutputDeviceId || undefined}
          onValueChange={(deviceId) => void onAudioOutputChange(deviceId)}
          disabled={!isAudioOutputSupported}
        >
          <SelectTrigger className="flex-1 border-border-default bg-surface-2 text-text-secondary">
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

      <p className="text-xs text-text-placeholder">
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
    <div className="mt-6 gap-2 flex shrink-0 justify-between">
      <Button
        variant="ghost"
        onClick={onCancel}
        className="text-text-muted hover:text-text-secondary"
        data-testid="media-setup-cancel-button"
      >
        <X className="mr-2 h-4 w-4" />
        Cancel
      </Button>

      <Button
        onClick={onComplete}
        disabled={!canComplete}
        className="text-white bg-brand hover:bg-brand"
        data-testid="media-setup-complete-button"
      >
        <Check className="mr-2 h-4 w-4" />
        Complete Setup
      </Button>
    </div>
  )
}
