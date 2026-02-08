/**
 * ResetGameDialog - Confirmation dialog for resetting game state
 *
 * Shown when user clicks Reset game to confirm resetting life, poison, and commander data.
 */

import { Loader2, RotateCcw, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

interface ResetGameDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  isResetting?: boolean
}

export function ResetGameDialog({
  open,
  onConfirm,
  onCancel,
  isResetting = false,
}: ResetGameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="border-surface-2 bg-surface-1 sm:max-w-[400px]">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="bg-warning/20 flex h-12 w-12 items-center justify-center rounded-full">
              <RotateCcw className="text-warning-muted-foreground h-6 w-6" />
            </div>
          </div>
          <DialogTitle className="text-center text-white">
            Reset game state?
          </DialogTitle>
          <DialogDescription className="text-text-muted text-center">
            All life totals, poison counters, and commander data will be reset
            to default. Players will stay in the room. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onCancel}
            disabled={isResetting}
            className="border-surface-3 bg-surface-2/50 text-text-secondary hover:border-surface-3 hover:bg-surface-2 focus:ring-surface-3/50 flex-1 cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 disabled:opacity-50"
            data-testid="reset-dialog-cancel-button"
          >
            <div className="flex items-center justify-center gap-2">
              <X className="h-4 w-4" />
              Cancel
            </div>
          </button>

          <button
            onClick={onConfirm}
            disabled={isResetting}
            className="border-destructive/30 bg-destructive/30 text-destructive-foreground hover:border-destructive/60 hover:bg-destructive/40 focus:ring-destructive/50 flex-1 cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 disabled:opacity-50"
            data-testid="reset-dialog-confirm-button"
          >
            <div className="flex items-center justify-center gap-2">
              {isResetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reset game
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
