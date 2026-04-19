import type { CardQueryResult } from '@/types/card-query'
import { useState } from 'react'
import { useCardQueryContext } from '@/contexts/CardQueryContext'
import { toScryfallPngUrl } from '@/lib/scryfall'
import { isLowConfidence } from '@/types/card-query'
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  Loader2,
  X,
  ZoomIn,
} from 'lucide-react'

import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Dialog, DialogContent, DialogTitle } from '@repo/ui/components/dialog'

import { SidebarCard } from './GameRoomSidebar'

interface CardPreviewProps {
  onClose: () => void
}

export function CardPreview({ onClose }: CardPreviewProps) {
  const { state, history, isDismissed } = useCardQueryContext()
  const [cardModalOpen, setCardModalOpen] = useState(false)

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
    (history[0] && hasActiveInteraction
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
    <>
      <SidebarCard
        icon={Eye}
        title="Card Preview"
        count=""
        headerAction={
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-5 w-5 p-0 hover:text-white text-text-muted"
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
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="ml-2 text-xs text-warning">
                  Low confidence match. This might not be the correct card.
                  Please verify.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Card Image */}
          <div className="p-3">
            <div className="group ease-out relative flex min-h-[300px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-surface-0 transition-transform duration-200 hover:scale-[1.02]">
              {cardState === 'querying' && (
                <div className="gap-3 py-12 flex flex-col items-center">
                  <Loader2 className="h-10 w-10 animate-spin text-brand-muted-foreground" />
                  <p className="text-sm text-text-muted">Recognizing card...</p>
                </div>
              )}

              {cardState === 'error' && (
                <div className="gap-3 px-6 py-12 flex flex-col items-center text-center">
                  <div className="h-12 w-12 flex items-center justify-center rounded-full bg-destructive/20">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="mb-1 text-sm text-destructive">
                      Failed to recognize card
                    </p>
                    <p className="text-xs text-text-muted">
                      Try adjusting the camera angle or lighting
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => console.warn('Not implemented')}
                    className="mt-2 border-surface-3 text-text-secondary hover:bg-surface-2"
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {cardState === 'success' && (
                <>
                  <img
                    src={cardImage}
                    alt={displayResult.name}
                    className="h-auto w-full rounded-lg"
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    className="inset-0 gap-2 bg-black/40 absolute flex cursor-pointer flex-col items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    onClick={() => setCardModalOpen(true)}
                    onMouseEnter={() => {
                      if (!cardImage) return
                      const img = new Image()
                      img.src = toScryfallPngUrl(cardImage)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setCardModalOpen(true)
                      }
                    }}
                  >
                    <div className="h-12 w-12 shadow-lg ring-white/20 backdrop-blur-sm flex items-center justify-center rounded-full bg-surface-1/90 ring-1">
                      <ZoomIn className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      View larger
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Query Image (Development only) */}
          {import.meta.env.DEV && state.queryImageUrl && (
            <div className="mx-3 mb-3 pt-3 border-t border-surface-2">
              <p className="mb-2 text-xs font-medium text-text-muted">
                Query Image (Dev)
              </p>
              <div className="overflow-hidden rounded-lg bg-surface-0">
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
          {cardState === 'success' && displayResult.scryfall_uri && (
            <div className="px-3 pb-3 flex items-center justify-end">
              <a
                href={displayResult.scryfall_uri}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1 rounded px-2 py-1 text-xs hover:text-white inline-flex items-center border border-surface-3 bg-surface-2 text-text-secondary transition-colors hover:bg-surface-2"
              >
                <span>Scryfall</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </SidebarCard>

      {/* Card zoom modal - uses Scryfall PNG (transparent, pre-rounded corners) */}
      <Dialog open={cardModalOpen} onOpenChange={setCardModalOpen}>
        <DialogContent className="p-0 sm:max-w-[480px] [&>button]:right-2 [&>button]:top-2 [&>button]:text-white border-surface-2 bg-transparent shadow-none [&>button]:rounded-full [&>button]:bg-surface-1">
          <DialogTitle className="sr-only">{displayResult.name}</DialogTitle>
          {cardState === 'success' && cardImage && (
            <img
              src={toScryfallPngUrl(cardImage)}
              alt={displayResult.name}
              className="h-auto w-full"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
