/**
 * DuplicateSessionDialog - Shown when user is already connected from another tab
 *
 * Gives the user the choice to either:
 * 1. Transfer to this tab (closes the other tab's connection)
 * 2. Close this tab and keep the other session
 */

import { AlertTriangle, ArrowRightLeft, DoorOpen } from 'lucide-react'

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
      <DialogContent className="border-amber-900/50 bg-slate-900 sm:max-w-[450px] [&>button]:hidden">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
          </div>
          <DialogTitle className="text-center text-slate-100">
            Already Connected
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            You&apos;re already in this game room from another tab or window.
            Would you like to continue here instead?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <button
            onClick={onTransfer}
            className="group w-full cursor-pointer rounded-lg border border-purple-500/30 bg-purple-950/30 p-4 text-left transition-all hover:border-purple-500/60 hover:bg-purple-900/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 transition-colors group-hover:bg-purple-500/30">
                <ArrowRightLeft className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-purple-200">Transfer here</p>
                <p className="mt-0.5 text-sm text-slate-400">
                  Close your connection in the other tab and continue in this
                  one.
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
                <DoorOpen className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="font-medium text-slate-200">Close this tab</p>
                <p className="mt-0.5 text-sm text-slate-400">
                  Keep your existing session active in the other tab.
                </p>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
