import { useCallback } from 'react'
import { env } from '@/env'
import { useDiscordUser } from '@/hooks/useDiscordUser'
import { useVoiceChannelEvents } from '@/hooks/useVoiceChannelEvents'
import { useWebSocketAuthToken } from '@/hooks/useWebSocketAuthToken'
import { getRouteApi } from '@tanstack/react-router'
import { AlertCircle, ExternalLink } from 'lucide-react'

import type { APIVoiceState } from '@repo/discord-integration/types'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

interface VoiceDropoutModalProps {
  open: boolean
  onRejoin: () => void
  onLeaveGame: () => void
}

const GameRoomRoute = getRouteApi('/game/$gameId')

/**
 * Modal shown when user is removed from voice channel
 *
 * Offers two options:
 * - Rejoin: Close modal and rejoin from Discord
 * - Leave: Return to landing page
 */
export function VoiceDropoutModal({
  open,
  onRejoin,
  onLeaveGame,
}: VoiceDropoutModalProps) {
  const { gameId } = GameRoomRoute.useParams()
  const { user } = useDiscordUser()
  const { data: wsTokenData } = useWebSocketAuthToken({ userId: user?.id })

  // Listen for voice.joined events when modal is open
  const handleVoiceStateUpdate = useCallback(
    (voiceState: APIVoiceState) => {
      if (open && voiceState.user_id === user?.id) {
        console.log('[JoinDiscordModal] User joined voice channel')
        onRejoin()
      }
    },
    [onRejoin, open, user?.id],
  )

  useVoiceChannelEvents({
    jwtToken: wsTokenData,
    onVoiceStateUpdate: handleVoiceStateUpdate,
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        // Prevent closing by clicking outside or pressing Escape
        if (!newOpen) return
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            <DialogTitle>Disconnected from Voice Channel</DialogTitle>
          </div>
          <DialogDescription className="mt-2">
            You&apos;ve been removed from the voice channel. Would you like to
            rejoin or leave the game?
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onLeaveGame} className="flex-1">
            Leave Game
          </Button>

          <Button variant="outline" className="flex-1" asChild>
            <a
              href={`https://discord.com/channels/${env.VITE_DISCORD_GUILD_ID}/${gameId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              Rejoin from Discord
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
