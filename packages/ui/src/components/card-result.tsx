import * as React from "react";
import { cn } from "../lib/utils";
import { ExternalLink } from "lucide-react";
import type { CardQueryResult } from "../types/card-query";

export interface CardResultProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Query result to display */
  result: CardQueryResult;
  /** Whether to show low confidence warning (score < 0.70) */
  showLowConfidenceWarning?: boolean;
}

export function CardResult({
  result,
  showLowConfidenceWarning = false,
  className,
  ...props
}: CardResultProps) {
  const cardImageUrl =
    result.card_url || result.image_url?.replace("/art_crop/", "/normal/");

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border bg-card p-4 text-card-foreground",
        className,
      )}
      {...props}
    >
      {/* Card Info */}
      <div className="space-y-1">
        <h3 className="font-semibold leading-none tracking-tight">
          {result.name}
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">[{result.set}]</span>
          <span>•</span>
          <span>Score: {result.score.toFixed(3)}</span>
        </div>
      </div>

      {/* Low Confidence Warning */}
      {showLowConfidenceWarning && (
        <div className="rounded-md bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
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
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View on Scryfall
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

CardResult.displayName = "CardResult";
