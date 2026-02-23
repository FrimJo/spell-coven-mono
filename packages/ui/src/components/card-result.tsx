import * as React from 'react'
import { ExternalLink } from 'lucide-react'

import type { CardQueryResult } from '../types/card-query.js'
import { cn } from '../lib/utils.js'

export interface CardResultProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Query result to display */
  result: CardQueryResult
  /** Whether to show low confidence warning (score < 0.70) */
  showLowConfidenceWarning?: boolean
}

export function CardResult({
  result,
  showLowConfidenceWarning = false,
  className,
  ...props
}: CardResultProps) {
  const cardImageUrl =
    result.card_url || result.image_url?.replace('/art_crop/', '/normal/')

  return (
    <div
      className={cn(
        'bg-card text-card-foreground space-y-3 rounded-lg border p-4',
        className,
      )}
      {...props}
    >
      {/* Card Info */}
      <div className="space-y-1">
        <h3 className="font-semibold leading-none tracking-tight">
          {result.name}
        </h3>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="font-medium">[{result.set}]</span>
          <span>•</span>
          <span>Score: {result.score.toFixed(3)}</span>
        </div>
      </div>

      {/* Low Confidence Warning */}
      {showLowConfidenceWarning && (
        <div className="bg-warning/10 text-warning-foreground dark:text-warning-muted-foreground rounded-md px-3 py-2 text-sm">
          Low confidence match. Try a clearer view of the card.
        </div>
      )}

      {/* Card Image */}
      {cardImageUrl && (
        <div className="overflow-hidden rounded-md border">
          <img
            src={cardImageUrl}
            alt={result.name}
            className="h-auto w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      {/* Scryfall Link */}
      {result.scryfall_uri && (
        <a
          href={result.scryfall_uri}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
        >
          View on Scryfall
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}

CardResult.displayName = 'CardResult'
