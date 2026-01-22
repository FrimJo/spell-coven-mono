import { ErrorFallback } from '@/components/ErrorFallback'
import { LandingPage } from '@/components/LandingPage'
import { useAuth } from '@/contexts/AuthContext'
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { ErrorBoundary } from 'react-error-boundary'
import { z } from 'zod'

const landingSearchSchema = z.object({
  error: z.string().optional(),
})

export const Route = createFileRoute('/')({
  component: LandingPageRoute,
  validateSearch: zodValidator(landingSearchSchema),
})

function LandingPageContent() {
  const search = Route.useSearch()
  const { user, isLoading: isAuthLoading, signIn, signOut } = useAuth()

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
      onReset={() => window.location.reload()}
    >
      <LandingPage
        initialError={search.error || null}
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
