/**
 * XState machine for managing commander search input state
 *
 * Handles: popover open/close, search query, autocomplete results, loading, selection
 */

import type { ScryfallCard } from '@/lib/scryfall'
import { getCardByName, searchCommanderAndSidekicks } from '@/lib/scryfall'
import { assign, fromPromise, setup } from 'xstate'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CommanderSearchContext {
  open: boolean
  query: string
  results: string[]
  loading: boolean
  suggestions: string[]
  suggestionsLabel: string
  resolvedCard: ScryfallCard | null
}

export type CommanderSearchEvent =
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'INPUT_CHANGED'; value: string }
  | { type: 'SET_EXTERNAL_VALUE'; value: string }
  | { type: 'SET_SUGGESTIONS'; suggestions: string[]; label: string }
  | { type: 'RESULT_SELECTED'; name: string }
  | { type: 'SUGGESTION_SELECTED'; name: string }
  | { type: 'SEARCH_RESOLVED'; results: string[] }
  | { type: 'SEARCH_FAILED' }
  | { type: 'CARD_RESOLVED'; card: ScryfallCard | null }
  | { type: 'OPEN_CHANGE'; open: boolean }
  | { type: 'RESET' }

// ─────────────────────────────────────────────────────────────────────────────
// Actors (async services)
// ─────────────────────────────────────────────────────────────────────────────

const searchActor = fromPromise<string[], { query: string }>(
  async ({ input }) => {
    if (input.query.length < 2) {
      return []
    }
    return searchCommanderAndSidekicks(input.query)
  },
)

const resolveCardActor = fromPromise<ScryfallCard | null, { name: string }>(
  async ({ input }) => {
    return getCardByName(input.name, false)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Machine
// ─────────────────────────────────────────────────────────────────────────────

export const commanderSearchMachine = setup({
  types: {
    context: {} as CommanderSearchContext,
    events: {} as CommanderSearchEvent,
  },
  actors: {
    search: searchActor,
    resolveCard: resolveCardActor,
  },
  guards: {
    queryLongEnough: ({ context }) => context.query.length >= 2,
    hasSuggestions: ({ context }) => context.suggestions.length > 0,
    hasResults: ({ context }) => context.results.length > 0,
  },
  delays: {
    debounce: 300,
  },
}).createMachine({
  id: 'commanderSearch',
  initial: 'idle',
  context: {
    open: false,
    query: '',
    results: [],
    loading: false,
    suggestions: [],
    suggestionsLabel: 'Suggested',
    resolvedCard: null,
  },
  on: {
    SET_EXTERNAL_VALUE: {
      actions: assign(({ event }) => ({
        query: event.value,
        ...(event.value === '' ? { resolvedCard: null } : {}),
      })),
    },
    SET_SUGGESTIONS: {
      actions: assign({
        suggestions: ({ event }) => event.suggestions,
        suggestionsLabel: ({ event }) => event.label,
      }),
    },
    RESET: {
      target: '.idle',
      actions: assign({
        open: false,
        query: '',
        results: [],
        loading: false,
        resolvedCard: null,
      }),
    },
    OPEN_CHANGE: {
      actions: assign({
        open: ({ event }) => event.open,
      }),
    },
  },
  states: {
    idle: {
      on: {
        FOCUS: [
          {
            target: 'focused',
            guard: 'queryLongEnough',
            actions: assign({ open: true, loading: true }),
          },
          {
            target: 'focused',
            guard: 'hasSuggestions',
            actions: assign({ open: true }),
          },
          { target: 'focused' },
        ],
        INPUT_CHANGED: {
          target: 'debouncing',
          actions: assign(({ event }) => ({
            query: event.value,
            open: true,
            ...(event.value === '' ? { resolvedCard: null } : {}),
          })),
        },
      },
    },
    focused: {
      invoke: {
        id: 'searchOnFocus',
        src: 'search',
        input: ({ context }) => ({ query: context.query }),
        onDone: {
          actions: assign({
            results: ({ event }) => event.output,
            loading: false,
          }),
        },
        onError: {
          actions: assign({
            results: [],
            loading: false,
          }),
        },
      },
      on: {
        BLUR: {
          target: 'closing',
        },
        INPUT_CHANGED: {
          target: 'debouncing',
          actions: assign(({ event }) => ({
            query: event.value,
            open: true,
            ...(event.value === '' ? { resolvedCard: null } : {}),
          })),
        },
        RESULT_SELECTED: {
          target: 'resolving',
          actions: assign({
            query: ({ event }) => event.name,
            open: false,
            results: [],
          }),
        },
        SUGGESTION_SELECTED: {
          target: 'resolving',
          actions: assign({
            query: ({ event }) => event.name,
            open: false,
            results: [],
          }),
        },
      },
    },
    debouncing: {
      after: {
        debounce: 'searching',
      },
      on: {
        INPUT_CHANGED: {
          target: 'debouncing',
          reenter: true,
          actions: assign(({ event }) => ({
            query: event.value,
            ...(event.value === '' ? { resolvedCard: null } : {}),
          })),
        },
        BLUR: {
          target: 'closing',
        },
        RESULT_SELECTED: {
          target: 'resolving',
          actions: assign({
            query: ({ event }) => event.name,
            open: false,
            results: [],
          }),
        },
        SUGGESTION_SELECTED: {
          target: 'resolving',
          actions: assign({
            query: ({ event }) => event.name,
            open: false,
            results: [],
          }),
        },
      },
    },
    searching: {
      entry: assign({ loading: true }),
      invoke: {
        id: 'search',
        src: 'search',
        input: ({ context }) => ({ query: context.query }),
        onDone: {
          target: 'showingResults',
          actions: assign({
            results: ({ event }) => event.output,
            loading: false,
          }),
        },
        onError: {
          target: 'showingResults',
          actions: assign({
            results: [],
            loading: false,
          }),
        },
      },
      on: {
        INPUT_CHANGED: {
          target: 'debouncing',
          actions: assign(({ event }) => ({
            query: event.value,
            ...(event.value === '' ? { resolvedCard: null } : {}),
          })),
        },
        BLUR: {
          target: 'closing',
        },
        RESULT_SELECTED: {
          target: 'resolving',
          actions: assign({
            query: ({ event }) => event.name,
            open: false,
            results: [],
          }),
        },
        SUGGESTION_SELECTED: {
          target: 'resolving',
          actions: assign({
            query: ({ event }) => event.name,
            open: false,
            results: [],
          }),
        },
      },
    },
    showingResults: {
      on: {
        INPUT_CHANGED: {
          target: 'debouncing',
          actions: assign(({ event }) => ({
            query: event.value,
            ...(event.value === '' ? { resolvedCard: null } : {}),
          })),
        },
        BLUR: {
          target: 'closing',
        },
        RESULT_SELECTED: {
          target: 'resolving',
          actions: assign({
            query: ({ event }) => event.name,
            open: false,
            results: [],
          }),
        },
        SUGGESTION_SELECTED: {
          target: 'resolving',
          actions: assign({
            query: ({ event }) => event.name,
            open: false,
            results: [],
          }),
        },
      },
    },
    resolving: {
      invoke: {
        id: 'resolveCard',
        src: 'resolveCard',
        input: ({ context }) => ({ name: context.query }),
        onDone: {
          target: 'idle',
          actions: assign({
            resolvedCard: ({ event }) => event.output,
          }),
        },
        onError: {
          target: 'idle',
          actions: assign({
            resolvedCard: null,
          }),
        },
      },
    },
    closing: {
      after: {
        200: 'idle', // delay to allow click on item
      },
      on: {
        FOCUS: {
          target: 'focused',
          actions: assign({ open: true }),
        },
        RESULT_SELECTED: {
          target: 'resolving',
          actions: assign({
            query: ({ event }) => event.name,
            open: false,
            results: [],
          }),
        },
        SUGGESTION_SELECTED: {
          target: 'resolving',
          actions: assign({
            query: ({ event }) => event.name,
            open: false,
            results: [],
          }),
        },
      },
      exit: assign({ open: false }),
    },
  },
})

export type CommanderSearchMachine = typeof commanderSearchMachine
