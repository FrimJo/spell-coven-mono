import { createFileRoute } from '@tanstack/react-router'
import * as Sentry from '@sentry/react'

export const Route = createFileRoute('/debug/sentry')({
  component: DebugSentry,
})

function DebugSentry() {
  const isEnabled = import.meta.env.MODE !== 'production'

  const triggerError = () => {
    throw new Error('Sentry test error from the web client.')
  }

  const captureException = () => {
    Sentry.captureException(new Error('Sentry captured exception (client).'))
  }

  const captureMessage = () => {
    Sentry.captureMessage('Sentry test message (client).', 'info')
  }

  return (
    <div className="bg-surface-0 min-h-screen p-8 text-white">
      <h1 className="mb-4 text-3xl font-bold">Debug: Sentry</h1>
      <p className="text-text-muted mb-6 max-w-2xl">
        Use these controls to verify Sentry error reporting in development. The
        triggers are disabled in production builds.
      </p>

      {!isEnabled && (
        <div className="bg-surface-2 text-text-muted mb-6 rounded p-4 text-sm">
          Sentry debug actions are disabled in production.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          className="bg-brand text-text-inverse hover:bg-brand-strong rounded px-4 py-2"
          onClick={isEnabled ? triggerError : undefined}
          type="button"
        >
          Throw Error
        </button>
        <button
          className="bg-surface-2 hover:bg-surface-3 rounded px-4 py-2"
          onClick={isEnabled ? captureException : undefined}
          type="button"
        >
          Capture Exception
        </button>
        <button
          className="bg-surface-2 hover:bg-surface-3 rounded px-4 py-2"
          onClick={isEnabled ? captureMessage : undefined}
          type="button"
        >
          Capture Message
        </button>
      </div>
    </div>
  )
}
