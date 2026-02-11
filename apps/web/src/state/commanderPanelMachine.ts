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

/** Per-player edit state when that player is in edit mode */
export interface SinglePlayerEditState {
  editingSlot1: boolean
  editingSlot2: boolean
  commander1Name: string
  commander2Name: string
  commander1Card: ScryfallCard | null
  commander2Card: ScryfallCard | null
  dualKeywords: DualCommanderKeyword[]
  specificPartner: string | null
  allowsSecondCommander: boolean
  commander2Suggestions: string[]
  suggestionsLabel: string
}

function defaultSinglePlayerEditState(
  overrides: Partial<SinglePlayerEditState> = {},
): SinglePlayerEditState {
  return {
    editingSlot1: true,
    editingSlot2: true,
    commander1Name: '',
    commander2Name: '',
    commander1Card: null,
    commander2Card: null,
    dualKeywords: [],
    specificPartner: null,
    allowsSecondCommander: false,
    commander2Suggestions: [],
    suggestionsLabel: 'Suggested',
    ...overrides,
  }
}

export interface CommanderPanelContext {
  /** Multiple players can be in edit mode at once */
  editingPlayerIds: string[]
  editStateByPlayerId: Record<string, SinglePlayerEditState>
  /** Which player we're currently fetching suggestions for (if any) */
  fetchingSuggestionsForPlayerId: string | null

  // Save tracking (last save across any player)
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
  | { type: 'DONE_EDIT'; playerId: string }
  | { type: 'ENTER_SLOT_EDIT'; playerId: string; slot: 1 | 2 }
  | { type: 'SET_CMD1_NAME'; playerId: string; name: string }
  | { type: 'SET_CMD2_NAME'; playerId: string; name: string }
  | { type: 'CMD1_RESOLVED'; playerId: string; card: ScryfallCard | null }
  | { type: 'CMD2_RESOLVED'; playerId: string; card: ScryfallCard | null }
  | { type: 'CLEAR_CMD'; playerId: string; slot: 1 | 2 }
  | { type: 'SAVE_REQUESTED'; triggeredBy: 1 | 2 }
  | { type: 'SAVE_SUCCEEDED' }
  | { type: 'SAVE_FAILED'; error: string }
  | {
      type: 'SUGGESTIONS_LOADED'
      playerId: string
      suggestions: string[]
      label: string
    }

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
  guards: {},
  actions: {
    clearCommanderState: assign({
      editingPlayerIds: [],
      editStateByPlayerId: {},
      fetchingSuggestionsForPlayerId: null,
    }),
    /** CMD1_RESOLVED: set new commander 1 and clear commander 2 only when user *changes* commander 1 to a card with no dual or different dual type. */
    setCommander1AndMaybeClearCommander2: assign(({ context, event }) => {
      if (event.type !== 'CMD1_RESOLVED') return {}
      const playerId = event.playerId
      const state = context.editStateByPlayerId[playerId]
      if (!state) return {}
      const oldCard = state.commander1Card
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
      const clearCommander2 =
        oldCard != null && (!allowsSecondCommander || !sameDualType)
      const next: SinglePlayerEditState = !newCard
        ? {
            ...state,
            commander1Card: null,
            commander2Card: null,
            commander1Name: '',
            commander2Name: '',
            dualKeywords: [],
            specificPartner: null,
            allowsSecondCommander: false,
            commander2Suggestions: [],
            suggestionsLabel: 'Suggested',
          }
        : {
            ...state,
            commander1Card: newCard,
            dualKeywords: newKeywords,
            specificPartner: getSpecificPartner(newCard),
            allowsSecondCommander,
            ...(clearCommander2
              ? { commander2Name: '', commander2Card: null }
              : {}),
          }
      return {
        editStateByPlayerId: {
          ...context.editStateByPlayerId,
          [playerId]: next,
        },
      }
    }),
  },
}).createMachine({
  id: 'commanderPanel',
  initial: 'closed',
  context: {
    editingPlayerIds: [],
    editStateByPlayerId: {},
    fetchingSuggestionsForPlayerId: null,
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
          actions: ['clearCommanderState'],
        },
        START_EDIT: {
          target: 'editing',
          actions: assign(({ context, event }) => {
            const slot = event.slot
            const playerId = event.playerId
            const alreadyEditing = context.editingPlayerIds.includes(playerId)
            if (alreadyEditing) {
              const state = context.editStateByPlayerId[playerId]
              if (!state) return {}
              return {
                editStateByPlayerId: {
                  ...context.editStateByPlayerId,
                  [playerId]: {
                    ...state,
                    editingSlot1: slot === undefined || slot === 1,
                    editingSlot2: slot === undefined || slot === 2,
                  },
                },
              }
            }
            const nextState = defaultSinglePlayerEditState({
              commander1Name: event.commander1Name,
              commander2Name: event.commander2Name,
              editingSlot1: slot === undefined || slot === 1,
              editingSlot2: slot === undefined || slot === 2,
            })
            return {
              editingPlayerIds: [...context.editingPlayerIds, playerId],
              editStateByPlayerId: {
                ...context.editStateByPlayerId,
                [playerId]: nextState,
              },
            }
          }),
        },
      },
    },
    editing: {
      initial: 'idle',
      on: {
        DONE_EDIT: [
          {
            target: 'viewing',
            guard: ({ context, event }) =>
              context.editingPlayerIds.filter((id) => id !== event.playerId)
                .length === 0,
            actions: assign(({ context, event }) => {
              const playerId = event.playerId
              const nextIds = context.editingPlayerIds.filter(
                (id) => id !== playerId,
              )
              const nextEditState = { ...context.editStateByPlayerId }
              delete nextEditState[playerId]
              return {
                editingPlayerIds: nextIds,
                editStateByPlayerId: nextEditState,
                ...(context.fetchingSuggestionsForPlayerId === playerId
                  ? { fetchingSuggestionsForPlayerId: null }
                  : {}),
              }
            }),
          },
          {
            target: 'editing',
            guard: ({ context, event }) =>
              context.editingPlayerIds.filter((id) => id !== event.playerId)
                .length > 0,
            actions: assign(({ context, event }) => {
              const playerId = event.playerId
              const nextIds = context.editingPlayerIds.filter(
                (id) => id !== playerId,
              )
              const nextEditState = { ...context.editStateByPlayerId }
              delete nextEditState[playerId]
              return {
                editingPlayerIds: nextIds,
                editStateByPlayerId: nextEditState,
                ...(context.fetchingSuggestionsForPlayerId === playerId
                  ? { fetchingSuggestionsForPlayerId: null }
                  : {}),
              }
            }),
          },
        ],
        CLOSE_PANEL: {
          target: 'closed',
          actions: ['clearCommanderState'],
        },
        START_EDIT: {
          actions: assign(({ context, event }) => {
            const slot = event.slot
            const playerId = event.playerId
            if (context.editingPlayerIds.includes(playerId)) {
              const state = context.editStateByPlayerId[playerId]
              if (!state) return {}
              return {
                editStateByPlayerId: {
                  ...context.editStateByPlayerId,
                  [playerId]: {
                    ...state,
                    editingSlot1: slot === undefined || slot === 1,
                    editingSlot2: slot === undefined || slot === 2,
                  },
                },
              }
            }
            const nextState = defaultSinglePlayerEditState({
              commander1Name: event.commander1Name,
              commander2Name: event.commander2Name,
              editingSlot1: slot === undefined || slot === 1,
              editingSlot2: slot === undefined || slot === 2,
            })
            return {
              editingPlayerIds: [...context.editingPlayerIds, playerId],
              editStateByPlayerId: {
                ...context.editStateByPlayerId,
                [playerId]: nextState,
              },
            }
          }),
        },
        ENTER_SLOT_EDIT: {
          actions: assign(({ context, event }) => {
            const { playerId, slot } = event
            const state = context.editStateByPlayerId[playerId]
            if (!state) return {}
            return {
              editStateByPlayerId: {
                ...context.editStateByPlayerId,
                [playerId]: {
                  ...state,
                  editingSlot1: slot === 1,
                  editingSlot2: slot === 2,
                },
              },
            }
          }),
        },
        SET_CMD1_NAME: {
          actions: assign(({ context, event }) => {
            const { playerId, name } = event
            const state = context.editStateByPlayerId[playerId]
            if (!state) return {}
            return {
              editStateByPlayerId: {
                ...context.editStateByPlayerId,
                [playerId]: { ...state, commander1Name: name },
              },
            }
          }),
        },
        SET_CMD2_NAME: {
          actions: assign(({ context, event }) => {
            const { playerId, name } = event
            const state = context.editStateByPlayerId[playerId]
            if (!state) return {}
            return {
              editStateByPlayerId: {
                ...context.editStateByPlayerId,
                [playerId]: { ...state, commander2Name: name },
              },
            }
          }),
        },
        CMD1_RESOLVED: {
          target: '.fetchingSuggestions',
          actions: [
            'setCommander1AndMaybeClearCommander2',
            assign(({ event }) => ({
              fetchingSuggestionsForPlayerId: event.playerId,
            })),
          ],
        },
        CMD2_RESOLVED: {
          actions: assign(({ context, event }) => {
            const { playerId, card } = event
            const state = context.editStateByPlayerId[playerId]
            if (!state) return {}
            return {
              editStateByPlayerId: {
                ...context.editStateByPlayerId,
                [playerId]: { ...state, commander2Card: card },
              },
            }
          }),
        },
        CLEAR_CMD: {
          actions: assign(({ context, event }) => {
            const { playerId, slot } = event
            const state = context.editStateByPlayerId[playerId]
            if (!state) return {}
            if (slot === 1) {
              return {
                editStateByPlayerId: {
                  ...context.editStateByPlayerId,
                  [playerId]: {
                    ...state,
                    commander1Name: '',
                    commander1Card: null,
                    commander2Name: '',
                    commander2Card: null,
                    dualKeywords: [],
                    specificPartner: null,
                    allowsSecondCommander: false,
                    commander2Suggestions: [],
                    suggestionsLabel: 'Suggested',
                  },
                },
              }
            }
            return {
              editStateByPlayerId: {
                ...context.editStateByPlayerId,
                [playerId]: {
                  ...state,
                  commander2Name: '',
                  commander2Card: null,
                },
              },
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
            input: ({ context }) => {
              const playerId = context.fetchingSuggestionsForPlayerId
              const state = playerId
                ? context.editStateByPlayerId[playerId]
                : null
              if (!playerId || !state?.commander1Card)
                throw new Error('fetchSuggestions: no player or commander1Card')
              return {
                card: state.commander1Card,
                dualKeywords: state.dualKeywords,
                specificPartner: state.specificPartner,
              }
            },
            onDone: {
              target: 'idle',
              actions: assign(({ context, event }) => {
                const playerId = context.fetchingSuggestionsForPlayerId
                if (!playerId) return {}
                const state = context.editStateByPlayerId[playerId]
                if (!state) return { fetchingSuggestionsForPlayerId: null }
                return {
                  fetchingSuggestionsForPlayerId: null,
                  editStateByPlayerId: {
                    ...context.editStateByPlayerId,
                    [playerId]: {
                      ...state,
                      commander2Suggestions: event.output.suggestions,
                      suggestionsLabel: event.output.label,
                    },
                  },
                }
              }),
            },
            onError: {
              target: 'idle',
              actions: assign(({ context }) => {
                const playerId = context.fetchingSuggestionsForPlayerId
                if (!playerId) return { fetchingSuggestionsForPlayerId: null }
                const state = context.editStateByPlayerId[playerId]
                if (!state) return { fetchingSuggestionsForPlayerId: null }
                return {
                  fetchingSuggestionsForPlayerId: null,
                  editStateByPlayerId: {
                    ...context.editStateByPlayerId,
                    [playerId]: {
                      ...state,
                      commander2Suggestions: [],
                      suggestionsLabel: 'Suggested',
                    },
                  },
                }
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
