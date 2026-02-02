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
      <DialogContent className="border-surface-2 bg-surface-1 sm:max-w-[450px]">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div className="bg-warning/20 flex h-12 w-12 items-center justify-center rounded-full">
              <AlertCircle className="text-warning-muted-foreground h-6 w-6" />
            </div>
          </div>
          <DialogTitle className="text-center text-white">
            Room Not Found
          </DialogTitle>
          <DialogDescription className="text-text-muted text-center">
            The game room you&apos;re trying to join doesn&apos;t exist or is no
            longer available. Please check the room ID and try again, or create
            a new game.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center pt-4">
          <Button
            onClick={onClose}
            className="bg-brand hover:bg-brand gap-2 text-white"
          >
            <Home className="h-4 w-4" />
            Return to Home
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
