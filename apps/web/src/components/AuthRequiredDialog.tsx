/**
 * AuthRequiredDialog - Shown when user tries to access a protected route without authentication
 *
 * Gives the user the choice to either:
 * 1. Sign in with Discord to continue
 * 2. Return to home page
 */

import { useState } from 'react'
import { env } from '@/env'
import { Home, LogIn, ShieldAlert } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'

interface AuthRequiredDialogProps {
  open: boolean
  onSignIn: () => void
  onClose: () => void
  onPreviewSignIn?: (code: string) => Promise<void> | void
  /** Optional message to show in the dialog */
  message?: string
}

export function AuthRequiredDialog({
  open,
  onSignIn,
  onClose,
  onPreviewSignIn,
  message = 'You need to sign in to join a game room.',
}: AuthRequiredDialogProps) {
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const showPreviewAuth = env.VITE_PREVIEW_AUTH && !!onPreviewSignIn

  const handlePreviewSignIn = async () => {
    if (!onPreviewSignIn || !code.trim()) return
    setIsSubmitting(true)
    try {
      await onPreviewSignIn(code.trim())
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[450px] border-warning/50 bg-surface-1 [&>button]:hidden">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="h-12 w-12 flex items-center justify-center rounded-full bg-warning/20">
              <ShieldAlert className="h-6 w-6 text-warning" />
            </div>
          </div>
          <DialogTitle className="text-white text-center">
            Sign In Required
          </DialogTitle>
          <DialogDescription className="text-center text-text-muted">
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <button
            onClick={onSignIn}
            className="group p-4 w-full cursor-pointer rounded-lg border border-brand/30 bg-brand/30 text-left transition-all hover:border-brand/60 hover:bg-brand/40 focus:ring-2 focus:ring-brand/50 focus:outline-none"
          >
            <div className="gap-3 flex items-start">
              <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-lg bg-brand/20 transition-colors group-hover:bg-brand/30">
                <LogIn className="h-5 w-5 text-brand-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-brand-muted-foreground">
                  Sign in with Discord
                </p>
                <p className="mt-0.5 text-sm text-text-muted">
                  Connect your Discord account to join the game.
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={onClose}
            className="group p-4 w-full cursor-pointer rounded-lg border border-surface-3 bg-surface-2/50 text-left transition-all hover:border-surface-3 hover:bg-surface-2 focus:ring-2 focus:ring-surface-3/50 focus:outline-none"
          >
            <div className="gap-3 flex items-start">
              <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-lg bg-surface-3/50 transition-colors group-hover:bg-surface-3">
                <Home className="h-5 w-5 text-text-muted" />
              </div>
              <div>
                <p className="font-medium text-text-secondary">
                  Return to Home
                </p>
                <p className="mt-0.5 text-sm text-text-muted">
                  Go back without signing in.
                </p>
              </div>
            </div>
          </button>

          {showPreviewAuth ? (
            <div className="p-3 rounded-lg border border-warning/40">
              <p className="mb-2 text-sm font-medium text-warning">
                Preview only
              </p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="preview-dialog-code">
                    Preview Login Code
                  </Label>
                  <Input
                    id="preview-dialog-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    autoComplete="off"
                  />
                </div>
                <button
                  onClick={handlePreviewSignIn}
                  disabled={!code.trim() || isSubmitting}
                  className="px-3 py-2 text-sm w-full cursor-pointer rounded-lg border border-warning/50 bg-warning/20 text-warning transition-colors hover:bg-warning/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in with Code'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
