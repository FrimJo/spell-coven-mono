import type { CreatorInviteState } from '@/lib/session-storage'
import { useCallback, useMemo, useState } from 'react'

import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { InlineMessage } from '@repo/ui/components/inline-message'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'

export interface RoomInvitePanelProps {
  invite: CreatorInviteState
  onRefreshInvite: () => void | Promise<void>
  isRefreshingInvite?: boolean
}

type CopyStatus = 'idle' | 'copied' | 'error'

function formatExpiry(expiresAt: number): string {
  const remainingMs = expiresAt * 1000 - Date.now()
  if (remainingMs <= 0) {
    return 'Expired'
  }

  const remainingMinutes = Math.floor(remainingMs / (60 * 1000))
  if (remainingMinutes < 1) {
    const remainingSeconds = Math.floor(remainingMs / 1000)
    return `Expires in ${remainingSeconds}s`
  }

  return `Expires in ${remainingMinutes}m`
}

function formatExactExpiry(expiresAt: number): string {
  const date = new Date(expiresAt * 1000)
  return date.toLocaleString()
}

export function RoomInvitePanel({
  invite,
  onRefreshInvite,
  isRefreshingInvite,
}: RoomInvitePanelProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  const expiresInLabel = useMemo(
    () => formatExpiry(invite.expiresAt),
    [invite.expiresAt],
  )

  const exactExpiry = useMemo(
    () => formatExactExpiry(invite.expiresAt),
    [invite.expiresAt],
  )

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invite.shareUrl)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = invite.shareUrl
        textArea.setAttribute('readonly', '')
        textArea.style.position = 'absolute'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopyStatus('copied')
    } catch (error) {
      console.error('Failed to copy invite link', error)
      setCopyStatus('error')
    } finally {
      // Always reset copy status after 2500ms
      setTimeout(() => {
        setCopyStatus('idle')
      }, 2500)
    }
  }, [invite.shareUrl])

  const copyMessage = useMemo(() => {
    if (copyStatus === 'copied') {
      return {
        variant: 'info' as const,
        message: 'Invite link copied to clipboard.',
      }
    }

    if (copyStatus === 'error') {
      return {
        variant: 'error' as const,
        message: 'Unable to copy invite link. Please copy it manually.',
      }
    }

    return null
  }, [copyStatus])

  return (
    <Card className="border-purple-500/40 bg-purple-500/5 shadow-lg backdrop-blur">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold text-purple-100">
              Private Room Invite
            </CardTitle>
            <CardDescription className="text-slate-200/80">
              Share this link with friends so they can join your private Discord
              voice room.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-purple-500/20 text-purple-100"
            >
              {expiresInLabel}
            </Badge>
            {typeof invite.maxSeats === 'number' && (
              <Badge
                variant="outline"
                className="border-purple-500/50 text-purple-100"
              >
                Max seats: {invite.maxSeats}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {copyMessage && (
          <InlineMessage
            variant={copyMessage.variant}
            message={copyMessage.message}
            className="border-purple-500/40 bg-purple-500/10 text-purple-100"
          />
        )}
        <div className="space-y-2">
          <Label htmlFor="room-invite-share" className="text-slate-200">
            Shareable link
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="room-invite-share"
              value={invite.shareUrl}
              readOnly
              className="bg-slate-950/60 text-slate-100"
            />
            <Button onClick={handleCopy} className="shrink-0 bg-purple-600">
              Copy Link
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="room-invite-deeplink" className="text-slate-200">
            Discord channel link
          </Label>
          <Input
            id="room-invite-deeplink"
            value={invite.deepLink}
            readOnly
            className="bg-slate-950/60 text-slate-100"
          />
        </div>
        <p className="text-xs text-slate-300/70">
          Invite expires on {exactExpiry}. Regenerate a fresh token if the link
          stops working or you need more time.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-300/80">
          Room ID <span className="font-mono">{invite.channelId}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" asChild>
            <a
              href={invite.deepLink}
              target="_blank"
              rel="noreferrer"
              className="text-purple-200 hover:text-purple-100"
            >
              Open in Discord
            </a>
          </Button>
          <Button
            variant="secondary"
            onClick={onRefreshInvite}
            disabled={isRefreshingInvite}
            className="bg-purple-500/80 text-purple-100 hover:bg-purple-500"
          >
            {isRefreshingInvite ? 'Refreshing…' : 'Refresh Invite'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
