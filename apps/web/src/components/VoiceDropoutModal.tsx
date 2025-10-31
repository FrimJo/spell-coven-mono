import { AlertCircle } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

interface VoiceDropoutModalProps {
  open: boolean
  onRejoin: () => void
  onLeaveGame: () => void
}

/**
 * Modal shown when user is removed from voice channel
 *
 * Offers two options:
 * - Rejoin: Close modal and rejoin from Discord
 * - Leave: Return to landing page
 */
export function VoiceDropoutModal({
  open,
  onRejoin,
  onLeaveGame,
}: VoiceDropoutModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        // Prevent closing by clicking outside or pressing Escape
        if (!newOpen) return
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            <DialogTitle>Disconnected from Voice Channel</DialogTitle>
          </div>
          <DialogDescription className="mt-2">
            You&apos;ve been removed from the voice channel. Would you like to
            rejoin or leave the game?
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onLeaveGame} className="flex-1">
            Leave Game
          </Button>
          <Button onClick={onRejoin} className="flex-1">
            Rejoin from Discord
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
