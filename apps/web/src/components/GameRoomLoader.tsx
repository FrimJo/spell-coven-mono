import type { LoadingEvent } from '@/lib/loading-events'
import { useEffect, useState } from 'react'
import { loadingEvents } from '@/lib/loading-events'
import { Loader2 } from 'lucide-react'

import { Progress } from '@repo/ui/components/progress'

interface GameRoomLoaderProps {
  onLoadingComplete: () => void
}

// Number of loading steps (embeddings, clip-model, detector, game-room)
const TOTAL_STEPS = 4

export function GameRoomLoader({ onLoadingComplete }: GameRoomLoaderProps) {
  const [progress, setProgress] = useState(0)
  const [currentMessage, setCurrentMessage] = useState('Loading...')

  // Calculate current step based on progress (0-20%, 20-50%, 50-80%, 80-100%)
  const currentStep = Math.min(Math.floor(progress / 25), TOTAL_STEPS - 1)

  useEffect(() => {
    // Subscribe to loading events
    const unsubscribe = loadingEvents.subscribe((event: LoadingEvent) => {
      // Update progress and message from real loading events
      setProgress(event.progress)
      setCurrentMessage(event.message)

      // Complete loading when done
      if (event.step === 'complete') {
        setTimeout(onLoadingComplete, 300)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [onLoadingComplete])

  return (
    <div className="absolute inset-0 top-[57px] z-50 flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md px-8">
        <div className="flex flex-col items-center space-y-6">
          {/* Animated Loader Icon */}
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
            <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/10" />
          </div>

          {/* Loading Text */}
          <div className="space-y-2 text-center">
            <h2 className="text-slate-200">Loading Game Room</h2>
            <p className="text-sm text-slate-400">{currentMessage}</p>
          </div>

          {/* Progress Bar */}
          <div className="w-full space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-xs text-slate-500">
              {Math.round(progress)}%
            </p>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  index < currentStep
                    ? 'bg-purple-500'
                    : index === currentStep
                      ? 'scale-125 bg-purple-400'
                      : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
