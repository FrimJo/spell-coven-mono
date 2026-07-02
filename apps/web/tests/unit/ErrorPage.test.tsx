import { ErrorPage } from '@/components/ErrorPage'
import * as Sentry from '@sentry/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(() => 'error-event-id'),
  captureFeedback: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

describe('ErrorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('attaches the user report to the captured exception', () => {
    const error = new Error('The stack rejected this spell')
    render(<ErrorPage error={error} reset={vi.fn()} />)

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { source: 'router_default_error' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Report this fizzle' }))
    fireEvent.change(screen.getByLabelText('What happened?'), {
      target: { value: 'The room vanished when I joined.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

    expect(Sentry.captureFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'The room vanished when I joined.',
        associatedEventId: 'error-event-id',
      }),
    )
  })
})
