'use client'

import type { DualCommanderKeyword, ScryfallCard } from '@/lib/scryfall'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  autocomplete,
  detectDualCommanderKeywords,
  getCardByName,
  getSpecificPartner,
} from '@/lib/scryfall'
import { Loader2 } from 'lucide-react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@repo/ui/components/command'
import { Input } from '@repo/ui/components/input'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@repo/ui/components/popover'

interface CommanderSearchInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  onCardResolved?: (card: ScryfallCard | null) => void
  placeholder?: string
  className?: string
  /** Optional list of suggested names to show at the top (e.g., partner suggestions) */
  suggestions?: string[]
  /** Label for suggestions group */
  suggestionsLabel?: string
  /** Hide the internal loading indicator (use when parent provides external status icons) */
  hideLoadingIndicator?: boolean
  /** Callback to expose loading state to parent */
  onLoadingChange?: (loading: boolean) => void
}

export function CommanderSearchInput({
  id,
  value,
  onChange,
  onCardResolved,
  placeholder = 'Search for a commander...',
  className,
  suggestions = [],
  suggestionsLabel = 'Suggested',
  hideLoadingIndicator = false,
  onLoadingChange,
}: CommanderSearchInputProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external value changes
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(loading)
  }, [loading, onLoadingChange])

  // Debounced autocomplete search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const names = await autocomplete(q)
      setResults(names)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    onChange(val)
    setOpen(true)

    // Debounce API call
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(val)
    }, 300)
  }

  const handleSelect = async (name: string) => {
    setQuery(name)
    onChange(name)
    setOpen(false)
    setResults([])

    // Resolve full card data
    if (onCardResolved) {
      const card = await getCardByName(name, false)
      onCardResolved(card)
    }
  }

  const handleFocus = () => {
    // Always show dropdown on focus if there are suggestions
    if (suggestions.length > 0) {
      setOpen(true)
    }
    // If there's existing text, trigger a search and show dropdown
    if (query.length >= 2) {
      setOpen(true)
      // Set loading immediately so showResults is true before doSearch runs
      setLoading(true)
      doSearch(query)
    }
  }

  const handleBlur = () => {
    // Delay close to allow click on item
    setTimeout(() => setOpen(false), 200)
  }

  const showResults = results.length > 0 || suggestions.length > 0 || loading

  const handleOpenChange = (newOpen: boolean) => {
    // Ignore close requests when the input is focused (prevents Radix from closing on anchor click)
    if (!newOpen && document.activeElement === inputRef.current) {
      return
    }
    setOpen(newOpen)
  }

  return (
    <Popover open={open && showResults} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            id={id}
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={className}
            autoComplete="off"
          />
          {loading && !hideLoadingIndicator && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] border-slate-700 bg-slate-900 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command className="bg-transparent">
          <CommandList>
            {suggestions.length > 0 && (
              <CommandGroup
                heading={suggestionsLabel}
                className="text-slate-400"
              >
                {suggestions.map((name) => (
                  <CommandItem
                    key={`sug-${name}`}
                    value={name}
                    onSelect={() => handleSelect(name)}
                    className="cursor-pointer text-purple-300 hover:bg-slate-800"
                  >
                    {name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Search Results" className="text-slate-400">
                {results.slice(0, 10).map((name) => (
                  <CommandItem
                    key={name}
                    value={name}
                    onSelect={() => handleSelect(name)}
                    className="cursor-pointer text-slate-100 hover:bg-slate-800"
                  >
                    {name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!loading &&
              results.length === 0 &&
              suggestions.length === 0 &&
              query.length >= 2 && (
                <CommandEmpty className="text-slate-500">
                  No cards found
                </CommandEmpty>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper hook for managing commander pair state
// ─────────────────────────────────────────────────────────────────────────────

export interface CommanderPairState {
  commander1Name: string
  commander2Name: string
  commander1Card: ScryfallCard | null
  commander2Card: ScryfallCard | null
  dualKeywords: DualCommanderKeyword[]
  specificPartner: string | null
  allowsSecondCommander: boolean
}

export function useCommanderPair(
  initialCommander1: string,
  initialCommander2: string,
): {
  state: CommanderPairState
  setCommander1Name: (name: string) => void
  setCommander2Name: (name: string) => void
  onCommander1Resolved: (card: ScryfallCard | null) => void
  onCommander2Resolved: (card: ScryfallCard | null) => void
} {
  const [commander1Name, setCommander1Name] = useState(initialCommander1)
  const [commander2Name, setCommander2Name] = useState(initialCommander2)
  const [commander1Card, setCommander1Card] = useState<ScryfallCard | null>(
    null,
  )
  const [commander2Card, setCommander2Card] = useState<ScryfallCard | null>(
    null,
  )

  const dualKeywords = commander1Card
    ? detectDualCommanderKeywords(commander1Card)
    : []

  const specificPartner = commander1Card
    ? getSpecificPartner(commander1Card)
    : null

  const allowsSecondCommander = dualKeywords.length > 0

  return {
    state: {
      commander1Name,
      commander2Name,
      commander1Card,
      commander2Card,
      dualKeywords,
      specificPartner,
      allowsSecondCommander,
    },
    setCommander1Name,
    setCommander2Name,
    onCommander1Resolved: setCommander1Card,
    onCommander2Resolved: setCommander2Card,
  }
}
