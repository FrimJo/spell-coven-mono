/**
 * LeaveGameDialog - Confirmation dialog for leaving a game
 *
 * Shown when user clicks the Leave button to confirm they want to leave.
 */

import { DoorOpen, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

interface LeaveGameDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function LeaveGameDialog({
  open,
  onConfirm,
  onCancel,
}: LeaveGameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[400px] border-surface-2 bg-surface-1">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="h-12 w-12 flex items-center justify-center rounded-full bg-warning/20">
              <DoorOpen className="h-6 w-6 text-warning-muted-foreground" />
            </div>
          </div>
          <DialogTitle className="text-white text-center">
            Leave Game?
          </DialogTitle>
          <DialogDescription className="text-center text-text-muted">
            Are you sure you want to leave this game room? You can rejoin later
            if the game is still active.
          </DialogDescription>
        </DialogHeader>

        <div className="gap-3 pt-4 flex">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium flex-1 cursor-pointer rounded-lg border border-surface-3 bg-surface-2/50 text-text-secondary transition-all hover:border-surface-3 hover:bg-surface-2 focus:ring-2 focus:ring-surface-3/50 focus:outline-none"
            data-testid="leave-dialog-cancel-button"
          >
            <div className="gap-2 flex items-center justify-center">
              <X className="h-4 w-4" />
              Cancel
            </div>
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-2.5 text-sm font-medium flex-1 cursor-pointer rounded-lg border border-destructive/30 bg-destructive/30 text-destructive-foreground transition-all hover:border-destructive/60 hover:bg-destructive/40 focus:ring-2 focus:ring-destructive/50 focus:outline-none"
            data-testid="leave-dialog-confirm-button"
          >
            <div className="gap-2 flex items-center justify-center">
              <DoorOpen className="h-4 w-4" />
              Leave Game
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
