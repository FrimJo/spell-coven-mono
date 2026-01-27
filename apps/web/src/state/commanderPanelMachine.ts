/**
 * XState machine for managing commander panel state
 *
 * Handles: editing mode, commander pair state, suggestions, and save lifecycle
 */

import { assign, setup, fromPromise } from 'xstate'
import type { DualCommanderKeyword, ScryfallCard } from '@/lib/scryfall'
import {
  detectDualCommanderKeywords,
  getSpecificPartner,
  searchBackgrounds,
  searchByKeyword,
} from '@/lib/scryfall'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CommanderPanelContext {
  // Editing state
  editingPlayerId: string | null
  viewedPlayerSlotCollapsed: boolean

  // Commander pair state
  commander1Name: string
  commander2Name: string
  commander1Card: ScryfallCard | null
  commander2Card: ScryfallCard | null

  // Derived from commander1Card
  dualKeywords: DualCommanderKeyword[]
  specificPartner: string | null
  allowsSecondCommander: boolean

  // Suggestions for Commander 2
  commander2Suggestions: string[]
  suggestionsLabel: string

  // Save tracking
  lastSaveTriggeredBy: 1 | 2 | null
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  saveError: string | null
}

export type CommanderPanelEvent =
  | { type: 'OPEN_PANEL'; viewedPlayerHasCommanders: boolean }
  | { type: 'CLOSE_PANEL' }
  | { type: 'START_EDIT'; playerId: string; commander1Name: string; commander2Name: string }
  | { type: 'DONE_EDIT' }
  | { type: 'SET_CMD1_NAME'; name: string }
  | { type: 'SET_CMD2_NAME'; name: string }
  | { type: 'CMD1_RESOLVED'; card: ScryfallCard | null }
  | { type: 'CMD2_RESOLVED'; card: ScryfallCard | null }
  | { type: 'CLEAR_CMD'; slot: 1 | 2 }
  | { type: 'TOGGLE_COLLAPSED' }
  | { type: 'SET_COLLAPSED'; collapsed: boolean }
  | { type: 'SAVE_REQUESTED'; triggeredBy: 1 | 2 }
  | { type: 'SAVE_SUCCEEDED' }
  | { type: 'SAVE_FAILED'; error: string }
  | { type: 'SUGGESTIONS_LOADED'; suggestions: string[]; label: string }

// ─────────────────────────────────────────────────────────────────────────────
// Actors (async services)
// ─────────────────────────────────────────────────────────────────────────────

const fetchSuggestionsActor = fromPromise<
  { suggestions: string[]; label: string },
  { card: ScryfallCard; dualKeywords: DualCommanderKeyword[]; specificPartner: string | null }
>(async ({ input }) => {
  const { card, dualKeywords, specificPartner } = input

  if (dualKeywords.length === 0) {
    return { suggestions: [], label: 'Suggested' }
  }

  if (dualKeywords.includes('Partner with') && specificPartner) {
    return { suggestions: [specificPartner], label: 'Partner' }
  }

  if (dualKeywords.includes('Choose a background')) {
    const backgrounds = await searchBackgrounds()
    return {
      suggestions: backgrounds.map((c) => c.name).slice(0, 20),
      label: 'Backgrounds',
    }
  }

  if (dualKeywords.includes('Partner')) {
    const partners = await searchByKeyword('Partner')
    const filtered = partners
      .filter((c) => c.name !== card.name)
      .map((c) => c.name)
      .slice(0, 20)
      .filter(Boolean)
    return { suggestions: filtered, label: 'Partners' }
  }

  if (dualKeywords.includes('Friends forever')) {
    const friends = await searchByKeyword('Friends forever')
    const filtered = friends
      .filter((c) => c.name !== card.name)
      .map((c) => c.name)
      .slice(0, 20)
      .filter(Boolean)
    return { suggestions: filtered, label: 'Friends Forever' }
  }

  if (dualKeywords.includes("Doctor's companion")) {
    const companions = await searchByKeyword("Doctor's companion")
    const filtered = companions
      .filter((c) => c.name !== card.name)
      .map((c) => c.name)
      .slice(0, 20)
      .filter(Boolean)
    return { suggestions: filtered, label: "Doctor's Companions" }
  }

  return { suggestions: [], label: 'Suggested' }
})

// ─────────────────────────────────────────────────────────────────────────────
// Machine
// ─────────────────────────────────────────────────────────────────────────────

export const commanderPanelMachine = setup({
  types: {
    context: {} as CommanderPanelContext,
    events: {} as CommanderPanelEvent,
  },
  actors: {
    fetchSuggestions: fetchSuggestionsActor,
  },
  guards: {
    hasCommander1Card: ({ context }) => context.commander1Card !== null,
    hasDualKeywords: ({ context }) => context.dualKeywords.length > 0,
  },
  actions: {
    clearCommanderState: assign({
      commander1Name: '',
      commander2Name: '',
      commander1Card: null,
      commander2Card: null,
      dualKeywords: [],
      specificPartner: null,
      allowsSecondCommander: false,
      commander2Suggestions: [],
      suggestionsLabel: 'Suggested',
    }),
    updateDerivedFromCard1: assign(({ context }) => {
      const card = context.commander1Card
      if (!card) {
        return {
          dualKeywords: [] as DualCommanderKeyword[],
          specificPartner: null,
          allowsSecondCommander: false,
        }
      }
      const dualKeywords = detectDualCommanderKeywords(card)
      const specificPartner = getSpecificPartner(card)
      return {
        dualKeywords,
        specificPartner,
        allowsSecondCommander: dualKeywords.length > 0,
      }
    }),
  },
}).createMachine({
  id: 'commanderPanel',
  initial: 'closed',
  context: {
    editingPlayerId: null,
    viewedPlayerSlotCollapsed: true,
    commander1Name: '',
    commander2Name: '',
    commander1Card: null,
    commander2Card: null,
    dualKeywords: [],
    specificPartner: null,
    allowsSecondCommander: false,
    commander2Suggestions: [],
    suggestionsLabel: 'Suggested',
    lastSaveTriggeredBy: null,
    saveStatus: 'idle',
    saveError: null,
  },
  states: {
    closed: {
      on: {
        OPEN_PANEL: {
          target: 'viewing',
          actions: assign({
            viewedPlayerSlotCollapsed: ({ event }) => event.viewedPlayerHasCommanders,
          }),
        },
      },
    },
    viewing: {
      on: {
        CLOSE_PANEL: {
          target: 'closed',
          actions: ['clearCommanderState', assign({ editingPlayerId: null })],
        },
        START_EDIT: {
          target: 'editing',
          actions: assign({
            editingPlayerId: ({ event }) => event.playerId,
            commander1Name: ({ event }) => event.commander1Name,
            commander2Name: ({ event }) => event.commander2Name,
            commander1Card: null,
            commander2Card: null,
            dualKeywords: [],
            specificPartner: null,
            allowsSecondCommander: false,
            commander2Suggestions: [],
            suggestionsLabel: 'Suggested',
          }),
        },
        TOGGLE_COLLAPSED: {
          actions: assign({
            viewedPlayerSlotCollapsed: ({ context }) => !context.viewedPlayerSlotCollapsed,
          }),
        },
        SET_COLLAPSED: {
          actions: assign({
            viewedPlayerSlotCollapsed: ({ event }) => event.collapsed,
          }),
        },
      },
    },
    editing: {
      initial: 'idle',
      on: {
        DONE_EDIT: {
          target: 'viewing',
          actions: assign({ editingPlayerId: null }),
        },
        CLOSE_PANEL: {
          target: 'closed',
          actions: ['clearCommanderState', assign({ editingPlayerId: null })],
        },
        SET_CMD1_NAME: {
          actions: assign({
            commander1Name: ({ event }) => event.name,
          }),
        },
        SET_CMD2_NAME: {
          actions: assign({
            commander2Name: ({ event }) => event.name,
          }),
        },
        CMD1_RESOLVED: {
          target: '.fetchingSuggestions',
          actions: [
            assign({
              commander1Card: ({ event }) => event.card,
            }),
            'updateDerivedFromCard1',
          ],
        },
        CMD2_RESOLVED: {
          actions: assign({
            commander2Card: ({ event }) => event.card,
          }),
        },
        CLEAR_CMD: {
          actions: assign(({ context, event }) => {
            if (event.slot === 1) {
              return {
                commander1Name: '',
                commander1Card: null,
                dualKeywords: [] as DualCommanderKeyword[],
                specificPartner: null,
                allowsSecondCommander: false,
                commander2Suggestions: [],
                suggestionsLabel: 'Suggested',
              }
            }
            return {
              commander2Name: '',
              commander2Card: null,
            }
          }),
        },
        TOGGLE_COLLAPSED: {
          actions: assign({
            viewedPlayerSlotCollapsed: ({ context }) => !context.viewedPlayerSlotCollapsed,
          }),
        },
        SET_COLLAPSED: {
          actions: assign({
            viewedPlayerSlotCollapsed: ({ event }) => event.collapsed,
          }),
        },
      },
      states: {
        idle: {
          on: {
            SAVE_REQUESTED: {
              target: 'saving',
              actions: assign({
                lastSaveTriggeredBy: ({ event }) => event.triggeredBy,
                saveStatus: 'saving',
                saveError: null,
              }),
            },
          },
        },
        saving: {
          on: {
            SAVE_SUCCEEDED: {
              target: 'idle',
              actions: assign({
                saveStatus: 'saved',
              }),
            },
            SAVE_FAILED: {
              target: 'idle',
              actions: assign({
                saveStatus: 'error',
                saveError: ({ event }) => event.error,
              }),
            },
            // Allow new save requests to override
            SAVE_REQUESTED: {
              actions: assign({
                lastSaveTriggeredBy: ({ event }) => event.triggeredBy,
              }),
            },
          },
        },
        fetchingSuggestions: {
          invoke: {
            id: 'fetchSuggestions',
            src: 'fetchSuggestions',
            input: ({ context }) => ({
              card: context.commander1Card!,
              dualKeywords: context.dualKeywords,
              specificPartner: context.specificPartner,
            }),
            onDone: {
              target: 'idle',
              actions: assign({
                commander2Suggestions: ({ event }) => event.output.suggestions,
                suggestionsLabel: ({ event }) => event.output.label,
              }),
            },
            onError: {
              target: 'idle',
              actions: assign({
                commander2Suggestions: [],
                suggestionsLabel: 'Suggested',
              }),
            },
          },
          on: {
            SAVE_REQUESTED: {
              target: 'saving',
              actions: assign({
                lastSaveTriggeredBy: ({ event }) => event.triggeredBy,
                saveStatus: 'saving',
                saveError: null,
              }),
            },
          },
        },
      },
    },
  },
})

export type CommanderPanelMachine = typeof commanderPanelMachine
