'use client'

import type { ScryfallCard } from '@/lib/scryfall'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { detectDualCommanderKeywords, getSpecificPartner } from '@/lib/scryfall'
import { commanderSearchMachine } from '@/state/commanderSearchMachine'
import { useMachine } from '@xstate/react'
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
  const listRef = useRef<HTMLDivElement>(null)
  const popoverContentRef = useRef<HTMLDivElement>(null)
  const mousedownInContentRef = useRef(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  // XState machine for search state
  const [state, send] = useMachine(commanderSearchMachine)

  // Derive state from machine context
  const open = state.context.open
  const query = state.context.query
  const results = state.context.results
  const loading = state.context.loading
  const resolvedCard = state.context.resolvedCard

  // Flat list of options for keyboard nav: suggestions first, then results
  const options = [
    ...effectiveSuggestions.map((name) => ({
      type: 'suggestion' as const,
      name,
    })),
    ...results.slice(0, 10).map((name) => ({ type: 'result' as const, name })),
  ]

  // Effect Events - stable handlers that always see latest props/state
  // These don't need to be in dependency arrays
  const onLoadingChanged = useEffectEvent((isLoading: boolean) => {
    onLoadingChange?.(isLoading)
  })

  const onCardWasResolved = useEffectEvent((card: ScryfallCard) => {
    onCardResolved?.(card)
  })
  const onCardWasCleared = useEffectEvent(() => {
    onCardResolved?.(null)
  })

  const syncExternalValue = useEffectEvent(() => {
    // Only sync if external value differs from machine query
    if (value !== query) {
      send({ type: 'SET_EXTERNAL_VALUE', value })
    }
  })

  const syncSuggestions = useEffectEvent(() => {
    send({
      type: 'SET_SUGGESTIONS',
      suggestions: effectiveSuggestions,
      label: suggestionsLabel,
    })
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

  // Watch for resolved card and call callback (including when cleared to null)
  useEffect(() => {
    if (resolvedCard !== null && resolvedCard !== prevResolvedCardRef.current) {
      prevResolvedCardRef.current = resolvedCard
      onCardWasResolved(resolvedCard)
    } else if (resolvedCard === null && prevResolvedCardRef.current !== null) {
      prevResolvedCardRef.current = null
      onCardWasCleared()
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
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSuggestionSelect = (name: string) => {
    onChange(name)
    send({ type: 'SUGGESTION_SELECTED', name })
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleFocus = () => {
    send({ type: 'FOCUS' })
  }

  const handleBlur = () => {
    // Don't close when user is interacting with scrollbar or list (e.g. dragging scrollbar)
    if (mousedownInContentRef.current) return
    send({ type: 'BLUR' })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !showResults) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Open and show results if we have any so user can navigate
        if (options.length > 0) {
          e.preventDefault()
          setHighlightedIndex(0)
        }
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => (i < options.length - 1 ? i + 1 : i))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => (i > 0 ? i - 1 : 0))
      return
    }
    if (
      e.key === 'Enter' &&
      highlightedIndex >= 0 &&
      options[highlightedIndex]
    ) {
      e.preventDefault()
      const opt = options[highlightedIndex]
      if (opt.type === 'suggestion') {
        handleSuggestionSelect(opt.name)
      } else {
        handleSelect(opt.name)
      }
      return
    }
    if (e.key === 'Escape') {
      setHighlightedIndex(-1)
    }
  }

  const showResults =
    results.length > 0 || effectiveSuggestions.length > 0 || loading

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return
    const el = listRef.current.querySelector(
      `[data-commander-option-index="${highlightedIndex}"]`,
    )
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlightedIndex])

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
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={className}
            autoComplete="off"
            aria-expanded={open && showResults}
            aria-autocomplete="list"
            aria-controls={open && showResults ? `${id}-list` : undefined}
            aria-activedescendant={
              highlightedIndex >= 0
                ? `${id}-option-${highlightedIndex}`
                : undefined
            }
          />
          {loading && !hideLoadingIndicator && (
            <Loader2 className="text-text-muted absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="border-surface-3 bg-surface-1 w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        asChild
      >
        <div
          ref={popoverContentRef}
          onMouseDown={() => {
            mousedownInContentRef.current = true
          }}
          onMouseUp={() => {
            mousedownInContentRef.current = false
          }}
        >
          <Command className="flex min-h-0 bg-transparent" shouldFilter={false}>
            <div
              ref={listRef}
              id={`${id}-list`}
              role="listbox"
              className="max-h-[min(300px,50vh)] min-h-0 overflow-y-auto overflow-x-hidden"
              onWheel={(e) => {
                // Focus stays on input, so wheel often goes to input; handle wheel over list so list scrolls
                const el = listRef.current
                if (!el) return
                el.scrollTop += e.deltaY
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <CommandList className="h-full">
                {effectiveSuggestions.length > 0 && (
                  <CommandGroup
                    heading={suggestionsLabel}
                    className="text-text-muted"
                  >
                    {effectiveSuggestions.map((name, i) => (
                      <CommandItem
                        key={`sug-${name}`}
                        value={name}
                        data-commander-option-index={i}
                        id={`${id}-option-${i}`}
                        role="option"
                        tabIndex={-1}
                        aria-selected={highlightedIndex === i}
                        onSelect={() => handleSuggestionSelect(name)}
                        className={`cursor-pointer ${
                          highlightedIndex === i
                            ? 'bg-surface-2 text-text-secondary'
                            : 'text-brand-muted-foreground hover:bg-surface-2'
                        }`}
                      >
                        {name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.length > 0 && (
                  <CommandGroup
                    heading="Search Results"
                    className="text-text-muted"
                  >
                    {results.slice(0, 10).map((name, i) => {
                      const index = effectiveSuggestions.length + i
                      return (
                        <CommandItem
                          key={name}
                          value={name}
                          data-commander-option-index={index}
                          id={`${id}-option-${index}`}
                          role="option"
                          tabIndex={-1}
                          aria-selected={highlightedIndex === index}
                          onSelect={() => handleSelect(name)}
                          className={`cursor-pointer ${
                            highlightedIndex === index
                              ? 'bg-surface-2 text-text-secondary'
                              : 'text-text-secondary hover:bg-surface-2'
                          }`}
                        >
                          {name}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )}
                {!loading &&
                  results.length === 0 &&
                  effectiveSuggestions.length === 0 &&
                  query.length >= 2 && (
                    <CommandEmpty className="text-text-muted">
                      No cards found
                    </CommandEmpty>
                  )}
              </CommandList>
            </div>
          </Command>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exported utilities for external use
// ─────────────────────────────────────────────────────────────────────────────
export { detectDualCommanderKeywords, getSpecificPartner }
