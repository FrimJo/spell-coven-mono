import { AuthRequiredDialog } from '@/components/AuthRequiredDialog'
import { useAuth } from '@/contexts/AuthContext'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

// Key for storing the return URL after OAuth
const AUTH_RETURN_TO_KEY = 'auth-return-to'

export const Route = createFileRoute('/_authed')({
  ssr: false,
  component: AuthedLayout,
})

function AuthedLayout() {
  const navigate = useNavigate()
  const {
    isLoading: isAuthLoading,
    isAuthenticated,
    signIn,
    signInWithPreviewCode,
  } = useAuth()

  const handleSignIn = async () => {
    if (typeof window !== 'undefined') {
      const returnTo = `${window.location.pathname}${window.location.search}`
      window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, returnTo)
    }
    await signIn()
  }

  const handleClose = () => {
    navigate({ to: '/' })
  }

  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0">
        <div className="space-y-4 flex flex-col items-center">
          <div className="relative">
            <div className="h-16 w-16 flex items-center justify-center rounded-full bg-brand/20">
              <Loader2 className="h-8 w-8 animate-spin text-brand-muted-foreground" />
            </div>
            <div className="inset-0 animate-ping absolute rounded-full bg-brand/10" />
          </div>
          <div className="space-y-1 text-center">
            <h2 className="text-lg font-medium text-text-secondary">
              Checking authentication...
            </h2>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    const pathname =
      typeof window !== 'undefined' ? window.location.pathname : ''
    const message = pathname.startsWith('/game/')
      ? 'You need to sign in with Discord to join this game room.'
      : 'You need to sign in with Discord to continue.'

    return (
      <div className="h-screen bg-surface-0">
        <AuthRequiredDialog
          open={true}
          onSignIn={handleSignIn}
          onPreviewSignIn={signInWithPreviewCode}
          onClose={handleClose}
          message={message}
        />
      </div>
    )
  }

  return <Outlet />
}
