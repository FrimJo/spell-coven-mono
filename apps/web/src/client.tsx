import { StartClient } from '@tanstack/react-start/client'
import { hydrateRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'

import { ErrorFallback } from './components/ErrorFallback.js'

hydrateRoot(
  document,
  // TODO: Re-enable StrictMode after fixing the "Maximum update depth exceeded" error
  // <StrictMode>
  <ErrorBoundary
    fallbackRender={({ error, resetErrorBoundary }) => (
      <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
    )}
    onReset={() => window.location.reload()}
  >
    <StartClient />
  </ErrorBoundary>,
  // </StrictMode>
)
