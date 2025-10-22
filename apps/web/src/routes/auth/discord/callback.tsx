import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { useDiscordAuth } from '../../../hooks/useDiscordAuth'

/**
 * Discord OAuth Callback Route
 * Handles the OAuth redirect from Discord after user authorization
 */

export const Route = createFileRoute('/auth/discord/callback')({
  component: DiscordCallbackPage,
})

function DiscordCallbackPage() {
  const navigate = useNavigate()
  const { handleCallback, isAuthenticated } = useDiscordAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Parse URL parameters
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const errorParam = params.get('error')
        const errorDescription = params.get('error_description')

        // Check for OAuth errors
        if (errorParam) {
          setError(errorDescription || errorParam)
          return
        }

        // Check for authorization code
        if (!code) {
          setError('No authorization code received from Discord')
          return
        }

        // Exchange code for token
        await handleCallback(code)

        // Redirect to home page after successful authentication
        setTimeout(() => {
          navigate({ to: '/' })
        }, 1000)
      } catch (err) {
        console.error('OAuth callback error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
      }
    }

    processCallback()
  }, [handleCallback, navigate])

  // Show success message if authenticated
  if (isAuthenticated && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg dark:bg-gray-800">
          <div className="mb-4 flex justify-center">
            <svg
              className="h-16 w-16 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            Authentication Successful!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Redirecting you back to Spell Coven...
          </p>
        </div>
      </div>
    )
  }

  // Show error message
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
          <div className="mb-4 flex justify-center">
            <svg
              className="h-16 w-16 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            Authentication Failed
          </h1>
          <p className="mb-6 text-gray-600 dark:text-gray-400">{error}</p>

          <button
            onClick={() => navigate({ to: '/' })}
            className="w-full rounded-md bg-[#5865F2] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#4752C4]"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  // Show loading state
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg dark:bg-gray-800">
        <div className="mb-4 flex justify-center">
          <svg
            className="h-16 w-16 animate-spin text-[#5865F2]"
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
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
          Authenticating...
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Please wait while we complete your Discord authentication.
        </p>
      </div>
    </div>
  )
}
