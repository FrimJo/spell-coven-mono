/**
 * DuplicateSessionDialog - Shown when user is already connected from another tab
 *
 * Gives the user the choice to either:
 * 1. Transfer to this tab (disconnects the other tab)
 * 2. Leave this tab and keep the other session
 */

import { AlertTriangle, ArrowRightLeft, Home } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

interface DuplicateSessionDialogProps {
  open: boolean
  onTransfer: () => void
  onClose: () => void
}

export function DuplicateSessionDialog({
  open,
  onTransfer,
  onClose,
}: DuplicateSessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="border-warning/50 bg-surface-1 sm:max-w-[450px] [&>button]:hidden">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="bg-warning/20 flex h-12 w-12 items-center justify-center rounded-full">
              <AlertTriangle className="text-warning-muted-foreground h-6 w-6" />
            </div>
          </div>
          <DialogTitle className="text-text-primary text-center">
            Already Connected
          </DialogTitle>
          <DialogDescription className="text-text-muted text-center">
            You&apos;re already in this game room from another tab or window.
            Would you like to continue here instead?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <button
            onClick={onTransfer}
            className="border-brand/30 bg-surface-0/30 hover:border-brand/60 hover:bg-surface-1/40 focus:ring-brand/50 group w-full cursor-pointer rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2"
          >
            <div className="flex items-start gap-3">
              <div className="bg-brand/20 group-hover:bg-brand/30 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors">
                <ArrowRightLeft className="text-brand-muted-foreground h-5 w-5" />
              </div>
              <div>
                <p className="text-brand-muted-foreground font-medium">
                  Transfer here
                </p>
                <p className="text-text-muted mt-0.5 text-sm">
                  Disconnect from the other tab and continue in this one.
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
                  Keep your existing session in the other tab.
                </p>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
