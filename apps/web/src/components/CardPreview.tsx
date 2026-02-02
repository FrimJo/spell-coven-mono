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
    <Card className="border-surface-2 bg-surface-1 overflow-hidden">
      <div className="relative">
        {/* Header */}
        <div className="border-surface-2 bg-surface-0/50 flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="bg-brand-muted-foreground h-2 w-2 animate-pulse rounded-full" />
            <span className="text-text-secondary text-sm">
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
              className="text-text-muted h-6 w-6 p-0 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Low Confidence Warning */}
        {cardState === 'success' && lowConfidence && (
          <div className="px-3 pt-3">
            <Alert className="border-warning/30 bg-warning/10">
              <AlertTriangle className="text-warning h-4 w-4" />
              <AlertDescription className="text-warning ml-2 text-xs">
                Low confidence match. This might not be the correct card. Please
                verify.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Card Image */}
        <div className="p-3">
          <div className="bg-surface-0 relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-lg">
            {cardState === 'querying' && (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="text-brand-muted-foreground h-10 w-10 animate-spin" />
                <p className="text-text-muted text-sm">Recognizing card...</p>
              </div>
            )}

            {cardState === 'error' && (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="bg-destructive/20 flex h-12 w-12 items-center justify-center rounded-full">
                  <AlertCircle className="text-destructive h-6 w-6" />
                </div>
                <div>
                  <p className="text-destructive mb-1 text-sm">
                    Failed to recognize card
                  </p>
                  <p className="text-text-muted text-xs">
                    Try adjusting the camera angle or lighting
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => console.warn('Not implemented')}
                  className="border-surface-3 text-text-secondary hover:bg-surface-2 mt-2"
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
                <div className="bg-surface-0/0 hover:bg-surface-0/10 absolute inset-0 flex items-center justify-center opacity-0 transition-colors hover:opacity-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-surface-3 bg-surface-0/90 backdrop-blur-sm"
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
            <p className="text-text-muted text-xs">Selected from table view</p>
            <a
              href={state.result.scryfall_uri}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-surface-2 border-surface-3 bg-surface-2 text-text-secondary inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors hover:text-white"
            >
              <span>Scryfall</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        {cardState !== 'success' && (
          <div className="text-text-muted px-3 pb-3 text-xs">
            <p>Selected from table view</p>
          </div>
        )}
      </div>
    </Card>
  )
}
