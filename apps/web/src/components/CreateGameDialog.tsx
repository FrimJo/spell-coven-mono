import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  CheckCircle2,
  Copy,
  Gamepad2,
  Loader2,
  Play,
} from 'lucide-react'
import Confetti from 'react-confetti'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

import { useWindowSize } from '../hooks/useWindowSize'

interface CreateGameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isCreating: boolean
  createdGameId: string | null
  onNavigateToRoom: () => void
}

export function CreateGameDialog({
  open,
  onOpenChange,
  isCreating,
  createdGameId,
  onNavigateToRoom,
}: CreateGameDialogProps) {
  const [copied, setCopied] = useState(false)
  const { width, height } = useWindowSize()

  const isReady = !!createdGameId
  const isPending = isCreating && !createdGameId

  // Compute shareable link (only on client)
  const shareLink = useMemo(() => {
    if (!createdGameId || typeof window === 'undefined') return ''
    return `${window.location.origin}/game/${createdGameId}`
  }, [createdGameId])

  const handleCopy = async () => {
    if (!shareLink) return
    await navigator.clipboard.writeText(shareLink)
    setCopied(true)
    toast.success('Game room sharable link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-slate-800 bg-slate-900 sm:max-w-md">
        {isReady && (
          <Confetti
            width={width}
            height={height}
            recycle={false}
            numberOfPieces={800}
            gravity={0.15}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 60,
              pointerEvents: 'none',
            }}
          />
        )}
        <DialogHeader>
          <DialogTitle className="text-white">
            {isReady
              ? '🎮 Your Game Room is Ready!'
              : '🎮 Creating Game Room...'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="flex flex-col items-center space-y-6 py-4">
            {/* Icon - transitions between loading and success */}
            <motion.div
              className="relative flex h-16 w-16 items-center justify-center rounded-full"
              animate={{
                backgroundColor: isReady
                  ? 'rgba(34, 197, 94, 0.2)'
                  : 'rgba(168, 85, 247, 0.2)',
              }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              <AnimatePresence mode="wait">
                {isReady ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0, rotate: -180, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      duration: 0.8,
                      bounce: 0.5,
                    }}
                    className="flex items-center justify-center"
                  >
                    <CheckCircle2 className="h-8 w-8 text-green-400" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="pending"
                    exit={{
                      scale: 0,
                      rotate: 180,
                      opacity: 0,
                    }}
                    transition={{
                      duration: 0.4,
                      ease: 'easeInOut',
                    }}
                    className="flex items-center justify-center"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      <Gamepad2 className="h-8 w-8 text-purple-400" />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Pulsing ring effect - only when pending */}
              <AnimatePresence>
                {!isReady && (
                  <motion.div
                    key="pulse-ring"
                    className="absolute inset-0 rounded-full bg-purple-500/20"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}
              </AnimatePresence>
              {/* Success burst effect */}
              <AnimatePresence>
                {isReady && (
                  <motion.div
                    key="success-burst"
                    className="absolute inset-0 rounded-full bg-green-500/30"
                    initial={{ scale: 0.8, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                )}
              </AnimatePresence>
            </motion.div>

            <div className="w-full space-y-2 text-center">
              <p className="text-lg font-medium text-slate-200">
                {isReady
                  ? 'Game room created successfully!'
                  : 'Setting up your game room...'}
              </p>

              {/* Share Link Box */}
              <div
                className={`group flex items-center justify-between rounded-lg border p-3 transition-colors ${
                  isReady
                    ? 'cursor-pointer border-slate-700 bg-slate-950 hover:border-purple-500/50'
                    : 'cursor-default border-slate-800 bg-slate-950/50'
                }`}
                onClick={isReady ? handleCopy : undefined}
              >
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm text-slate-400">Share Link</p>
                  {isReady ? (
                    <p className="break-all font-mono text-sm text-purple-400">
                      {shareLink}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-pulse rounded bg-slate-700" />
                      <p className="font-mono text-sm text-slate-500">
                        Generating link...
                      </p>
                    </div>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className={`ml-2 h-8 w-8 shrink-0 ${
                    isReady
                      ? 'text-slate-400 group-hover:text-white'
                      : 'cursor-default text-slate-600'
                  }`}
                  disabled={!isReady}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <p className="text-sm text-slate-400">
                {isReady
                  ? 'Share this link with your friends to let them join'
                  : 'This will only take a moment...'}
              </p>
            </div>

            {/* Enter Game Room Button */}
            <div className="w-full">
              <Button
                onClick={onNavigateToRoom}
                disabled={!isReady}
                className={`w-full transition-all ${
                  isReady
                    ? 'bg-purple-600 text-white hover:scale-[1.02] hover:bg-purple-700'
                    : 'cursor-not-allowed bg-slate-700 text-slate-400'
                }`}
                size="lg"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Preparing Room...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Enter Game Room
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
