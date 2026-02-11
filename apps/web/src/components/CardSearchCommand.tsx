'use client'

import type { ScryfallCard } from '@/lib/scryfall'
import type { CardQueryResult } from '@/types/card-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCardQueryContext } from '@/contexts/CardQueryContext'
import { searchCards } from '@/lib/scryfall'
import { ExternalLink, Loader2, Search } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@repo/ui/components/command'

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

interface CardSearchCommandProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CardSearchCommand({
  open,
  onOpenChange,
}: CardSearchCommandProps) {
  const { setResult } = useCardQueryContext()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ScryfallCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const cards = await searchCards(searchQuery, 20)
      setResults(cards)
      if (cards.length === 0) {
        setError('No cards found')
      }
    } catch (err) {
      console.error('[CardSearchCommand] Search failed:', err)
      setError('Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle input change with debounce
  const handleValueChange = useCallback(
    (value: string) => {
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
      onOpenChange(false)
      // Reset state after closing
      setTimeout(() => {
        setQuery('')
        setResults([])
        setError(null)
      }, 200)
    },
    [setResult, onOpenChange],
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setError(null)
    }
  }, [open])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Card Search"
      description="Search for Magic: The Gathering cards using Scryfall syntax"
      contentClassName="top-[33%] translate-y-0"
    >
      <CommandInput
        placeholder="Search cards..."
        value={query}
        onValueChange={handleValueChange}
      />
      <CommandList className="max-h-[400px]">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            <span className="text-muted-foreground text-sm">Searching...</span>
          </div>
        )}

        {!loading && error && query.length >= MIN_QUERY_LENGTH && (
          <CommandEmpty>{error}</CommandEmpty>
        )}

        {!loading && query.length < MIN_QUERY_LENGTH && (
          <div className="text-muted-foreground py-6 text-center text-sm">
            <Search className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>Type at least 2 characters to search</p>
            <p className="mt-1 text-xs opacity-75">
              Supports{' '}
              <a
                href="https://scryfall.com/docs/syntax"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground inline-flex items-center gap-1 underline"
              >
                Scryfall search syntax
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <CommandGroup heading="Search Results">
            {results.map((card) => (
              <CommandItem
                key={card.id}
                value={`${card.name}-${card.id}`}
                onSelect={() => handleSelect(card)}
                className="flex items-center gap-3 py-2"
              >
                {card.image_uris?.small && (
                  <img
                    src={card.image_uris.small}
                    alt=""
                    className="h-12 w-9 flex-shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {card.name}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {card.set_name} ({card.set.toUpperCase()})
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
