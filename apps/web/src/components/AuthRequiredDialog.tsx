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
      <DialogContent className="border-amber-900/50 bg-slate-900 sm:max-w-[450px] [&>button]:hidden">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
              <ShieldAlert className="h-6 w-6 text-amber-400" />
            </div>
          </div>
          <DialogTitle className="text-center text-slate-100">
            Sign In Required
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <button
            onClick={onSignIn}
            className="group w-full cursor-pointer rounded-lg border border-purple-500/30 bg-purple-950/30 p-4 text-left transition-all hover:border-purple-500/60 hover:bg-purple-900/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 transition-colors group-hover:bg-purple-500/30">
                <LogIn className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-purple-200">
                  Sign in with Discord
                </p>
                <p className="mt-0.5 text-sm text-slate-400">
                  Connect your Discord account to join the game.
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={onClose}
            className="group w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-left transition-all hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 transition-colors group-hover:bg-slate-700">
                <Home className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="font-medium text-slate-200">Return to Home</p>
                <p className="mt-0.5 text-sm text-slate-400">
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
