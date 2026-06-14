import { useEffect, useRef, useState } from 'react'

interface AudioLevelIndicatorProps {
  audioStream: MediaStream | null | undefined
}

export const AudioLevelIndicator = ({
  audioStream,
}: AudioLevelIndicatorProps) => {
  const [audioLevel, setAudioLevel] = useState<number>(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Monitor audio input level using the stream from useMediaDevice hook
  useEffect(() => {
    if (!audioStream) return

    const setupAudioMonitoring = async () => {
      try {
        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        const microphone = audioContext.createMediaStreamSource(audioStream)

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
  }, [audioStream])

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Input Level</span>
        <span>{Math.round(audioLevel)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${audioLevel}%`,
            backgroundColor:
              audioLevel > 70
                ? 'var(--destructive)'
                : audioLevel > 30
                  ? 'var(--success)'
                  : 'var(--surface-3)',
          }}
        />
      </div>
      <p className="text-xs text-text-muted">
        Speak into your microphone to test
      </p>
    </div>
  )
}
