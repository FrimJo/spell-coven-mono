/**
 * AuthRequiredDialog - Shown when user tries to access a protected route without authentication
 *
 * Gives the user the choice to either:
 * 1. Sign in with Discord to continue
 * 2. Return to home page
 */

import { Home, LogIn, ShieldAlert } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

interface AuthRequiredDialogProps {
  open: boolean
  onSignIn: () => void
  onClose: () => void
  /** Optional message to show in the dialog */
  message?: string
}

export function AuthRequiredDialog({
  open,
  onSignIn,
  onClose,
  message = 'You need to sign in to join a game room.',
}: AuthRequiredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="border-warning/50 bg-surface-1 sm:max-w-[450px] [&>button]:hidden">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="bg-warning/20 flex h-12 w-12 items-center justify-center rounded-full">
              <ShieldAlert className="text-warning h-6 w-6" />
            </div>
          </div>
          <DialogTitle className="text-center text-white">
            Sign In Required
          </DialogTitle>
          <DialogDescription className="text-text-muted text-center">
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <button
            onClick={onSignIn}
            className="border-brand/30 bg-brand/30 hover:border-brand/60 hover:bg-brand/40 focus:ring-brand/50 group w-full cursor-pointer rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2"
          >
            <div className="flex items-start gap-3">
              <div className="bg-brand/20 group-hover:bg-brand/30 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors">
                <LogIn className="text-brand-muted-foreground h-5 w-5" />
              </div>
              <div>
                <p className="text-brand-muted-foreground font-medium">
                  Sign in with Discord
                </p>
                <p className="text-text-muted mt-0.5 text-sm">
                  Connect your Discord account to join the game.
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={onClose}
            className="border-surface-3 bg-surface-2/50 hover:border-surface-3 hover:bg-surface-2 focus:ring-surface-3/50 group w-full cursor-pointer rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2"
          >
            <div className="flex items-start gap-3">
              <div className="bg-surface-3/50 group-hover:bg-surface-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors">
                <Home className="text-text-muted h-5 w-5" />
              </div>
              <div>
                <p className="text-text-secondary font-medium">
                  Return to Home
                </p>
                <p className="text-text-muted mt-0.5 text-sm">
                  Go back without signing in.
                </p>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
