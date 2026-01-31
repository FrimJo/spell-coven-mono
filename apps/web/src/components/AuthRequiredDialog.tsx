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
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/20">
              <ShieldAlert className="h-6 w-6 text-warning" />
            </div>
          </div>
          <DialogTitle className="text-center text-primary">
            Sign In Required
          </DialogTitle>
          <DialogDescription className="text-center text-muted">
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <button
            onClick={onSignIn}
            className="group w-full cursor-pointer rounded-lg border border-brand/30 bg-brand/30 p-4 text-left transition-all hover:border-brand/60 hover:bg-brand-muted/40 focus:outline-none focus:ring-2 focus:ring-brand/50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/20 transition-colors group-hover:bg-brand/30">
                <LogIn className="h-5 w-5 text-brand-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-brand-muted-foreground">
                  Sign in with Discord
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  Connect your Discord account to join the game.
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={onClose}
            className="group w-full cursor-pointer rounded-lg border border-default bg-surface-2/50 p-4 text-left transition-all hover:border-default hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-default/50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-3/50 transition-colors group-hover:bg-surface-3">
                <Home className="h-5 w-5 text-muted" />
              </div>
              <div>
                <p className="font-medium text-secondary">Return to Home</p>
                <p className="mt-0.5 text-sm text-muted">
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
