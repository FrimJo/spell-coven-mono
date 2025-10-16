import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Progress } from '@repo/ui/components/progress'

interface LoadingStep {
  label: string
  progress: number
  duration: number
}

const LOADING_STEPS: LoadingStep[] = [
  { label: 'Loading card embeddings...', progress: 20, duration: 600 },
  { label: 'Downloading CLIP model...', progress: 40, duration: 800 },
  { label: 'Initializing SlimSAM detector...', progress: 60, duration: 700 },
  { label: 'Downloading segmentation model...', progress: 80, duration: 900 },
  { label: 'Setting up game room...', progress: 100, duration: 500 },
]

interface GameRoomLoaderProps {
  onLoadingComplete: () => void
}

export function GameRoomLoader({ onLoadingComplete }: GameRoomLoaderProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (currentStepIndex >= LOADING_STEPS.length) {
      // All steps complete
      setTimeout(onLoadingComplete, 300)
      return
    }

    const currentStep = LOADING_STEPS[currentStepIndex]

    // Animate progress to current step's progress value
    const startProgress =
      currentStepIndex === 0 ? 0 : LOADING_STEPS[currentStepIndex - 1].progress
    const targetProgress = currentStep.progress
    const stepDuration = currentStep.duration
    const frames = 30
    const increment = (targetProgress - startProgress) / frames
    const frameDelay = stepDuration / frames

    let currentFrame = 0
    const intervalId = setInterval(() => {
      currentFrame++
      if (currentFrame >= frames) {
        setProgress(targetProgress)
        clearInterval(intervalId)
        // Move to next step
        setTimeout(() => {
          setCurrentStepIndex((prev) => prev + 1)
        }, 200)
      } else {
        setProgress(startProgress + increment * currentFrame)
      }
    }, frameDelay)

    return () => clearInterval(intervalId)
  }, [currentStepIndex, onLoadingComplete])

  const currentStep =
    LOADING_STEPS[Math.min(currentStepIndex, LOADING_STEPS.length - 1)]

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
            <p className="text-sm text-slate-400">{currentStep.label}</p>
          </div>

          {/* Progress Bar */}
          <div className="w-full space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-xs text-slate-500">
              {Math.round(progress)}%
            </p>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center gap-2">
            {LOADING_STEPS.map((_step, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  index < currentStepIndex
                    ? 'bg-purple-500'
                    : index === currentStepIndex
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
