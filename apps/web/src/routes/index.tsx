import { useEffect } from 'react'
import { ErrorFallback } from '@/components/ErrorFallback'
import { LandingPage } from '@/components/LandingPage'
import { useAuth } from '@/contexts/AuthContext'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { ErrorBoundary } from 'react-error-boundary'
import { z } from 'zod'

// Key for storing the return URL after OAuth (must match game route)
const AUTH_RETURN_TO_KEY = 'auth-return-to'

const searchSchema = z.object({
  error: z.string().optional(),
})

export const Route = createFileRoute('/')({
  ssr: true,
  component: LandingPageRoute,
  validateSearch: zodValidator(searchSchema),
})

function LandingPageContent() {
  const { error } = Route.useSearch()
  const navigate = useNavigate()
  const {
    user,
    isLoading: isAuthLoading,
    signIn,
    signInWithPreviewCode,
  } = useAuth()

  // After authentication completes, redirect to the stored return URL (e.g., game room)
  useEffect(() => {
    if (user && !isAuthLoading) {
      const returnTo = window.sessionStorage.getItem(AUTH_RETURN_TO_KEY)
      if (returnTo) {
        window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY)
        navigate({ to: returnTo })
      }
    }
  }, [user, isAuthLoading, navigate])

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
      onReset={() => window.location.reload()}
    >
      <LandingPage
        initialError={error || null}
        inviteState={null}
        onRefreshInvite={() => {}}
        isRefreshingInvite={false}
        user={user}
        onSignIn={signIn}
        onPreviewSignIn={signInWithPreviewCode}
      />
    </ErrorBoundary>
  )
}

function LandingPageRoute() {
  return <LandingPageContent />
}
