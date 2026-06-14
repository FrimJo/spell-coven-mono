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
      <DialogContent
        className="
        border-surface-2 bg-surface-1
        sm:max-w-[400px]
      "
      >
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div
              className="
              flex size-12 items-center justify-center rounded-full
              bg-warning/20
            "
            >
              <RotateCcw className="size-6 text-warning-muted-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-white">
            Reset game state?
          </DialogTitle>
          <DialogDescription className="text-center text-text-muted">
            All life totals, poison counters, and commander data will be reset
            to default. Players will stay in the room. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onCancel}
            disabled={isResetting}
            className="
              flex-1 cursor-pointer rounded-lg border border-surface-3
              bg-surface-2/50 px-4 py-2.5 text-sm font-medium
              text-text-secondary transition-all
              hover:border-surface-3 hover:bg-surface-2
              focus:ring-2 focus:ring-surface-3/50 focus:outline-none
              disabled:opacity-50
            "
            data-testid="reset-dialog-cancel-button"
          >
            <div className="flex items-center justify-center gap-2">
              <X className="size-4" />
              Cancel
            </div>
          </button>

          <button
            onClick={onConfirm}
            disabled={isResetting}
            className="
              flex-1 cursor-pointer rounded-lg border border-destructive/30
              bg-destructive/30 px-4 py-2.5 text-sm font-medium
              text-destructive-foreground transition-all
              hover:border-destructive/60 hover:bg-destructive/40
              focus:ring-2 focus:ring-destructive/50 focus:outline-none
              disabled:opacity-50
            "
            data-testid="reset-dialog-confirm-button"
          >
            <div className="flex items-center justify-center gap-2">
              {isResetting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Reset game
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
