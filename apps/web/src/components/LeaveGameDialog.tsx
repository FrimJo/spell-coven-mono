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
      <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-[400px]">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
              <DoorOpen className="h-6 w-6 text-amber-400" />
            </div>
          </div>
          <DialogTitle className="text-center text-slate-100">
            Leave Game?
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            Are you sure you want to leave this game room? You can rejoin later
            if the game is still active.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
            data-testid="leave-dialog-cancel-button"
          >
            <div className="flex items-center justify-center gap-2">
              <X className="h-4 w-4" />
              Cancel
            </div>
          </button>

          <button
            onClick={onConfirm}
            className="flex-1 cursor-pointer rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-2.5 text-sm font-medium text-red-200 transition-all hover:border-red-500/60 hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            data-testid="leave-dialog-confirm-button"
          >
            <div className="flex items-center justify-center gap-2">
              <DoorOpen className="h-4 w-4" />
              Leave Game
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
