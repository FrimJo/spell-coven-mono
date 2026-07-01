import { useState } from 'react'
import { useCardSearchContext } from '@/contexts/CardSearchContext'
import { toScryfallPngUrl } from '@/lib/scryfall'
import { ExternalLink, Eye, X, ZoomIn } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Dialog, DialogContent, DialogTitle } from '@repo/ui/components/dialog'

import { SidebarCard } from './SidebarCard'

interface CardPreviewProps {
  onClose: () => void
}

export function CardPreview({ onClose }: CardPreviewProps) {
  const { currentResult, isDismissed } = useCardSearchContext()
  const [cardModalOpen, setCardModalOpen] = useState(false)

  if (isDismissed || !currentResult) {
    return null
  }

  const cardImage =
    currentResult.card_url ??
    currentResult.image_url?.replace('/art_crop/', '/normal/')

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
            className="text-text-muted size-5 p-0 hover:text-white"
            title="Dismiss"
          >
            <X className="size-3" />
          </Button>
        }
      >
        <div className="relative">
          {cardImage && (
            <div className="p-3">
              <div className="bg-surface-0 group relative flex min-h-[300px] cursor-pointer items-center justify-center overflow-hidden rounded-lg transition-transform duration-200 ease-out hover:scale-[1.02]">
                <img
                  src={cardImage}
                  alt={currentResult.name}
                  className="h-auto w-full rounded-lg"
                />
                <button
                  type="button"
                  aria-label={`View larger image of ${currentResult.name}`}
                  className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  onClick={() => setCardModalOpen(true)}
                  onMouseEnter={() => {
                    const image = new Image()
                    image.src = toScryfallPngUrl(cardImage)
                  }}
                >
                  <span className="bg-surface-1/90 flex size-12 items-center justify-center rounded-full shadow-lg ring-1 ring-white/20 backdrop-blur-sm">
                    <ZoomIn className="size-6 text-white" />
                  </span>
                  <span className="text-xs font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    View larger
                  </span>
                </button>
              </div>
            </div>
          )}

          {currentResult.scryfall_uri && (
            <div className="flex items-center justify-end px-3 pb-3">
              <a
                href={currentResult.scryfall_uri}
                target="_blank"
                rel="noopener noreferrer"
                className="border-surface-3 bg-surface-2 text-text-secondary hover:bg-surface-2 inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs transition-colors hover:text-white"
              >
                <span>Scryfall</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </div>
      </SidebarCard>

      {cardImage && (
        <Dialog open={cardModalOpen} onOpenChange={setCardModalOpen}>
          <DialogContent className="border-surface-3 bg-surface-1 max-w-md p-4">
            <DialogTitle className="sr-only">{currentResult.name}</DialogTitle>
            <img
              src={toScryfallPngUrl(cardImage)}
              alt={currentResult.name}
              className="h-auto w-full rounded-lg"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
