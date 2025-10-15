import { useCardQueryContext } from '@/contexts/CardQueryContext'
import { isLowConfidence } from '@/types/card-query'
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Maximize2,
  X,
} from 'lucide-react'

import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'

interface CardPreviewProps {
  playerName: string
  onClose: () => void
}

export function CardPreview({ playerName, onClose }: CardPreviewProps) {
  const { state } = useCardQueryContext()
  if (state.result == null) {
    return null
  }

  const cardState = state.status

  const lowConfidence = isLowConfidence(state.result.score)

  const cardImage =
    state.result.card_url ||
    state.result.image_url?.replace('/art_crop/', '/normal/')

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900">
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
            <span className="text-sm text-slate-300">
              {playerName}&apos;s Card
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Test State Buttons */}
            <div className="mr-2 flex items-center gap-0.5 opacity-50 transition-opacity hover:opacity-100"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Low Confidence Warning */}
        {cardState === 'success' && lowConfidence && (
          <div className="px-3 pt-3">
            <Alert className="border-yellow-500/30 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="ml-2 text-xs text-yellow-200">
                Low confidence match. This might not be the correct card. Please
                verify.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Card Image */}
        <div className="p-3">
          <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-lg bg-slate-950">
            {cardState === 'querying' && (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
                <p className="text-sm text-slate-400">Recognizing card...</p>
              </div>
            )}

            {cardState === 'error' && (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                  <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <p className="mb-1 text-sm text-red-400">
                    Failed to recognize card
                  </p>
                  <p className="text-xs text-slate-500">
                    Try adjusting the camera angle or lighting
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => console.warn('Not implemented')}
                  className="mt-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Try Again
                </Button>
              </div>
            )}

            {cardState === 'success' && (
              <>
                <img
                  src={cardImage}
                  alt="Birds of Paradise"
                  className="h-auto w-full"
                />

                {/* Hover overlay for zoom */}
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition-colors hover:bg-slate-950/10 hover:opacity-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700 bg-slate-950/90 backdrop-blur-sm"
                  >
                    <Maximize2 className="mr-2 h-4 w-4" />
                    Enlarge
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card Info */}
        {cardState === 'success' && (
          <div className="flex items-center justify-between px-3 pb-3">
            <p className="text-xs text-slate-400">Selected from table view</p>
            <a
              href={state.result.card_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-slate-750 inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 transition-colors hover:text-white"
            >
              <span>Scryfall</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        {cardState !== 'success' && (
          <div className="px-3 pb-3 text-xs text-slate-400">
            <p>Selected from table view</p>
          </div>
        )}
      </div>
    </Card>
  )
}
