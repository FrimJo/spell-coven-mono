import { FeedbackDialog } from '@/components/FeedbackDialog'
import * as Sentry from '@sentry/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/react', () => ({
  captureFeedback: vi.fn(),
}))

describe('FeedbackDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends trimmed feedback to Sentry User Feedback', () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Feedback'), {
      target: { value: '  The game room is great.  ' },
    })
    fireEvent.change(screen.getByLabelText('Email (optional)'), {
      target: { value: ' player@example.com ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))

    expect(Sentry.captureFeedback).toHaveBeenCalledWith({
      message: 'The game room is great.',
      email: 'player@example.com',
      source: 'beta_banner',
      tags: { feature: 'beta_feedback' },
    })
    expect(screen.getByText('Feedback sent')).toBeTruthy()
  })

  it('omits an empty optional email', () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Feedback'), {
      target: { value: 'Please add a spectator mode.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))

    expect(Sentry.captureFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ email: undefined }),
    )
  })
})
