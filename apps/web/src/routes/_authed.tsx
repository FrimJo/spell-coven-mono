import { AuthRequiredDialog } from '@/components/AuthRequiredDialog'
import { useAuth } from '@/contexts/AuthContext'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

// Key for storing the return URL after OAuth
const AUTH_RETURN_TO_KEY = 'auth-return-to'

export const Route = createFileRoute('/_authed')({
  component: AuthedLayout,
})

function AuthedLayout() {
  const navigate = useNavigate()
  const { isLoading: isAuthLoading, isAuthenticated, signIn } = useAuth()

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
      <div className="bg-surface-0 flex h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="bg-brand/20 flex h-16 w-16 items-center justify-center rounded-full">
              <Loader2 className="text-brand-muted-foreground h-8 w-8 animate-spin" />
            </div>
            <div className="bg-brand/10 absolute inset-0 animate-ping rounded-full" />
          </div>
          <div className="space-y-1 text-center">
            <h2 className="text-text-secondary text-lg font-medium">
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
      <div className="bg-surface-0 h-screen">
        <AuthRequiredDialog
          open={true}
          onSignIn={handleSignIn}
          onClose={handleClose}
          message={message}
        />
      </div>
    )
  }

  return <Outlet />
}
