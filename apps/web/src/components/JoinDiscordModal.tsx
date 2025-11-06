import type { CreatorInviteState } from '@/lib/session-storage'
import { useCallback, useState } from 'react'
import { useDiscordUser } from '@/hooks/useDiscordUser'
import { useVoiceChannelEvents } from '@/hooks/useVoiceChannelEvents'
import { useWebSocketAuthToken } from '@/hooks/useWebSocketAuthToken'
import { ExternalLink, Loader2 } from 'lucide-react'
import { createPortal } from 'react-dom'

import type { APIVoiceState } from '@repo/discord-integration/types'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

interface JoinDiscordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Invite state with deep link (used in landing page) */
  pendingInvite?: CreatorInviteState | null
  /** Direct Discord URL (used in game route) */
  discordUrl?: string
  onProceedToGame: () => void
  /** Custom title for the modal */
  title?: string
}

export function JoinDiscordModal({
  open,
  onOpenChange,
  pendingInvite,
  discordUrl,
  onProceedToGame,
  title = '🎮 Your Game Room is Ready!',
}: JoinDiscordModalProps) {
  const { user } = useDiscordUser()
  const { data: wsTokenData } = useWebSocketAuthToken({ userId: user?.id })
  const [userJoinedVoice, setUserJoinedVoice] = useState(false)

  // Listen for voice.joined events when modal is open
  const handleVoiceStateUpdate = useCallback(
    (voiceState: APIVoiceState) => {
      if (
        open &&
        voiceState.user_id === user?.id &&
        voiceState.channel_id != null
      ) {
        console.log('[JoinDiscordModal] User joined voice channel')
        setUserJoinedVoice(true)
      }
    },
    [open, user?.id],
  )

  useVoiceChannelEvents({
    jwtToken: wsTokenData,
    userId: user?.id,
    onVoiceStateUpdate: handleVoiceStateUpdate,
  })

  // Determine which URL to use: deep link from invite or direct Discord URL
  const voiceChannelUrl = pendingInvite?.deepLink || discordUrl

  const modalContent = (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {!userJoinedVoice ? (
            <>
              <p className="text-slate-300">
                To start playing, join the Discord voice channel:
              </p>
              {voiceChannelUrl && (
                <a
                  href={voiceChannelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    className="w-full gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
                    size="lg"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Join Discord Voice Channel
                  </Button>
                </a>
              )}
              <p className="text-center text-sm text-slate-400">
                Waiting for you to join...
                <br />
                <Loader2 className="mt-2 inline h-4 w-4 animate-spin" />
              </p>
            </>
          ) : (
            <>
              <div className="rounded-lg bg-green-500/10 p-4 text-center">
                <p className="text-lg font-semibold text-green-400">
                  ✓ You&apos;re connected!
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  You&apos;ve joined the voice channel. Ready to play?
                </p>
              </div>
              <Button
                onClick={onProceedToGame}
                className="w-full bg-purple-600 text-white hover:bg-purple-700"
                size="lg"
              >
                Enter Game Room
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

  // Render the modal using a portal to document.body
  return createPortal(modalContent, document.body)
}
