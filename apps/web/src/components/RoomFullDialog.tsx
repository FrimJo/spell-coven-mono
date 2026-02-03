/**
 * RoomFullDialog - Shown when user tries to access a room that is full
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

interface RoomFullDialogProps {
  open: boolean
  onClose: () => void
  message?: string
}

export function RoomFullDialog({
  open,
  onClose,
  message = 'The room is full',
}: RoomFullDialogProps) {
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
            Room is Full
          </DialogTitle>
          <DialogDescription className="text-text-muted text-center">
            {message}. Please try again later or join a different game.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center pt-4">
          <Button
            onClick={onClose}
            className="bg-brand hover:bg-brand gap-2 text-white"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
