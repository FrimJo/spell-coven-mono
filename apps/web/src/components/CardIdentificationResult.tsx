/**
 * Card Identification Result Component
 *
 * Displays top-1 match from similarity search with card metadata.
 * Shows card name, set, thumbnail, and Scryfall link.
 *
 * Implements:
 * - T043: Create CardIdentificationResult component
 * - T044: Display card name, set, thumbnail, Scryfall link
 */

import type { SearchResult } from '@/lib/search/similarity-search'
import { AlertCircle, ExternalLink } from 'lucide-react'

import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'

interface CardIdentificationResultProps {
  /** Search result with card metadata and score */
  result: SearchResult | null
  /** Whether identification is in progress */
  isLoading?: boolean
  /** Error message if identification failed */
  error?: string | null
  /** Callback when user closes the result */
  onClose?: () => void
}

/**
 * T043-T044: Card identification result display component
 */
export function CardIdentificationResult({
  result,
  isLoading = false,
  error = null,
  onClose,
}: CardIdentificationResultProps) {
  // Don't render if no result and not loading
  if (!result && !isLoading && !error) {
    return null
  }

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900">
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-400" />
            <span className="text-sm text-slate-300">Card Identification</span>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <span className="sr-only">Close</span>×
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                <p className="text-sm text-slate-400">Identifying card...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success State */}
          {result && !isLoading && !error && (
            <div className="space-y-4">
              {/* Card Image */}
              {result.card.image_url && (
                <div className="overflow-hidden rounded-lg">
                  <img
                    src={result.card.image_url}
                    alt={result.card.name}
                    className="w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Card Info */}
              <div className="space-y-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    {result.card.name}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {result.card.set.toUpperCase()}
                  </p>
                </div>

                {/* Similarity Score */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Confidence:</span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-purple-400 transition-all"
                        style={{
                          width: `${Math.max(0, Math.min(100, result.score * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-300">
                    {(result.score * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Inference Time */}
                <p className="text-xs text-slate-500">
                  Search time: {result.inferenceTimeMs.toFixed(0)}ms
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {result.card.card_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <a
                      href={result.card.card_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      View on Scryfall
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>

              {/* Low Confidence Warning */}
              {result.score < 0.7 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Low confidence match. Try clicking closer to the card center
                    or ensuring better lighting.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
