import type { CardQueryResult } from '@/types/card-query'
import { useCardQueryContext } from '@/contexts/CardQueryContext'
import { isLowConfidence } from '@/types/card-query'
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  Loader2,
  X,
} from 'lucide-react'

import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'

import { SidebarCard } from './GameRoomSidebar'

interface CardPreviewProps {
  playerName: string
  onClose: () => void
}

export function CardPreview({ playerName, onClose }: CardPreviewProps) {
  const { state, history, isDismissed } = useCardQueryContext()

  // Don't show preview if dismissed
  if (isDismissed) {
    return null
  }

  // Show the most recent card: prefer current state result (most recent interaction),
  // otherwise show latest history entry if there's been an interaction
  // This prevents showing history from previous session on initial page load
  const hasActiveInteraction = state.status !== 'idle' || state.result != null

  // Prefer state.result (current selection), fallback to history[0] (latest in history)
  const displayResult: CardQueryResult | null =
    state.result ??
    (history.length > 0 && hasActiveInteraction
      ? {
          name: history[0].name,
          set: history[0].set,
          score: 1.0, // History entries are always full confidence
          scryfall_uri: history[0].scryfall_uri,
          image_url: history[0].image_url,
          card_url: history[0].card_url,
        }
      : null)

  if (displayResult == null) {
    return null
  }

  const cardState = state.status

  const lowConfidence = isLowConfidence(displayResult.score)

  const cardImage =
    displayResult.card_url ||
    displayResult.image_url?.replace('/art_crop/', '/normal/')

  return (
    <SidebarCard
      icon={Eye}
      title="Card Preview"
      count=""
      headerAction={
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-text-muted h-5 w-5 p-0 hover:text-white"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </Button>
      }
    >
      <div className="relative">
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
              <img
                src={cardImage}
                alt="Birds of Paradise"
                className="h-auto w-full"
              />
            )}
          </div>
        </div>

        {/* Query Image (Development only) */}
        {import.meta.env.DEV && state.queryImageUrl && (
          <div className="border-surface-2 mx-3 mb-3 border-t pt-3">
            <p className="text-text-muted mb-2 text-xs font-medium">
              Query Image (Dev)
            </p>
            <div className="bg-surface-0 overflow-hidden rounded-lg">
              <img
                src={state.queryImageUrl}
                alt="Query image used for database lookup"
                className="h-auto w-full"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>
        )}

        {/* Card Info */}
        {cardState === 'success' && (
          <div className="flex items-center justify-between px-3 pb-3">
            <p className="text-text-muted text-xs">Selected from table view</p>
            {displayResult.scryfall_uri && (
              <a
                href={displayResult.scryfall_uri}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bg-surface-2 border-surface-3 bg-surface-2 text-text-secondary inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors hover:text-white"
              >
                <span>Scryfall</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
        {cardState !== 'success' && (
          <div className="text-text-muted px-3 pb-3 text-xs">
            <p>Selected from table view</p>
          </div>
        )}
      </div>
    </SidebarCard>
  )
}
