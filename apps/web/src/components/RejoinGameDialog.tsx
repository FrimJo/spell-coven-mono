/**
 * RejoinGameDialog - Shown when user is disconnected, kicked, or manually leaves
 *
 * Gives the user the choice to either:
 * 1. Rejoin the game
 * 2. Return to home/lobby
 */

import { AlertTriangle, Ban, DoorOpen, RotateCcw } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

export type RejoinReason = 'kicked' | 'banned' | 'disconnected' | 'left'

interface RejoinGameDialogProps {
  open: boolean
  reason: RejoinReason
  onRejoin: () => void
  onLeave: () => void
}

export function RejoinGameDialog({
  open,
  reason,
  onRejoin,
  onLeave,
}: RejoinGameDialogProps) {
  const getDialogContent = () => {
    switch (reason) {
      case 'banned':
        return {
          title: 'Banned from Game',
          description:
            'You have been banned from this game room by the owner. You cannot rejoin this room.',
          icon: <Ban className="text-destructive h-6 w-6" />,
          iconBg: 'bg-destructive/20',
          canRejoin: false,
        }
      case 'kicked':
        return {
          title: 'Removed from Game',
          description:
            'You have been removed from the game room. You can attempt to rejoin or return to the main menu.',
          icon: <AlertTriangle className="text-warning h-6 w-6" />,
          iconBg: 'bg-warning/20',
          canRejoin: true,
          rejoinText: 'Rejoin Game',
          rejoinDescription: 'Attempt to join the game room again',
        }
      case 'disconnected':
        return {
          title: 'Connection Lost',
          description:
            'You lost connection to the game server. Check your internet connection and try again.',
          icon: <AlertTriangle className="text-destructive h-6 w-6" />,
          iconBg: 'bg-destructive/20',
          canRejoin: true,
          rejoinText: 'Reconnect',
          rejoinDescription: 'Try to reconnect to the game',
        }
      case 'left':
      default:
        return {
          title: 'You Left the Game',
          description:
            'You have left the game room. You can rejoin if the game is still active.',
          icon: <DoorOpen className="text-text-muted h-6 w-6" />,
          iconBg: 'bg-surface-3/20',
          canRejoin: true,
          rejoinText: 'Rejoin Game',
          rejoinDescription: 'Return to the game room',
        }
    }
  }

  const content = getDialogContent()

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="border-surface-2 bg-surface-1 sm:max-w-[450px] [&>button]:hidden">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${content.iconBg}`}
            >
              {content.icon}
            </div>
          </div>
          <DialogTitle className="text-center text-white">
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-text-muted text-center">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {content.canRejoin && (
            <button
              onClick={onRejoin}
              className="border-brand/30 bg-surface-0/30 hover:border-brand/60 hover:bg-surface-1/40 focus:ring-brand/50 group w-full cursor-pointer rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2"
            >
              <div className="flex items-start gap-3">
                <div className="bg-brand/20 group-hover:bg-brand/30 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors">
                  <RotateCcw className="text-brand-muted-foreground h-5 w-5" />
                </div>
                <div>
                  <p className="text-brand-muted-foreground font-medium">
                    {content.rejoinText}
                  </p>
                  <p className="text-text-muted mt-0.5 text-sm">
                    {content.rejoinDescription}
                  </p>
                </div>
              </div>
            </button>
          )}

          <button
            onClick={onLeave}
            className="border-surface-3 bg-surface-2/50 hover:border-surface-3 hover:bg-surface-2 focus:ring-surface-3/50 group w-full cursor-pointer rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2"
          >
            <div className="flex items-start gap-3">
              <div className="bg-surface-3/50 group-hover:bg-surface-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors">
                <DoorOpen className="text-text-muted h-5 w-5" />
              </div>
              <div>
                <p className="text-text-secondary font-medium">
                  Return to Home
                </p>
                <p className="text-text-muted mt-0.5 text-sm">
                  Leave the game permanently
                </p>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
