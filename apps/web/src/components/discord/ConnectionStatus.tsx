import { useDiscordAuth } from '../../hooks/useDiscordAuth'
import { useDiscordConnection } from '../../hooks/useDiscordConnection'

/**
 * Discord Gateway Connection Status Component
 * Displays real-time connection status indicator
 *
 * States:
 * - Connected: Green indicator
 * - Connecting: Yellow pulsing indicator
 * - Reconnecting: Yellow pulsing with attempt count
 * - Error: Red indicator with retry button
 * - Disconnected: Gray indicator (when not authenticated)
 */

export function ConnectionStatus() {
  const { token, isAuthenticated } = useDiscordAuth()
  const {
    connectionState,
    isConnected,
    isConnecting,
    isReconnecting,
    hasError,
    error,
    retry,
  } = useDiscordConnection(token?.accessToken ?? null)

  if (!isAuthenticated) {
    return null
  }

  // Determine status color and icon
  const getStatusConfig = () => {
    if (isConnected) {
      return {
        color: 'bg-green-500',
        text: 'Connected',
        icon: (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ),
        pulse: false,
      }
    }

    if (isConnecting) {
      return {
        color: 'bg-yellow-500',
        text: 'Connecting...',
        icon: (
          <svg
            className="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ),
        pulse: true,
      }
    }

    if (isReconnecting) {
      return {
        color: 'bg-yellow-500',
        text: `Reconnecting... (${connectionState.reconnectAttempts}/5)`,
        icon: (
          <svg
            className="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ),
        pulse: true,
      }
    }

    if (hasError) {
      return {
        color: 'bg-red-500',
        text: 'Connection Error',
        icon: (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        ),
        pulse: false,
      }
    }

    return {
      color: 'bg-gray-400',
      text: 'Disconnected',
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
            clipRule="evenodd"
          />
        </svg>
      ),
      pulse: false,
    }
  }

  const status = getStatusConfig()

  return (
    <div className="group relative flex items-center space-x-2">
      {/* Status indicator */}
      <div className="flex items-center space-x-2">
        <div
          className={`h-2 w-2 rounded-full ${status.color} ${status.pulse ? 'animate-pulse' : ''}`}
        />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {status.text}
        </span>
      </div>

      {/* Tooltip on hover */}
      <div className="invisible absolute left-0 top-full z-10 mt-2 w-64 rounded-md bg-white p-3 shadow-lg ring-1 ring-black ring-opacity-5 group-hover:visible dark:bg-gray-800">
        <div className="space-y-2">
          {/* Status with icon */}
          <div className="flex items-center space-x-2">
            <div className="text-gray-600 dark:text-gray-400">
              {status.icon}
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {status.text}
            </span>
          </div>

          {/* Error message */}
          {hasError && error && (
            <div className="rounded bg-red-50 p-2 dark:bg-red-900/20">
              <p className="text-xs text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Connection details */}
          {isConnected && connectionState.sessionId && (
            <div className="space-y-1 border-t border-gray-200 pt-2 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Session: {connectionState.sessionId.substring(0, 8)}...
              </p>
              {connectionState.heartbeatInterval && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Heartbeat: {connectionState.heartbeatInterval}ms
                </p>
              )}
            </div>
          )}

          {/* Retry button for errors */}
          {hasError && (
            <button
              onClick={() => {
                retry().catch((err) => {
                  console.error('[ConnectionStatus] Retry failed:', err)
                })
              }}
              className="w-full rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            >
              Retry Connection
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
