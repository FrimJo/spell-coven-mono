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
  onPreviewSignIn?: (code: string, userId?: string) => Promise<void> | void
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
  const [userId, setUserId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const showPreviewAuth = env.VITE_PREVIEW_AUTH && !!onPreviewSignIn

  const handlePreviewSignIn = async () => {
    if (!onPreviewSignIn || !code.trim()) return
    setIsSubmitting(true)
    try {
      await onPreviewSignIn(code.trim(), userId.trim() || undefined)
    } finally {
      setIsSubmitting(false)
    }
  }

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

          {showPreviewAuth ? (
            <div className="border-warning/40 rounded-lg border p-3">
              <p className="text-warning mb-2 text-sm font-medium">
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
                <div className="space-y-1">
                  <Label htmlFor="preview-dialog-user">
                    User ID (optional)
                  </Label>
                  <Input
                    id="preview-dialog-user"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    autoComplete="off"
                  />
                </div>
                <button
                  onClick={handlePreviewSignIn}
                  disabled={!code.trim() || isSubmitting}
                  className="border-warning/50 bg-warning/20 hover:bg-warning/30 text-warning w-full cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
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
