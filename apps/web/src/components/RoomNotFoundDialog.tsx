/**
 * RoomNotFoundDialog - Shown when user tries to access a room that doesn't exist
 *
 * This dialog is displayed on the landing page when the user is redirected
 * from a game room that:
 * - Does not exist
 * - The user is banned from (shown as "not found" for security)
 */

import { AlertCircle, Home } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

interface RoomNotFoundDialogProps {
  open: boolean
  onClose: () => void
}

export function RoomNotFoundDialog({ open, onClose }: RoomNotFoundDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-[450px]">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
              <AlertCircle className="h-6 w-6 text-amber-400" />
            </div>
          </div>
          <DialogTitle className="text-center text-slate-100">
            Room Not Found
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            The game room you're trying to join doesn't exist or is no longer
            available. Please check the room ID and try again, or create a new
            game.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center pt-4">
          <Button
            onClick={onClose}
            className="gap-2 bg-purple-600 text-white hover:bg-purple-700"
          >
            <Home className="h-4 w-4" />
            Return to Home
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
