import { useEffect } from 'react'
import { ErrorFallback } from '@/components/ErrorFallback'
import { LandingPage } from '@/components/LandingPage'
import { useAuth } from '@/contexts/AuthContext'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'

// Key for storing the return URL after OAuth (must match game route)
const AUTH_RETURN_TO_KEY = 'auth-return-to'

export const Route = createFileRoute('/')({
  component: LandingPageRoute,
})

function LandingPageContent() {
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading, signIn, signOut } = useAuth()

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
        initialError={null}
        inviteState={null}
        onRefreshInvite={() => {}}
        isRefreshingInvite={false}
        user={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signIn}
        onSignOut={signOut}
      />
    </ErrorBoundary>
  )
}

function LandingPageRoute() {
  return <LandingPageContent />
}
