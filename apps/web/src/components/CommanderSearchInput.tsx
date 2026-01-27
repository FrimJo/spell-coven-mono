'use client'

import type { ScryfallCard } from '@/lib/scryfall'
import { useEffect, useEffectEvent, useRef } from 'react'
import { useMachine } from '@xstate/react'
import {
  detectDualCommanderKeywords,
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
import { commanderSearchMachine } from '@/state/commanderSearchMachine'

// Stable empty array to prevent infinite re-render loops
const EMPTY_SUGGESTIONS: string[] = []

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
  suggestions,
  suggestionsLabel = 'Suggested',
  hideLoadingIndicator = false,
  onLoadingChange,
}: CommanderSearchInputProps) {
  // Use stable reference for empty array to prevent infinite loops
  const effectiveSuggestions = suggestions ?? EMPTY_SUGGESTIONS
  const inputRef = useRef<HTMLInputElement>(null)

  // XState machine for search state
  const [state, send] = useMachine(commanderSearchMachine)

  // Derive state from machine context
  const open = state.context.open
  const query = state.context.query
  const results = state.context.results
  const loading = state.context.loading
  const resolvedCard = state.context.resolvedCard

  // Effect Events - stable handlers that always see latest props/state
  // These don't need to be in dependency arrays
  const onLoadingChanged = useEffectEvent((isLoading: boolean) => {
    onLoadingChange?.(isLoading)
  })

  const onCardWasResolved = useEffectEvent((card: ScryfallCard) => {
    onCardResolved?.(card)
  })

  const syncExternalValue = useEffectEvent(() => {
    // Only sync if external value differs from machine query
    if (value !== query) {
      send({ type: 'SET_EXTERNAL_VALUE', value })
    }
  })

  const syncSuggestions = useEffectEvent(() => {
    send({ type: 'SET_SUGGESTIONS', suggestions: effectiveSuggestions, label: suggestionsLabel })
  })

  // Sync external value changes
  useEffect(() => {
    syncExternalValue()
  }, [value])

  // Sync external suggestions
  useEffect(() => {
    syncSuggestions()
  }, [effectiveSuggestions, suggestionsLabel])

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChanged(loading)
  }, [loading])

  // Track previous resolved card to detect new resolutions
  const prevResolvedCardRef = useRef<ScryfallCard | null>(null)

  // Watch for resolved card and call callback
  useEffect(() => {
    if (resolvedCard !== null && resolvedCard !== prevResolvedCardRef.current) {
      prevResolvedCardRef.current = resolvedCard
      onCardWasResolved(resolvedCard)
    }
  }, [resolvedCard])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    send({ type: 'INPUT_CHANGED', value: val })
  }

  const handleSelect = (name: string) => {
    onChange(name)
    send({ type: 'RESULT_SELECTED', name })
  }

  const handleSuggestionSelect = (name: string) => {
    onChange(name)
    send({ type: 'SUGGESTION_SELECTED', name })
  }

  const handleFocus = () => {
    send({ type: 'FOCUS' })
  }

  const handleBlur = () => {
    send({ type: 'BLUR' })
  }

  const showResults = results.length > 0 || effectiveSuggestions.length > 0 || loading

  const handleOpenChange = (newOpen: boolean) => {
    // Ignore close requests when the input is focused (prevents Radix from closing on anchor click)
    if (!newOpen && document.activeElement === inputRef.current) {
      return
    }
    send({ type: 'OPEN_CHANGE', open: newOpen })
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
            {effectiveSuggestions.length > 0 && (
              <CommandGroup
                heading={suggestionsLabel}
                className="text-slate-400"
              >
                {effectiveSuggestions.map((name) => (
                  <CommandItem
                    key={`sug-${name}`}
                    value={name}
                    onSelect={() => handleSuggestionSelect(name)}
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
              effectiveSuggestions.length === 0 &&
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
// Re-exported utilities for external use
// ─────────────────────────────────────────────────────────────────────────────
export { detectDualCommanderKeywords, getSpecificPartner }
