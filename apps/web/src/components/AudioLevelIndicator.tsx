import { useEffect, useState } from 'react'

interface AudioLevelIndicatorProps {
  audioStream: MediaStream | null | undefined
}

export const AudioLevelIndicator = ({
  audioStream,
}: AudioLevelIndicatorProps) => {
  const [audioLevel, setAudioLevel] = useState<number>(0)

  // Monitor audio input level using the stream from useMediaDevice hook
  useEffect(() => {
    if (!audioStream) return

    let disposed = false
    let audioContext: AudioContext | null = null
    let animationFrame: number | null = null

    const setupAudioMonitoring = async () => {
      try {
        const nextAudioContext = new AudioContext()
        const analyser = nextAudioContext.createAnalyser()
        const microphone = nextAudioContext.createMediaStreamSource(audioStream)

        if (disposed) {
          await nextAudioContext.close()
          return
        }

        audioContext = nextAudioContext

        analyser.fftSize = 256
        microphone.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        let lastUpdateTime = 0
        const UPDATE_INTERVAL = 100 // Update every 100ms instead of every frame

        const updateLevel = () => {
          if (disposed) return

          const now = Date.now()
          if (now - lastUpdateTime >= UPDATE_INTERVAL) {
            analyser.getByteFrequencyData(dataArray)
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length
            setAudioLevel(Math.min(100, (average / 255) * 100 * 2)) // Amplify a bit
            lastUpdateTime = now
          }

          animationFrame = requestAnimationFrame(updateLevel)
        }

        updateLevel()
      } catch (error) {
        console.error('Error setting up audio monitoring:', error)
      }
    }

    void setupAudioMonitoring()

    return () => {
      disposed = true
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      void audioContext?.close()
    }
  }, [audioStream])

  return (
    <div className="space-y-1">
      <div className="text-text-muted flex items-center justify-between text-xs">
        <span>Input Level</span>
        <span>{Math.round(audioLevel)}%</span>
      </div>
      <div className="bg-surface-2 h-2 overflow-hidden rounded-full">
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
      <p className="text-text-muted text-xs">
        Speak into your microphone to test
      </p>
    </div>
  )
}
