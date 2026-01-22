import type { UseAudioOutputOptions } from '@/hooks/useAudioOutput'
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { useAudioOutput } from '@/hooks/useAudioOutput'
import { attachVideoStream } from '@/lib/video-stream-utils'
import { isSuccessState } from '@/types/async-resource'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Camera,
  Check,
  Focus,
  Loader2,
  Mic,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react'

import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import { Label } from '@repo/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { Slider } from '@repo/ui/components/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { AudioLevelIndicator } from './AudioLevelIndicator'
import { MediaPermissionInline } from './MediaPermissionInline'

interface MediaSetupDialogProps {
  open: boolean
  onComplete: () => void
}

// Focus control state
interface FocusCapabilities {
  supportsFocus: boolean
  focusModes: string[]
  focusDistance?: { min: number; max: number; step: number }
  initialFocusMode?: string
  initialFocusDistance?: number
}

export function MediaSetupDialog({ open, onComplete }: MediaSetupDialogProps) {
  const queryClient = useQueryClient()

  // Get streams from context (shared with VideoStreamGrid)
  const {
    video: videoResult,
    audio: audioResult,
    permissions: {
      camera: cameraPermission,
      microphone: microphonePermission,
      isChecking: isCheckingPermissions,
      permissionsGranted: hasPermissions,
      recheckPermissions,
    },
  } = useMediaStreams()

  // Extract video device info
  const videoDevices = videoResult.devices
  const selectedVideoId = videoResult.selectedDeviceId
  const videoError = videoResult.error
  const isVideoPending = videoResult.isPending
  const switchVideoDevice = videoResult.saveSelectedDevice

  // Extract audio device info
  const audioInputDevices = audioResult.devices
  const selectedAudioInputId = audioResult.selectedDeviceId
  const audioInputStream = isSuccessState(audioResult)
    ? audioResult.stream
    : undefined
  const audioInputError = audioResult.error
  const isAudioInputPending = audioResult.isPending
  const switchAudioInputDevice = audioResult.saveSelectedDevice

  // Callback ref to attach stream when video element mounts
  // This is more reliable than useEffect because it fires exactly when the DOM element appears
  const videoRefCallback = useCallback(
    (videoElement: HTMLVideoElement | null) => {
      if (videoElement && isSuccessState(videoResult) && videoResult.stream) {
        attachVideoStream(videoElement, videoResult.stream)
      }
    },
    [videoResult],
  )

  const audioOutputOptions = useMemo<UseAudioOutputOptions>(
    () => ({ initialDeviceId: 'default' }),
    [],
  )

  const [focusMode, setFocusMode] = useState<string>('continuous')
  const [focusDistance, setFocusDistance] = useState<number>(0.5)
  const lastInitializedTrackIdRef = useRef<string | null>(null)

  // Derive focus capabilities from video track (computed, not effect-based)
  const focusCapabilities = useMemo((): FocusCapabilities | null => {
    if (!isSuccessState(videoResult) || !videoResult.stream) {
      return null
    }

    const videoTrack = videoResult.stream.getVideoTracks()[0]
    if (!videoTrack) {
      return null
    }

    try {
      const capabilities =
        videoTrack.getCapabilities() as MediaTrackCapabilities & {
          focusMode?: string[]
          focusDistance?: { min: number; max: number; step: number }
        }
      const settings = videoTrack.getSettings() as MediaTrackSettings & {
        focusMode?: string
        focusDistance?: number
      }

      if (capabilities.focusMode && capabilities.focusMode.length > 0) {
        return {
          supportsFocus: true,
          focusModes: capabilities.focusMode,
          focusDistance: capabilities.focusDistance,
          initialFocusMode: settings.focusMode,
          initialFocusDistance:
            settings.focusDistance ??
            (capabilities.focusDistance
              ? (capabilities.focusDistance.min +
                  capabilities.focusDistance.max) /
                2
              : undefined),
        }
      } else {
        return { supportsFocus: false, focusModes: [] }
      }
    } catch {
      return { supportsFocus: false, focusModes: [] }
    }
  }, [videoResult])

  // Effect Event for initializing focus settings - reads latest focusCapabilities
  // without making it a reactive dependency of the effect
  const onFocusTrackChanged = useEffectEvent(
    (capabilities: FocusCapabilities | null) => {
      if (capabilities?.supportsFocus) {
        if (capabilities.initialFocusMode) {
          setFocusMode(capabilities.initialFocusMode)
        }
        if (capabilities.initialFocusDistance !== undefined) {
          setFocusDistance(capabilities.initialFocusDistance)
        }
      }
    },
  )

  // Initialize focus mode/distance from camera settings when track changes
  useEffect(() => {
    if (!isSuccessState(videoResult) || !videoResult.stream) {
      lastInitializedTrackIdRef.current = null
      return
    }

    const videoTrack = videoResult.stream.getVideoTracks()[0]
    const currentTrackId = videoTrack?.id ?? null

    if (
      currentTrackId &&
      currentTrackId !== lastInitializedTrackIdRef.current
    ) {
      lastInitializedTrackIdRef.current = currentTrackId
      // Call Effect Event to sync initial focus settings from camera
      onFocusTrackChanged(focusCapabilities)
    }
  }, [videoResult, focusCapabilities])

  // Apply focus constraints to the video track
  const applyFocusConstraints = useCallback(
    async (mode: string, distance?: number) => {
      if (!isSuccessState(videoResult) || !videoResult.stream) return

      const videoTrack = videoResult.stream.getVideoTracks()[0]
      if (!videoTrack) return

      try {
        const constraints: MediaTrackConstraints & {
          advanced?: Array<{ focusMode?: string; focusDistance?: number }>
        } = {
          advanced: [{ focusMode: mode }],
        }

        if (mode === 'manual' && distance !== undefined) {
          constraints.advanced = [{ focusMode: mode, focusDistance: distance }]
        }

        await videoTrack.applyConstraints(constraints)
      } catch (error) {
        console.warn('Failed to apply focus constraints:', error)
      }
    },
    [videoResult],
  )

  // Handle focus mode change
  const handleFocusModeChange = useCallback(
    (mode: string) => {
      setFocusMode(mode)
      void applyFocusConstraints(
        mode,
        mode === 'manual' ? focusDistance : undefined,
      )
    },
    [applyFocusConstraints, focusDistance],
  )

  // Handle focus distance change
  const handleFocusDistanceChange = useCallback(
    (value: number[]) => {
      const distance = value[0]
      if (distance === undefined) return
      setFocusDistance(distance)
      void applyFocusConstraints('manual', distance)
    },
    [applyFocusConstraints],
  )

  // Use our audio output hook for speakers/headphones
  const {
    devices: audioOutputDevices,
    currentDeviceId: selectedAudioOutputId,
    testOutput: testAudioOutput,
    isTesting: isTestingOutput,
    isSupported: isAudioOutputSupported,
    error: audioOutputError,
    setOutputDevice: switchAudioOutputDevice,
  } = useAudioOutput(audioOutputOptions)

  // Derive permission error from all error sources
  const permissionError = videoError
    ? `Unable to access selected camera: ${videoError.message}`
    : audioInputError
      ? `Unable to access selected microphone: ${audioInputError.message}`
      : audioOutputError
        ? `Audio output error: ${audioOutputError.message}`
        : ''

  const handleComplete = () => {
    onComplete()
  }

  const handleSkip = () => {
    // Allow user to skip setup and continue without camera/microphone
    onComplete()
  }

  const handlePermissionAccept = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      stream.getTracks().forEach((track) => track.stop())

      // Invalidate the media devices query so it re-enumerates with real device IDs
      // (Before permission, enumerateDevices returns devices with empty deviceId)
      await queryClient.invalidateQueries({ queryKey: ['MediaDevices'] })

      await recheckPermissions()
    } catch {
      await recheckPermissions()
    }
  }

  const handlePermissionDecline = () => {
    // User declined - they can still continue without camera/microphone
    // No action needed, the UI will update
  }

  // Check if setup can be completed (has working devices)
  const canComplete =
    hasPermissions &&
    selectedVideoId &&
    selectedAudioInputId &&
    !permissionError

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-[700px] [&>button]:hidden">
        <div className="absolute right-4 top-4">
          <button
            onClick={handleSkip}
            className="rounded-sm text-slate-400 opacity-70 ring-offset-slate-900 transition-opacity hover:text-slate-300 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            Setup Audio & Video
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {hasPermissions
              ? 'Configure your camera and audio devices before joining the game'
              : 'Grant camera and microphone access for the best experience'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {permissionError && hasPermissions && (
            <Alert className="border-red-500/30 bg-red-950/50 text-red-200">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-200/90">
                {permissionError}
              </AlertDescription>
            </Alert>
          )}

          {/* Video Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-purple-400" />
              <Label className="text-slate-200">Camera Source</Label>
            </div>

            {hasPermissions ? (
              <>
                <Select
                  value={selectedVideoId}
                  onValueChange={(deviceId) => switchVideoDevice(deviceId)}
                >
                  <SelectTrigger className="border-slate-700 bg-slate-800 text-slate-200">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-800">
                    {videoDevices
                      .filter((device) => device.deviceId !== '')
                      .map((device) => (
                        <SelectItem
                          key={device.deviceId}
                          value={device.deviceId}
                          className="text-slate-200 focus:bg-slate-700"
                        >
                          {device.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {/* Video Preview */}
                <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                  <video
                    ref={videoRefCallback}
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  {isVideoPending && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50">
                      <div className="flex flex-col items-center space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                        <p className="text-sm text-slate-200">
                          Initializing Camera
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Show inline permission UI in video preview area */
              <div className="aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                {isCheckingPermissions ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                  </div>
                ) : (
                  <MediaPermissionInline
                    onAccept={handlePermissionAccept}
                    onDecline={handlePermissionDecline}
                    permissions={{ camera: true, microphone: true }}
                    blocked={{
                      camera: cameraPermission.browserState === 'denied',
                      microphone:
                        microphonePermission.browserState === 'denied',
                    }}
                    compact={false}
                  />
                )}
              </div>
            )}

            {/* Focus Control - always show when permissions granted */}
            {hasPermissions && (
              <div
                className={`mt-3 space-y-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3 ${
                  !focusCapabilities?.supportsFocus ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <Focus className="h-4 w-4 text-purple-400" />
                  <Label className="text-sm text-slate-200">Camera Focus</Label>
                  {!focusCapabilities?.supportsFocus && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
                          Not supported
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-[200px] border border-slate-600 bg-slate-800 text-slate-200"
                      >
                        This camera doesn&apos;t support focus control. Try
                        using an external webcam like Logitech C920/C922.
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
                          onValueChange={handleFocusModeChange}
                          disabled={!focusCapabilities?.supportsFocus}
                        >
                          <SelectTrigger
                            className={`w-[140px] border-slate-600 bg-slate-700 text-sm text-slate-200 ${
                              !focusCapabilities?.supportsFocus
                                ? 'cursor-not-allowed'
                                : ''
                            }`}
                          >
                            <SelectValue placeholder="Focus mode" />
                          </SelectTrigger>
                          <SelectContent className="border-slate-700 bg-slate-800">
                            {focusCapabilities?.focusModes.includes(
                              'continuous',
                            ) && (
                              <SelectItem
                                value="continuous"
                                className="text-slate-200 focus:bg-slate-700"
                              >
                                Auto (Continuous)
                              </SelectItem>
                            )}
                            {focusCapabilities?.focusModes.includes(
                              'single-shot',
                            ) && (
                              <SelectItem
                                value="single-shot"
                                className="text-slate-200 focus:bg-slate-700"
                              >
                                Auto (Single)
                              </SelectItem>
                            )}
                            {focusCapabilities?.focusModes.includes(
                              'manual',
                            ) && (
                              <SelectItem
                                value="manual"
                                className="text-slate-200 focus:bg-slate-700"
                              >
                                Manual
                              </SelectItem>
                            )}
                            {/* Show placeholder options when not supported */}
                            {!focusCapabilities?.supportsFocus && (
                              <>
                                <SelectItem
                                  value="continuous"
                                  className="text-slate-200 focus:bg-slate-700"
                                >
                                  Auto (Continuous)
                                </SelectItem>
                                <SelectItem
                                  value="manual"
                                  className="text-slate-200 focus:bg-slate-700"
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
                        className="border border-slate-600 bg-slate-800 text-slate-200"
                      >
                        Focus control not supported by this camera
                      </TooltipContent>
                    )}
                  </Tooltip>

                  {/* Focus Distance Slider - only show in manual mode when supported */}
                  {focusCapabilities?.supportsFocus &&
                    focusMode === 'manual' &&
                    focusCapabilities.focusDistance && (
                      <div className="flex flex-1 items-center gap-3">
                        <span className="text-xs text-slate-400">Near</span>
                        <Slider
                          value={[focusDistance]}
                          onValueChange={handleFocusDistanceChange}
                          min={focusCapabilities.focusDistance.min}
                          max={focusCapabilities.focusDistance.max}
                          step={focusCapabilities.focusDistance.step}
                          className="flex-1 [&_[data-slot=slider-range]]:bg-purple-500 [&_[data-slot=slider-thumb]]:border-purple-500 [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-slate-600"
                        />
                        <span className="text-xs text-slate-400">Far</span>
                      </div>
                    )}
                </div>

                <p className="text-xs text-slate-500">
                  {!focusCapabilities?.supportsFocus
                    ? 'Focus control is not available for this camera'
                    : focusMode === 'manual'
                      ? 'Adjust the slider to focus on your cards'
                      : 'Camera will automatically adjust focus'}
                </p>
              </div>
            )}
          </div>

          {/* Audio Input Section - only show if has permissions */}
          {hasPermissions && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-purple-400" />
                <Label className="text-slate-200">Microphone</Label>
              </div>

              <div className="relative">
                <Select
                  value={selectedAudioInputId}
                  onValueChange={(deviceId) =>
                    void switchAudioInputDevice(deviceId)
                  }
                  disabled={isAudioInputPending}
                >
                  <SelectTrigger className="border-slate-700 bg-slate-800 text-slate-200">
                    <SelectValue placeholder="Select microphone" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-800">
                    {audioInputDevices
                      .filter((device) => device.deviceId !== '')
                      .map((device) => (
                        <SelectItem
                          key={device.deviceId}
                          value={device.deviceId}
                          className="text-slate-200 focus:bg-slate-700"
                        >
                          {device.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {isAudioInputPending && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                  </div>
                )}
              </div>

              {/* Audio Level Indicator */}
              <AudioLevelIndicator audioStream={audioInputStream} />
            </div>
          )}

          {/* Audio Output Section - only show if has permissions */}
          {hasPermissions && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-purple-400" />
                <Label className="text-slate-200">Speaker / Headphones</Label>
              </div>

              <div className="flex gap-2">
                <Select
                  value={selectedAudioOutputId}
                  onValueChange={(deviceId) =>
                    void switchAudioOutputDevice(deviceId)
                  }
                  disabled={!isAudioOutputSupported}
                >
                  <SelectTrigger className="flex-1 border-slate-700 bg-slate-800 text-slate-200">
                    <SelectValue
                      placeholder={
                        isAudioOutputSupported
                          ? 'Select speaker'
                          : 'Not supported in this browser'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-800">
                    {audioOutputDevices
                      .filter((device) => device.deviceId !== '')
                      .map((device) => (
                        <SelectItem
                          key={device.deviceId}
                          value={device.deviceId}
                          className="text-slate-200 focus:bg-slate-700"
                        >
                          {device.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={() => void testAudioOutput()}
                  disabled={
                    isTestingOutput ||
                    !selectedAudioOutputId ||
                    !isAudioOutputSupported
                  }
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700"
                >
                  {isTestingOutput ? 'Playing...' : 'Test'}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Click &quot;Test&quot; to play a short sound
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-slate-400 hover:text-slate-300"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            Skip for now
          </Button>

          <Button
            onClick={handleComplete}
            disabled={!canComplete}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            <Check className="mr-2 h-4 w-4" />
            Complete Setup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
