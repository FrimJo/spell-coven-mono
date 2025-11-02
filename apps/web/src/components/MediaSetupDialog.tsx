import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, Check, Mic, Volume2 } from 'lucide-react'

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
  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([])
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDevice[]>([])
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDevice[]>(
    [],
  )

  const [selectedVideoId, setSelectedVideoId] = useState<string>('')
  const [selectedAudioInputId, setSelectedAudioInputId] = useState<string>('')
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string>('')

  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [permissionError, setPermissionError] = useState<string>('')
  const [isTestingOutput, setIsTestingOutput] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const permissionGrantedRef = useRef<boolean>(false)

  // Enumerate devices function (extracted for reuse)
  const enumerateDevices = useCallback(
    async (requestPermission: boolean = false) => {
      try {
        // Request permissions first if needed
        if (requestPermission && !permissionGrantedRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          })
          permissionGrantedRef.current = true
          // Stop the permission stream immediately
          stream.getTracks().forEach((track) => track.stop())
        }

        // Enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices()

        const videoInputs = devices
          .filter((device) => device.kind === 'videoinput')
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
          }))

        const audioInputs = devices
          .filter((device) => device.kind === 'audioinput')
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          }))

        const audioOutputs = devices
          .filter((device) => device.kind === 'audiooutput')
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label || `Speaker ${device.deviceId.slice(0, 8)}`,
          }))

        // Find the default device to avoid showing duplicates
        const defaultDevice = audioOutputs.find((d) => d.deviceId === 'default')
        let defaultLabel = defaultDevice?.label || 'Unknown'

        // Strip "Default - " prefix if present (browser adds this to default device)
        if (defaultLabel.startsWith('Default - ')) {
          defaultLabel = defaultLabel.substring('Default - '.length)
        }

        // Filter out the specific device that matches the current default
        // to avoid showing both "Default - MacBook Pro Speakers" and "MacBook Pro Speakers"
        const filteredOutputs = audioOutputs.filter((device) => {
          if (device.deviceId === 'default') return false
          // If this device's label matches the default (with or without "Default - " prefix), it's a duplicate
          const cleanLabel = device.label.startsWith('Default - ')
            ? device.label.substring('Default - '.length)
            : device.label
          if (defaultDevice && cleanLabel === defaultLabel) return false
          return true
        })

        // Always include a "System Default" option at the top
        const outputsWithDefault = [
          {
            deviceId: 'default',
            label: `System Default${defaultLabel !== 'Unknown' ? ` (${defaultLabel})` : ''}`,
          },
          ...filteredOutputs,
        ]

        setVideoDevices(videoInputs)
        setAudioInputDevices(audioInputs)
        setAudioOutputDevices(outputsWithDefault)

        // Set defaults or validate existing selections
        if (videoInputs.length > 0 && !selectedVideoId) {
          setSelectedVideoId(videoInputs[0]!.deviceId)
        } else if (
          selectedVideoId &&
          !videoInputs.find((d) => d.deviceId === selectedVideoId)
        ) {
          // Currently selected device was disconnected, switch to first available
          setSelectedVideoId(
            videoInputs.length > 0 ? videoInputs[0]!.deviceId : '',
          )
        }

        if (audioInputs.length > 0 && !selectedAudioInputId) {
          setSelectedAudioInputId(audioInputs[0]!.deviceId)
        } else if (
          selectedAudioInputId &&
          !audioInputs.find((d) => d.deviceId === selectedAudioInputId)
        ) {
          // Currently selected device was disconnected, switch to first available
          setSelectedAudioInputId(
            audioInputs.length > 0 ? audioInputs[0]!.deviceId : '',
          )
        }

        if (!selectedAudioOutputId) {
          // Default to 'default' which follows OS audio settings
          setSelectedAudioOutputId('default')
        } else if (
          selectedAudioOutputId !== 'default' &&
          !outputsWithDefault.find((d) => d.deviceId === selectedAudioOutputId)
        ) {
          // Currently selected device was disconnected, switch to default
          setSelectedAudioOutputId('default')
        }
      } catch (error) {
        console.error('Error accessing media devices:', error)
        setPermissionError(
          'Unable to access camera or microphone. Please grant permissions and try again.',
        )
      }
    },
    [selectedVideoId, selectedAudioInputId, selectedAudioOutputId],
  )

  // Initial device enumeration
  useEffect(() => {
    if (!open) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void enumerateDevices(true)
  }, [open, enumerateDevices])

  // Listen for device changes (plug/unplug)
  useEffect(() => {
    if (!open) return

    const handleDeviceChange = () => {
      console.log(
        '[MediaSetupDialog] Device change detected, re-enumerating devices...',
      )
      void enumerateDevices(false)
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    return () => {
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        handleDeviceChange,
      )
    }
  }, [open, enumerateDevices])

  // Update video preview when video device changes
  useEffect(() => {
    if (!selectedVideoId || !videoRef.current) return

    const setupVideo = async () => {
      try {
        // Stop previous stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selectedVideoId },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
        }
      } catch (error) {
        console.error('Error setting up video preview:', error)
      }
    }

    setupVideo()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [selectedVideoId])

  // Monitor audio input level
  useEffect(() => {
    if (!selectedAudioInputId) return

    const setupAudioMonitoring = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: selectedAudioInputId },
          video: false,
        })

        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        const microphone = audioContext.createMediaStreamSource(stream)

        analyser.fftSize = 256
        microphone.connect(analyser)

        audioContextRef.current = audioContext
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const updateLevel = () => {
          if (!analyserRef.current) return

          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(Math.min(100, (average / 255) * 100 * 2)) // Amplify a bit

          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }

        updateLevel()
      } catch (error) {
        console.error('Error setting up audio monitoring:', error)
      }
    }

    setupAudioMonitoring()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [selectedAudioInputId])

  const handleTestOutput = async () => {
    setIsTestingOutput(true)

    try {
      // Create a simple test tone
      const audioContext = new AudioContext()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 440 // A4 note
      gainNode.gain.value = 0.1 // Low volume

      oscillator.start()

      setTimeout(() => {
        oscillator.stop()
        audioContext.close()
        setIsTestingOutput(false)
      }, 500)
    } catch (error) {
      console.error('Error testing audio output:', error)
      setIsTestingOutput(false)
    }
  }

  const handleComplete = () => {
    // Clean up
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    onComplete({
      videoDeviceId: selectedVideoId,
      audioInputDeviceId: selectedAudioInputId,
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

            <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
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
            </div>
          </div>

          {/* Audio Input Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-purple-400" />
              <Label className="text-slate-200">Microphone</Label>
            </div>

            <Select
              value={selectedAudioInputId}
              onValueChange={setSelectedAudioInputId}
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
                onValueChange={setSelectedAudioOutputId}
              >
                <SelectTrigger className="flex-1 border-slate-700 bg-slate-800 text-slate-200">
                  <SelectValue placeholder="Select speaker" />
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
                onClick={handleTestOutput}
                disabled={isTestingOutput || !selectedAudioOutputId}
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
