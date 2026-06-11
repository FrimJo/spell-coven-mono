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
          icon: <Ban className="h-6 w-6 text-destructive" />,
          iconBg: 'bg-destructive/20',
          canRejoin: false,
        }
      case 'kicked':
        return {
          title: 'Removed from Game',
          description:
            'You have been removed from the game room. You can attempt to rejoin or return to the main menu.',
          icon: <AlertTriangle className="h-6 w-6 text-warning" />,
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
          icon: <AlertTriangle className="h-6 w-6 text-destructive" />,
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
          icon: <DoorOpen className="h-6 w-6 text-text-muted" />,
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
      <DialogContent className="sm:max-w-[450px] border-surface-2 bg-surface-1 [&>button]:hidden">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div
              className={`h-12 w-12 flex items-center justify-center rounded-full ${content.iconBg}`}
            >
              {content.icon}
            </div>
          </div>
          <DialogTitle className="text-white text-center">
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-center text-text-muted">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {content.canRejoin && (
            <button
              onClick={onRejoin}
              className="group p-4 w-full cursor-pointer rounded-lg border border-brand/30 bg-surface-0/30 text-left transition-all hover:border-brand/60 hover:bg-surface-1/40 focus:ring-2 focus:ring-brand/50 focus:outline-none"
            >
              <div className="gap-3 flex items-start">
                <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-lg bg-brand/20 transition-colors group-hover:bg-brand/30">
                  <RotateCcw className="h-5 w-5 text-brand-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-brand-muted-foreground">
                    {content.rejoinText}
                  </p>
                  <p className="mt-0.5 text-sm text-text-muted">
                    {content.rejoinDescription}
                  </p>
                </div>
              </div>
            </button>
          )}

          <button
            onClick={onLeave}
            className="group p-4 w-full cursor-pointer rounded-lg border border-surface-3 bg-surface-2/50 text-left transition-all hover:border-surface-3 hover:bg-surface-2 focus:ring-2 focus:ring-surface-3/50 focus:outline-none"
          >
            <div className="gap-3 flex items-start">
              <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-lg bg-surface-3/50 transition-colors group-hover:bg-surface-3">
                <DoorOpen className="h-5 w-5 text-text-muted" />
              </div>
              <div>
                <p className="font-medium text-text-secondary">
                  Return to Home
                </p>
                <p className="mt-0.5 text-sm text-text-muted">
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
