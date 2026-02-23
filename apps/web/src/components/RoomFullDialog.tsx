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
        <DialogContent className="border-surface-2 bg-surface-1 sm:max-w-[450px]">
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
                  className="bg-warning/20 absolute inset-0 rounded-full"
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
                <div className="bg-warning/20 relative flex h-16 w-16 items-center justify-center rounded-full">
                  <m.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    <Users className="text-warning h-8 w-8" />
                  </m.div>
                </div>
              </m.div>
            </div>

            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <DialogTitle className="text-center text-xl text-white">
                All Seats Taken
              </DialogTitle>
            </m.div>

            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <DialogDescription className="text-text-muted text-center">
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
              className="border-brand/30 bg-surface-0/30 hover:border-brand/60 hover:bg-surface-1/40 focus:ring-brand/50 group w-full cursor-pointer rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2"
            >
              <div className="flex items-center gap-3">
                <div className="bg-brand/20 group-hover:bg-brand/30 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors">
                  <Home className="text-brand-muted-foreground h-5 w-5" />
                </div>
                <div>
                  <p className="text-brand-muted-foreground font-medium">
                    Back to Home
                  </p>
                  <p className="text-text-muted mt-0.5 text-sm">
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
