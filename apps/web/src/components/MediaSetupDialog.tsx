import type { UseAudioOutputOptions } from '@/hooks/useAudioOutput'
import type { UseMediaDeviceOptions } from '@/hooks/useMediaDevice'
import { useMemo, useRef } from 'react'
import { useAudioOutput } from '@/hooks/useAudioOutput'
import { useMediaDevice } from '@/hooks/useMediaDevice'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { attachVideoStream } from '@/lib/video-stream-utils'
import {
  AlertCircle,
  Camera,
  Check,
  Loader2,
  Mic,
  SkipForward,
  Volume2,
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

import { AudioLevelIndicator } from './AudioLevelIndicator'
import { MediaPermissionInline } from './MediaPermissionInline'

interface MediaSetupDialogProps {
  open: boolean
  onComplete: () => void
}

export function MediaSetupDialog({ open, onComplete }: MediaSetupDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Check media permissions
  const {
    camera: cameraPermission,
    microphone: microphonePermission,
    isChecking: isCheckingPermissions,
    recheckPermissions,
  } = useMediaPermissions()

  // Determine permission state
  const hasPermissions =
    !isCheckingPermissions &&
    cameraPermission.browserState === 'granted' &&
    microphonePermission.browserState === 'granted'

  // Memoize hook options to prevent infinite renders from recreated objects
  const videoDeviceOptions = useMemo<UseMediaDeviceOptions>(
    () => ({
      kind: 'videoinput',
      onDeviceChanged: (_deviceId: string, stream: MediaStream) => {
        attachVideoStream(videoRef.current, stream)
      },
    }),
    [],
  )

  const audioInputDeviceOptions = useMemo<UseMediaDeviceOptions>(
    () => ({ kind: 'audioinput' }),
    [],
  )

  const audioOutputOptions = useMemo<UseAudioOutputOptions>(
    () => ({ initialDeviceId: 'default' }),
    [],
  )

  // Use our consolidated media device hook for video
  const {
    devices: videoDevices,
    selectedDeviceId: selectedVideoId,
    error: videoError,
    isPending: isVideoPending,
    saveSelectedDevice: switchVideoDevice,
  } = useMediaDevice(videoDeviceOptions)

  // Use our consolidated media device hook for audio input
  const {
    devices: audioInputDevices,
    selectedDeviceId: selectedAudioInputId,
    stream: audioInputStream,
    error: audioInputError,
    isPending: isAudioInputPending,
    saveSelectedDevice: switchAudioInputDevice,
  } = useMediaDevice(audioInputDeviceOptions)

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
            <Alert variant="destructive" className="border-red-900 bg-red-950">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{permissionError}</AlertDescription>
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
                    {videoDevices.map((device) => (
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
                    ref={videoRef}
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
                    {audioInputDevices.map((device) => (
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
                    {audioOutputDevices.map((device) => (
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

        <DialogFooter className="flex-row gap-2 sm:justify-between">
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
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Check className="mr-2 h-4 w-4" />
            Complete Setup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
