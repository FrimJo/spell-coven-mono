/**
 * XState machine for managing media setup flow
 *
 * Handles: permissions check, device configuration, cancel/restore, and completion
 *
 * The machine drives UI state while localStorage (via useSelectedMediaDevice)
 * remains the source of truth for device selections and enabled state.
 */

import { assign, setup } from 'xstate'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OriginalDeviceState {
  videoDeviceId: string | null
  audioInputDeviceId: string | null
  audioOutputDeviceId: string | null
  videoEnabled: boolean
  audioEnabled: boolean
}

export interface MediaSetupContext {
  /**
   * Snapshot of device state when setup dialog opened.
   * Used to restore on cancel in in-game settings mode.
   */
  originalState: OriginalDeviceState | null

  /**
   * Whether this is an in-game settings flow (has restore behavior on cancel)
   * vs initial setup flow (cancel navigates away without restore)
   */
  isInGameSettings: boolean

  /**
   * Error message to display (permission errors, device errors, etc.)
   */
  errorMessage: string | null
}

export type MediaSetupEvent =
  // Permission flow
  | { type: 'PERMISSIONS_CHECKING' }
  | { type: 'PERMISSIONS_GRANTED' }
  | { type: 'PERMISSIONS_DENIED' }
  | { type: 'REQUEST_PERMISSIONS' }
  // Device configuration
  | { type: 'SELECT_VIDEO_DEVICE'; deviceId: string }
  | { type: 'SELECT_AUDIO_INPUT'; deviceId: string }
  | { type: 'SELECT_AUDIO_OUTPUT'; deviceId: string }
  | { type: 'TOGGLE_VIDEO'; enabled: boolean }
  | { type: 'TOGGLE_AUDIO'; enabled: boolean }
  // Error handling
  | { type: 'SET_ERROR'; message: string }
  | { type: 'CLEAR_ERROR' }
  // Actions
  | { type: 'COMPLETE' }
  | { type: 'CANCEL' }
  // Dialog lifecycle
  | {
      type: 'OPEN'
      isInGameSettings: boolean
      currentState: OriginalDeviceState
    }
  | { type: 'CLOSE' }

// ─────────────────────────────────────────────────────────────────────────────
// Machine
// ─────────────────────────────────────────────────────────────────────────────

export const mediaSetupMachine = setup({
  types: {
    context: {} as MediaSetupContext,
    events: {} as MediaSetupEvent,
  },
  guards: {
    isInGameSettings: ({ context }) => context.isInGameSettings,
    hasOriginalState: ({ context }) => context.originalState !== null,
  },
  actions: {
    captureOriginalState: assign({
      originalState: ({ event }) => {
        if (event.type === 'OPEN') {
          return event.currentState
        }
        return null
      },
      isInGameSettings: ({ event }) => {
        if (event.type === 'OPEN') {
          return event.isInGameSettings
        }
        return false
      },
    }),
    clearOriginalState: assign({
      originalState: null,
      isInGameSettings: false,
    }),
    setError: assign({
      errorMessage: ({ event }) => {
        if (event.type === 'SET_ERROR') {
          return event.message
        }
        return null
      },
    }),
    clearError: assign({
      errorMessage: null,
    }),
  },
}).createMachine({
  id: 'mediaSetup',
  initial: 'closed',
  context: {
    originalState: null,
    isInGameSettings: false,
    errorMessage: null,
  },
  states: {
    closed: {
      on: {
        OPEN: {
          target: 'checkingPermissions',
          actions: 'captureOriginalState',
        },
      },
    },

    checkingPermissions: {
      on: {
        PERMISSIONS_GRANTED: {
          target: 'configuringDevices',
        },
        PERMISSIONS_DENIED: {
          target: 'permissionsDenied',
        },
        PERMISSIONS_CHECKING: {
          // Stay in this state while checking
        },
        CANCEL: {
          target: 'closed',
          actions: 'clearOriginalState',
        },
      },
    },

    permissionsDenied: {
      on: {
        REQUEST_PERMISSIONS: {
          target: 'requestingPermissions',
        },
        CANCEL: {
          target: 'closed',
          actions: 'clearOriginalState',
        },
      },
    },

    requestingPermissions: {
      on: {
        PERMISSIONS_GRANTED: {
          target: 'configuringDevices',
        },
        PERMISSIONS_DENIED: {
          target: 'permissionsDenied',
        },
        CANCEL: {
          target: 'closed',
          actions: 'clearOriginalState',
        },
      },
    },

    configuringDevices: {
      on: {
        // Device selection events - these are handled by the component
        // which calls the hooks to persist to localStorage
        SELECT_VIDEO_DEVICE: {},
        SELECT_AUDIO_INPUT: {},
        SELECT_AUDIO_OUTPUT: {},
        TOGGLE_VIDEO: {},
        TOGGLE_AUDIO: {},

        // Error handling
        SET_ERROR: {
          actions: 'setError',
        },
        CLEAR_ERROR: {
          actions: 'clearError',
        },

        // Complete setup
        COMPLETE: {
          target: 'closed',
          actions: 'clearOriginalState',
        },

        // Cancel - behavior depends on mode
        CANCEL: [
          {
            guard: 'isInGameSettings',
            target: 'restoring',
          },
          {
            target: 'closed',
            actions: 'clearOriginalState',
          },
        ],
      },
    },

    /**
     * Transient state for restoring original device state on cancel
     * in in-game settings mode. Component handles the actual restore.
     */
    restoring: {
      on: {
        CLOSE: {
          target: 'closed',
          actions: 'clearOriginalState',
        },
      },
    },
  },
})

export type MediaSetupMachine = typeof mediaSetupMachine
