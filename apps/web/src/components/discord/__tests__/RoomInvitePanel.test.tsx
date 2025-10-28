import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import type { CreatorInviteState } from '@/lib/session-storage'

import { RoomInvitePanel } from '../RoomInvitePanel'

const invite: CreatorInviteState = {
  channelId: '1234567890',
  roleId: '0987654321',
  guildId: '5555555555',
  creatorId: '2222222222',
  token: 'token-abc',
  issuedAt: 1_700_000_000,
  expiresAt: 1_700_000_600,
  shareUrl: 'https://app.example.com/game/1234567890?t=token-abc',
  deepLink: 'https://discord.com/channels/5555555555/1234567890',
  maxSeats: 4,
}

describe('RoomInvitePanel', () => {
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    vi.useRealTimers()
    // @ts-expect-error clipboard is writable in test environment
    navigator.clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    navigator.clipboard = originalClipboard
  })

  it('renders invite information', () => {
    render(
      <RoomInvitePanel
        invite={invite}
        onRefreshInvite={() => undefined}
      />,
    )

    expect(screen.getByLabelText(/Shareable link/i)).toHaveValue(invite.shareUrl)
    expect(screen.getByLabelText(/Discord channel link/i)).toHaveValue(
      invite.deepLink,
    )
    expect(screen.getByText(/Max seats/)).toBeInTheDocument()
  })

  it('copies the invite link when copy button is clicked', async () => {
    render(
      <RoomInvitePanel
        invite={invite}
        onRefreshInvite={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Copy Link/i }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(invite.shareUrl)
    })
    expect(
      screen.getByText(/Invite link copied to clipboard/i),
    ).toBeInTheDocument()
  })

  it('disables refresh button while refreshing', () => {
    const onRefreshInvite = vi.fn()
    render(
      <RoomInvitePanel
        invite={invite}
        onRefreshInvite={onRefreshInvite}
        isRefreshingInvite
      />,
    )

    const refreshButton = screen.getByRole('button', { name: /Refresh Invite/i })
    expect(refreshButton).toBeDisabled()
  })
})
