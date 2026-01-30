import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, CheckCircle2, Copy, Loader2, Play } from 'lucide-react'
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
        {createdGameId && (
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
            {createdGameId
              ? '🎮 Your Game Room is Ready!'
              : 'Creating Game Room...'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          {isCreating && !createdGameId ? (
            /* Loading State */
            <div className="flex flex-col items-center space-y-4 py-8">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                </div>
                <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/10" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-lg font-medium text-slate-200">
                  Setting up your game room
                </p>
                <p className="text-sm text-slate-400">
                  This will only take a moment...
                </p>
              </div>
            </div>
          ) : createdGameId ? (
            /* Success State */
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.6, bounce: 0.4 }}
              className="flex flex-col items-center space-y-6 py-4"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: 'spring',
                  duration: 0.8,
                  bounce: 0.5,
                  delay: 0.1,
                }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20"
              >
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </motion.div>
              <div className="w-full space-y-2 text-center">
                <p className="text-lg font-medium text-slate-200">
                  Game room created successfully!
                </p>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="group flex cursor-pointer items-center justify-between rounded-lg border border-slate-700 bg-slate-950 p-3 transition-colors hover:border-purple-500/50"
                  onClick={handleCopy}
                >
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm text-slate-400">Share Link</p>
                    <p className="font-mono text-sm text-purple-400 break-all">
                      {shareLink}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 group-hover:text-white shrink-0 ml-2"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-slate-400"
                >
                  Share this link with your friends to let them join
                </motion.p>
              </div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="w-full"
              >
                <Button
                  onClick={onNavigateToRoom}
                  className="w-full bg-purple-600 text-white transition-all hover:scale-[1.02] hover:bg-purple-700"
                  size="lg"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Enter Game Room
                </Button>
              </motion.div>
            </motion.div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
