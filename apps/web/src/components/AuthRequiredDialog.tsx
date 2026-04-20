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
  onSignIn: (provider?: 'discord' | 'google') => void | Promise<void>
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
            onClick={() => onSignIn('discord')}
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
            onClick={() => onSignIn('google')}
            className="group p-4 bg-white/95 hover:bg-white w-full cursor-pointer rounded-lg border border-surface-3 text-left transition-all focus:ring-2 focus:ring-surface-3/50 focus:outline-none"
          >
            <div className="gap-3 flex items-start">
              <div className="h-10 w-10 bg-white flex shrink-0 items-center justify-center rounded-lg">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.49-1.13 2.75-2.41 3.6v3h3.89c2.28-2.1 3.59-5.2 3.59-8.84z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.25v3.09C3.23 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.3c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3V6.61H1.25C.45 8.2 0 9.96 0 12s.45 3.8 1.25 5.39l4.02-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.74c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.23 2.7 1.25 6.61l4.02 3.09C6.22 6.85 8.87 4.74 12 4.74z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Sign in with Google</p>
                <p className="mt-0.5 text-sm text-gray-600">
                  Use your Google account to join the game.
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
