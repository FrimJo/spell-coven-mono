'use client'

import type { ScryfallCard } from '@/lib/scryfall'
import type { CardQueryResult } from '@/types/card-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCardQueryContext } from '@/contexts/CardQueryContext'
import { searchCards } from '@/lib/scryfall'
import { Loader2, Search, X } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import { Input } from '@repo/ui/components/input'
import { ScrollArea } from '@repo/ui/components/scroll-area'

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

/**
 * Convert a ScryfallCard to CardQueryResult format
 */
function scryfallToCardQueryResult(card: ScryfallCard): CardQueryResult {
  return {
    name: card.name,
    set: card.set.toUpperCase(),
    score: 1.0, // Manual selection = full confidence
    scryfall_uri: card.scryfall_uri,
    image_url: card.image_uris?.art_crop,
    card_url: card.image_uris?.normal,
  }
}

export function CardSearchPanel() {
  const { setResult } = useCardQueryContext()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ScryfallCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < MIN_QUERY_LENGTH) {
      setResults([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const cards = await searchCards(searchQuery, 10)
      setResults(cards)
      if (cards.length === 0) {
        setError('No cards found')
      }
    } catch (err) {
      console.error('[CardSearchPanel] Search failed:', err)
      setError('Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle input change with debounce
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      // Set new debounce
      debounceRef.current = setTimeout(() => {
        performSearch(value)
      }, DEBOUNCE_MS)
    },
    [performSearch],
  )

  // Handle card selection
  const handleSelect = useCallback(
    (card: ScryfallCard) => {
      const result = scryfallToCardQueryResult(card)
      setResult(result)
      setQuery('')
      setResults([])
      setIsFocused(false)
      inputRef.current?.blur()
    },
    [setResult],
  )

  // Clear input
  const handleClear = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
    inputRef.current?.focus()
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const showResults = isFocused && (results.length > 0 || loading || error)

  return (
    <Card className="p-4 border-surface-2 bg-surface-1">
      <div className="space-y-3">
        {/* Header */}
        <div className="gap-2 flex items-center">
          <Search className="h-4 w-4 text-text-muted" />
          <span className="text-sm text-text-muted">Card Search</span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Delay blur to allow click on results
              setTimeout(() => setIsFocused(false), 150)
            }}
            placeholder="Search cards..."
            className="pr-8 border-surface-3 bg-surface-2"
            autoComplete="off"
          />
          {query.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="right-1 h-6 w-6 p-0 absolute top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Results List */}
        {showResults && (
          <div className="rounded-lg border border-surface-3 bg-surface-2">
            <ScrollArea className="max-h-48">
              {loading && (
                <div className="gap-2 py-4 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                  <span className="text-sm text-text-muted">Searching...</span>
                </div>
              )}

              {!loading && error && (
                <div className="py-4 text-sm text-center text-text-muted">
                  {error}
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="py-1">
                  {results.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleSelect(card)}
                      className="gap-3 px-3 py-2 flex w-full items-center text-left transition-colors hover:bg-surface-3"
                    >
                      {card.image_uris?.small && (
                        <img
                          src={card.image_uris.small}
                          alt=""
                          className="h-10 w-7 rounded flex-shrink-0 object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">
                          {card.name}
                        </div>
                        <div className="text-xs truncate text-text-muted">
                          {card.set_name} ({card.set.toUpperCase()})
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Help text */}
        {!showResults && (
          <p className="text-xs text-text-muted">
            Use Scryfall syntax: &quot;type:instant&quot;, &quot;cmc:1&quot;,
            &quot;color:red&quot;
          </p>
        )}
      </div>
    </Card>
  )
}
