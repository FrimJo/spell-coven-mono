import { useState } from 'react'
import { NotFoundPage } from '@/components/NotFoundPage'
import { captureAppException } from '@/integrations/sentry/reporting'
import * as Sentry from '@sentry/react'
import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@repo/ui/components/button'

export const Route = createFileRoute('/debug/sentry')({
  component: SentryDebugPage,
})

function SentryDebugPage() {
  const [shouldThrow, setShouldThrow] = useState(false)

  if (import.meta.env.PROD) {
    return <NotFoundPage />
  }

  if (shouldThrow) {
    throw new Error('Sentry debug route render error')
  }

  return (
    <main className="bg-surface-0 text-text-primary flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Sentry Debug</h1>
        <div className="grid gap-3">
          <Button
            onClick={() =>
              Sentry.captureMessage('Sentry debug route captured message')
            }
          >
            Capture Message
          </Button>
          <Button
            onClick={() =>
              captureAppException(
                new Error('Sentry debug route captured exception'),
                {
                  tags: { feature: 'debug', operation: 'capture_exception' },
                },
              )
            }
          >
            Capture Exception
          </Button>
          <Button variant="destructive" onClick={() => setShouldThrow(true)}>
            Throw Render Error
          </Button>
        </div>
      </div>
    </main>
  )
}
