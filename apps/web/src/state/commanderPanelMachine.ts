/**
 * XState machine for managing commander panel state
 *
 * Handles: editing mode, commander pair state, suggestions, and save lifecycle
 */

import type { DualCommanderKeyword, ScryfallCard } from '@/lib/scryfall'
import {
  detectDualCommanderKeywords,
  getSpecificPartner,
  searchBackgrounds,
  searchByKeyword,
} from '@/lib/scryfall'
import { assign, fromPromise, setup } from 'xstate'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CommanderPanelContext {
  // Editing state
  editingPlayerId: string | null
  /** Independent edit state for each slot when editingPlayerId is set */
  editingSlot1: boolean
  editingSlot2: boolean

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
  | { type: 'OPEN_PANEL' }
  | { type: 'CLOSE_PANEL' }
  | {
      type: 'START_EDIT'
      playerId: string
      commander1Name: string
      commander2Name: string
      slot?: 1 | 2
    }
  | { type: 'DONE_EDIT' }
  | { type: 'ENTER_SLOT_EDIT'; slot: 1 | 2 }
  | { type: 'SET_CMD1_NAME'; name: string }
  | { type: 'SET_CMD2_NAME'; name: string }
  | { type: 'CMD1_RESOLVED'; card: ScryfallCard | null }
  | { type: 'CMD2_RESOLVED'; card: ScryfallCard | null }
  | { type: 'CLEAR_CMD'; slot: 1 | 2 }
  | { type: 'SAVE_REQUESTED'; triggeredBy: 1 | 2 }
  | { type: 'SAVE_SUCCEEDED' }
  | { type: 'SAVE_FAILED'; error: string }
  | { type: 'SUGGESTIONS_LOADED'; suggestions: string[]; label: string }

// ─────────────────────────────────────────────────────────────────────────────
// Actors (async services)
// ─────────────────────────────────────────────────────────────────────────────

const fetchSuggestionsActor = fromPromise<
  { suggestions: string[]; label: string },
  {
    card: ScryfallCard
    dualKeywords: DualCommanderKeyword[]
    specificPartner: string | null
  }
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
          commander2Name: '',
          commander2Card: null,
        }
      }
      const dualKeywords = detectDualCommanderKeywords(card)
      const specificPartner = getSpecificPartner(card)
      const allowsSecondCommander = dualKeywords.length > 0
      return {
        dualKeywords,
        specificPartner,
        allowsSecondCommander,
        // Clear commander 2 when the new commander 1 does not allow a second
        ...(allowsSecondCommander
          ? {}
          : { commander2Name: '', commander2Card: null }),
      }
    }),
    /** CMD1_RESOLVED: set new commander 1 and clear commander 2 only when user *changes* commander 1 to a card with no dual or different dual type (not when loading initial state on enter edit). */
    setCommander1AndMaybeClearCommander2: assign(({ context, event }) => {
      if (event.type !== 'CMD1_RESOLVED') return {}
      const oldCard = context.commander1Card
      const newCard = event.card
      const oldKeywords = oldCard
        ? detectDualCommanderKeywords(oldCard)
        : ([] as DualCommanderKeyword[])
      const newKeywords = newCard
        ? detectDualCommanderKeywords(newCard)
        : ([] as DualCommanderKeyword[])
      const allowsSecondCommander = newKeywords.length > 0
      const sameDualType =
        oldKeywords.length === newKeywords.length &&
        oldKeywords.every((k) => newKeywords.includes(k))
      // Only clear commander 2 when user actually changed commander 1 (oldCard was set) and the new card has no second slot or different dual type
      const clearCommander2 =
        oldCard != null && (!allowsSecondCommander || !sameDualType)
      if (!newCard) {
        return {
          commander1Card: null,
          dualKeywords: [] as DualCommanderKeyword[],
          specificPartner: null,
          allowsSecondCommander: false,
          commander2Name: '',
          commander2Card: null,
        }
      }
      return {
        commander1Card: newCard,
        dualKeywords: newKeywords,
        specificPartner: getSpecificPartner(newCard),
        allowsSecondCommander,
        ...(clearCommander2
          ? { commander2Name: '', commander2Card: null }
          : {}),
      }
    }),
  },
}).createMachine({
  id: 'commanderPanel',
  initial: 'closed',
  context: {
    editingPlayerId: null,
    editingSlot1: false,
    editingSlot2: false,
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
        OPEN_PANEL: 'viewing',
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
          actions: assign(({ event }) => {
            const slot = event.slot
            return {
              editingPlayerId: event.playerId,
              editingSlot1: slot === undefined || slot === 1,
              editingSlot2: slot === undefined || slot === 2,
              commander1Name: event.commander1Name,
              commander2Name: event.commander2Name,
              commander1Card: null,
              commander2Card: null,
              dualKeywords: [] as DualCommanderKeyword[],
              specificPartner: null,
              allowsSecondCommander: false,
              commander2Suggestions: [],
              suggestionsLabel: 'Suggested',
            }
          }),
        },
      },
    },
    editing: {
      initial: 'idle',
      on: {
        DONE_EDIT: {
          target: 'viewing',
          actions: assign({
            editingPlayerId: null,
            editingSlot1: false,
            editingSlot2: false,
          }),
        },
        CLOSE_PANEL: {
          target: 'closed',
          actions: [
            'clearCommanderState',
            assign({
              editingPlayerId: null,
              editingSlot1: false,
              editingSlot2: false,
            }),
          ],
        },
        ENTER_SLOT_EDIT: {
          actions: assign(({ event }) =>
            event.slot === 1 ? { editingSlot1: true } : { editingSlot2: true },
          ),
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
          actions: ['setCommander1AndMaybeClearCommander2'],
        },
        CMD2_RESOLVED: {
          actions: assign({
            commander2Card: ({ event }) => event.card,
          }),
        },
        CLEAR_CMD: {
          actions: assign(({ event }) => {
            if (event.slot === 1) {
              // Clearing commander 1 also clears commander 2 (no partner without commander 1)
              return {
                commander1Name: '',
                commander1Card: null,
                commander2Name: '',
                commander2Card: null,
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
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guaranteed by machine flow (only called from states where commander1Card exists)
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
