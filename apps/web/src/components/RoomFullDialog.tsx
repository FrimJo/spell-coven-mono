/**
 * RoomFullDialog - Shown when user tries to access a room that is full
 */

import { domAnimation, LazyMotion, m } from 'framer-motion'
import { Home, Users } from 'lucide-react'

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
  // Extract room ID from message if present (e.g., "Room is full (Room ABC123)")
  const roomIdMatch = message.match(/\(Room ([A-Z0-9]+)\)/)
  const roomId = roomIdMatch ? roomIdMatch[1] : null

  return (
    <LazyMotion features={domAnimation}>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[450px] border-surface-2 bg-surface-1">
          <DialogHeader>
            <div className="mb-4 flex justify-center">
              <m.div
                className="relative"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
              >
                {/* Animated ring */}
                <m.div
                  className="inset-0 absolute rounded-full bg-warning/20"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                {/* Icon container */}
                <div className="h-16 w-16 relative flex items-center justify-center rounded-full bg-warning/20">
                  <m.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    <Users className="h-8 w-8 text-warning" />
                  </m.div>
                </div>
              </m.div>
            </div>

            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <DialogTitle className="text-xl text-white text-center">
                All Seats Taken
              </DialogTitle>
            </m.div>

            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <DialogDescription className="text-center text-text-muted">
                {roomId ? (
                  <>
                    All seats in room{' '}
                    <span className="font-mono font-medium text-white">
                      {roomId}
                    </span>{' '}
                    are taken.
                  </>
                ) : (
                  <>All seats at this table are taken.</>
                )}
                <br />
                Please wait for a seat to open or find another room.
              </DialogDescription>
            </m.div>
          </DialogHeader>

          <m.div
            className="pt-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={onClose}
              className="group p-4 w-full cursor-pointer rounded-lg border border-brand/30 bg-surface-0/30 text-left transition-all hover:border-brand/60 hover:bg-surface-1/40 focus:ring-2 focus:ring-brand/50 focus:outline-none"
            >
              <div className="gap-3 flex items-center">
                <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-lg bg-brand/20 transition-colors group-hover:bg-brand/30">
                  <Home className="h-5 w-5 text-brand-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-brand-muted-foreground">
                    Back to Home
                  </p>
                  <p className="mt-0.5 text-sm text-text-muted">
                    Find or create another game room
                  </p>
                </div>
              </div>
            </button>
          </m.div>
        </DialogContent>
      </Dialog>
    </LazyMotion>
  )
}
