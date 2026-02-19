import * as Sentry from '@sentry/react'
import { StartClient } from '@tanstack/react-start/client'
import { hydrateRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'

import { ErrorFallback } from './components/ErrorFallback.js'
import { initializeSentry } from './integrations/sentry/client.js'

// Lazy load mock media module only in non-production environments
// This allows testing webcam UI in browsers that block media device access
// Enable via: ?mockMedia=true or window.enableMockMedia() in console
if (import.meta.env.MODE !== 'production') {
  import('./lib/mockMedia.js').then(({ initMockMedia }) => {
    initMockMedia()
  })
}

initializeSentry()

hydrateRoot(
  document,
  // TODO: Re-enable StrictMode after fixing the "Maximum update depth exceeded" error
  // <StrictMode>
  <ErrorBoundary
    fallbackRender={({ error, resetErrorBoundary }) => (
      <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
    )}
    onError={(error, info) => {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: info.componentStack,
          },
        },
      })
    }}
    onReset={() => window.location.reload()}
  >
    <StartClient />
  </ErrorBoundary>,
  // </StrictMode>
)
