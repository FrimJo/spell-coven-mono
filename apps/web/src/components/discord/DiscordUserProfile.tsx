import {
  formatUserDisplayName,
  getAvatarUrl,
} from '@repo/discord-integration/utils'

import { useDiscordAuth } from '../../hooks/useDiscordAuth.js'
import { useDiscordUser } from '../../hooks/useDiscordUser.js'

/**
 * Discord User Profile Component
 * Displays authenticated user's Discord profile in header
 */

export function DiscordUserProfile() {
  const { logout } = useDiscordAuth()
  const { user, isLoading } = useDiscordUser()

  if (!user || isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-300 dark:bg-gray-700" />
        <div className="h-4 w-24 animate-pulse rounded bg-gray-300 dark:bg-gray-700" />
      </div>
    )
  }

  const displayName = formatUserDisplayName(user)
  const avatarUrl = getAvatarUrl(user, 64)

  return (
    <div className="group relative flex items-center space-x-3">
      {/* Avatar */}
      <img
        src={avatarUrl}
        alt={displayName}
        className="h-8 w-8 rounded-full ring-2 ring-gray-200 dark:ring-gray-700"
      />

      {/* Username */}
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {displayName}
      </span>

      {/* Dropdown menu (on hover) - with padding to bridge gap */}
      <div className="invisible absolute right-0 top-full z-10 pt-2 group-hover:visible">
        <div className="w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800">
          <button
            onClick={logout}
            className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <span className="flex items-center">
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
