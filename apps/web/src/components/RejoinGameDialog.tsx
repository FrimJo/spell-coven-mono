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
          icon: <Ban className="h-6 w-6 text-red-400" />,
          iconBg: 'bg-red-500/20',
          canRejoin: false,
        }
      case 'kicked':
        return {
          title: 'Removed from Game',
          description:
            'You have been removed from the game room. You can attempt to rejoin or return to the main menu.',
          icon: <AlertTriangle className="h-6 w-6 text-amber-400" />,
          iconBg: 'bg-amber-500/20',
          canRejoin: true,
          rejoinText: 'Rejoin Game',
          rejoinDescription: 'Attempt to join the game room again',
        }
      case 'disconnected':
        return {
          title: 'Connection Lost',
          description:
            'You lost connection to the game server. Check your internet connection and try again.',
          icon: <AlertTriangle className="h-6 w-6 text-red-400" />,
          iconBg: 'bg-red-500/20',
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
          icon: <DoorOpen className="h-6 w-6 text-slate-400" />,
          iconBg: 'bg-slate-500/20',
          canRejoin: true,
          rejoinText: 'Rejoin Game',
          rejoinDescription: 'Return to the game room',
        }
    }
  }

  const content = getDialogContent()

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-[450px] [&>button]:hidden">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${content.iconBg}`}
            >
              {content.icon}
            </div>
          </div>
          <DialogTitle className="text-center text-slate-100">
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {content.canRejoin && (
            <button
              onClick={onRejoin}
              className="group w-full cursor-pointer rounded-lg border border-purple-500/30 bg-purple-950/30 p-4 text-left transition-all hover:border-purple-500/60 hover:bg-purple-900/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 transition-colors group-hover:bg-purple-500/30">
                  <RotateCcw className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-purple-200">
                    {content.rejoinText}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-400">
                    {content.rejoinDescription}
                  </p>
                </div>
              </div>
            </button>
          )}

          <button
            onClick={onLeave}
            className="group w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-left transition-all hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 transition-colors group-hover:bg-slate-700">
                <DoorOpen className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="font-medium text-slate-200">Return to Home</p>
                <p className="mt-0.5 text-sm text-slate-400">
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
