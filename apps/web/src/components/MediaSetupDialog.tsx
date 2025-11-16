import { useEffect, useRef, useState } from 'react'
import { useAudioOutput } from '@/hooks/useAudioOutput'
import { useMediaDevice } from '@/hooks/useMediaDevice'
import { AlertCircle, Camera, Check, Loader2, Mic, Volume2 } from 'lucide-react'

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

interface MediaDevice {
  deviceId: string
  label: string
}

interface MediaSetupDialogProps {
  open: boolean
  onComplete: (config: MediaConfig) => void
}

export interface MediaConfig {
  videoDeviceId: string
  audioInputDeviceId: string
  audioOutputDeviceId: string
}

export function MediaSetupDialog({ open, onComplete }: MediaSetupDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  console.log('[MediaSetupDialog] Rendering with open:', open)

  // Use our consolidated media device hook for video
  const {
    devices: videoDevices,
    currentDeviceId: selectedVideoId,
    switchDevice: switchVideoDevice,
    error: videoError,
    isActive: isVideoActive,
  } = useMediaDevice({
    kind: 'videoinput',
    videoRef,
    shouldStart: open, // Reactively start/stop when dialog opens/closes
  })

  // Use our consolidated media device hook for audio input
  const {
    devices: audioInputDevices,
    currentDeviceId: selectedAudioInputId,
    switchDevice: switchAudioInputDevice,
    stream: audioInputStream,
    error: audioInputError,
  } = useMediaDevice({
    kind: 'audioinput',
    shouldStart: open, // Reactively start/stop when dialog opens/closes
  })

  // Use our audio output hook for speakers/headphones
  const {
    devices: audioOutputDevices,
    currentDeviceId: selectedAudioOutputId,
    setOutputDevice: setAudioOutputDevice,
    testOutput: testAudioOutput,
    isTesting: isTestingOutput,
    isSupported: isAudioOutputSupported,
    error: audioOutputError,
  } = useAudioOutput({
    initialDeviceId: 'default',
  })

  const [audioLevel, setAudioLevel] = useState<number>(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Derive permission error from all error sources
  const permissionError = videoError
    ? `Unable to access selected camera: ${videoError.message}`
    : audioInputError
      ? `Unable to access selected microphone: ${audioInputError.message}`
      : audioOutputError
        ? `Audio output error: ${audioOutputError.message}`
        : ''

  // Monitor audio input level using the stream from useMediaDevice hook
  useEffect(() => {
    console.log('foobar useEffect MediaSetupDialog')
    if (!audioInputStream) return

    const setupAudioMonitoring = async () => {
      try {
        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        const microphone =
          audioContext.createMediaStreamSource(audioInputStream)

        analyser.fftSize = 256
        microphone.connect(analyser)

        audioContextRef.current = audioContext
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        let lastUpdateTime = 0
        const UPDATE_INTERVAL = 100 // Update every 100ms instead of every frame

        const updateLevel = () => {
          if (!analyserRef.current) return

          const now = Date.now()
          if (now - lastUpdateTime >= UPDATE_INTERVAL) {
            analyserRef.current.getByteFrequencyData(dataArray)
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length
            setAudioLevel(Math.min(100, (average / 255) * 100 * 2)) // Amplify a bit
            lastUpdateTime = now
          }

          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }

        updateLevel()
      } catch (error) {
        console.error('Error setting up audio monitoring:', error)
      }
    }

    void setupAudioMonitoring()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [audioInputStream])

  const handleComplete = () => {
    // Clean up audio monitoring
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // Device cleanup is handled by the useMediaDevice hooks
    // Note: Button is already disabled if devices aren't selected or there are errors
    onComplete({
      videoDeviceId: selectedVideoId!,
      audioInputDeviceId: selectedAudioInputId!,
      audioOutputDeviceId: selectedAudioOutputId,
    })
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-[700px] [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            Setup Audio & Video
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure your camera and audio devices before joining the game
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {permissionError && (
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

            <Select
              value={selectedVideoId || ''}
              onValueChange={(deviceId) => void switchVideoDevice(deviceId)}
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
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {!selectedVideoId && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Camera className="mx-auto mb-2 h-12 w-12 opacity-50" />
                    <p>No camera selected</p>
                  </div>
                </div>
              )}
              {selectedVideoId && !isVideoActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 text-slate-400">
                  <div className="text-center">
                    <Loader2 className="mx-auto mb-2 h-12 w-12 animate-spin" />
                    <p className="text-sm">Loading camera...</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Please allow camera permissions if prompted
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audio Input Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-purple-400" />
              <Label className="text-slate-200">Microphone</Label>
            </div>

            <Select
              value={selectedAudioInputId || ''}
              onValueChange={(deviceId) =>
                void switchAudioInputDevice(deviceId)
              }
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

            {/* Audio Level Indicator */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Input Level</span>
                <span>{Math.round(audioLevel)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{
                    width: `${audioLevel}%`,
                    backgroundColor:
                      audioLevel > 70
                        ? '#ef4444'
                        : audioLevel > 30
                          ? '#10b981'
                          : '#64748b',
                  }}
                />
              </div>
              <p className="text-xs text-slate-500">
                Speak into your microphone to test
              </p>
            </div>
          </div>

          {/* Audio Output Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-purple-400" />
              <Label className="text-slate-200">Speaker / Headphones</Label>
            </div>

            <div className="flex gap-2">
              <Select
                value={selectedAudioOutputId}
                onValueChange={(deviceId) =>
                  void setAudioOutputDevice(deviceId)
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
        </div>

        <DialogFooter>
          <Button
            onClick={handleComplete}
            disabled={
              !selectedVideoId || !selectedAudioInputId || !!permissionError
            }
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
