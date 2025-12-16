import { useState } from 'react'
import { Check, CheckCircle2, Copy, Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

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

  const handleCopy = async () => {
    if (!createdGameId) return
    const url = `${window.location.origin}/game/${createdGameId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Game room sharable link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-900">
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
            <div className="flex flex-col items-center space-y-6 py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <div className="w-full space-y-2 text-center">
                <p className="text-lg font-medium text-slate-200">
                  Game room created successfully!
                </p>
                <div
                  className="group flex cursor-pointer items-center justify-between rounded-lg border border-slate-700 bg-slate-950 p-3 transition-colors hover:border-purple-500/50"
                  onClick={handleCopy}
                >
                  <div className="text-left">
                    <p className="text-sm text-slate-400">Room ID</p>
                    <p className="font-mono text-lg text-purple-400">
                      {createdGameId}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 group-hover:text-white"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-slate-400">
                  Share this link with your friends to let them join
                </p>
              </div>
              <Button
                onClick={onNavigateToRoom}
                className="w-full bg-purple-600 text-white hover:bg-purple-700"
                size="lg"
              >
                <Play className="mr-2 h-5 w-5" />
                Enter Game Room
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
