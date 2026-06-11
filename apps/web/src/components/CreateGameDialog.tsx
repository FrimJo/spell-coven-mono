import { useMemo, useState } from 'react'
import { AnimatePresence, domAnimation, LazyMotion, m } from 'framer-motion'
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
    <LazyMotion features={domAnimation}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md overflow-hidden border-surface-2 bg-surface-1">
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
            <div className="space-y-6 py-4 flex flex-col items-center">
              {/* Icon - transitions between loading and success */}
              <m.div
                className="h-16 w-16 relative flex items-center justify-center rounded-full"
                animate={{
                  backgroundColor: isReady
                    ? 'rgba(34, 197, 94, 0.2)'
                    : 'rgba(168, 85, 247, 0.2)',
                }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              >
                <AnimatePresence mode="wait">
                  {isReady ? (
                    <m.div
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
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </m.div>
                  ) : (
                    <m.div
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
                      <m.div
                        animate={{
                          scale: [1, 1.1, 1],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      >
                        <Gamepad2 className="h-8 w-8 text-brand-muted-foreground" />
                      </m.div>
                    </m.div>
                  )}
                </AnimatePresence>
                {/* Pulsing ring effect - only when pending */}
                <AnimatePresence>
                  {!isReady && (
                    <m.div
                      key="pulse-ring"
                      className="inset-0 absolute rounded-full bg-brand/20"
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
                    <m.div
                      key="success-burst"
                      className="inset-0 absolute rounded-full bg-success/30"
                      initial={{ scale: 0.8, opacity: 1 }}
                      animate={{ scale: 2, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  )}
                </AnimatePresence>
              </m.div>

              <div className="space-y-2 w-full text-center">
                <p className="text-lg font-medium text-text-secondary">
                  {isReady
                    ? 'Game room created successfully!'
                    : 'Setting up your game room...'}
                </p>

                {/* Share Link Box */}
                <div
                  className={`group p-3 flex items-center justify-between rounded-lg border transition-colors ${
                    isReady
                      ? 'cursor-pointer border-surface-3 bg-surface-0 hover:border-brand/50'
                      : 'cursor-default border-surface-2 bg-surface-0/50'
                  }`}
                  onClick={isReady ? handleCopy : undefined}
                >
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm text-text-muted">Share Link</p>
                    {isReady ? (
                      <p className="font-mono text-sm break-all text-brand-muted-foreground">
                        {shareLink}
                      </p>
                    ) : (
                      <div className="gap-2 flex items-center">
                        <div className="h-4 w-4 animate-pulse rounded bg-surface-3" />
                        <p className="font-mono text-sm text-text-muted">
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
                        ? 'group-hover:text-white text-text-muted'
                        : 'cursor-default text-text-muted'
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

                <p className="text-sm text-text-muted">
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
                      ? 'text-white bg-brand hover:scale-[1.02] hover:bg-brand'
                      : 'cursor-not-allowed bg-surface-3 text-text-muted'
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
    </LazyMotion>
  )
}
