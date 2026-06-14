import { AuthRequiredError } from '@convex/errors'
import { runWithConvexSentry } from '@convex/sentry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sentryDsn = 'https://public@example.test/123'

async function expectRejectsWith(
  callback: () => Promise<unknown>,
  expectedError: Error,
) {
  try {
    await callback()
    throw new Error('Expected callback to reject')
  } catch (error) {
    expect(error).toBe(expectedError)
  }
}

describe('Convex Sentry reporting helper', () => {
  const originalDsn = process.env.SENTRY_DSN
  const originalConsoleInfo = console.info
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.SENTRY_DSN = sentryDsn
    fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    console.info = vi.fn()
  })

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN
    } else {
      process.env.SENTRY_DSN = originalDsn
    }
    console.info = originalConsoleInfo
    vi.clearAllMocks()
  })

  it('logs expected domain errors without sending events', async () => {
    const error = new AuthRequiredError()
    const run = () =>
      runWithConvexSentry(
        { feature: 'room', operation: 'join_room' },
        async () => {
          throw error
        },
      )

    await expectRejectsWith(run, error)

    expect(console.info).toHaveBeenCalledWith(
      '[Sentry expected error]',
      '[AUTH_REQUIRED] Authentication required',
      { feature: 'room', operation: 'join_room' },
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps Unauthorized as an expected compatibility error', async () => {
    const error = new Error('Unauthorized')
    const run = () =>
      runWithConvexSentry(
        { feature: 'auth', operation: 'preview_login' },
        async () => {
          throw error
        },
      )

    await expectRejectsWith(run, error)

    expect(console.info).toHaveBeenCalledWith(
      '[Sentry expected error]',
      'Unauthorized',
      { feature: 'auth', operation: 'preview_login' },
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends unexpected errors to Sentry and rethrows them', async () => {
    const error = new Error('boom')
    const run = () =>
      runWithConvexSentry(
        { feature: 'media', operation: 'issue_livekit_token' },
        async () => {
          throw error
        },
      )

    await expectRejectsWith(run, error)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/123/envelope/',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-sentry-envelope' },
      }),
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(init?.body)).toContain('"feature":"media"')
    expect(String(init?.body)).toContain('"operation":"issue_livekit_token"')
    expect(String(init?.body)).toContain('"value":"boom"')
  })

  it('attaches sanitized scoped breadcrumbs to unexpected errors', async () => {
    const error = new Error('boom')
    const run = () =>
      runWithConvexSentry(
        { feature: 'room', operation: 'create_room' },
        async (sentry) => {
          sentry.breadcrumb('room', 'Room creation throttled', {
            roomId: 'ABC123',
            waitMs: 500,
          })
          sentry.breadcrumb('auth', 'Preview login attempted', {
            code: 'secret',
            safe: 'kept',
          })
          throw error
        },
      )

    await expectRejectsWith(run, error)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const [, , payload] = String(init?.body).split('\n')
    const event = JSON.parse(payload ?? '{}')

    expect(event.breadcrumbs).toEqual([
      expect.objectContaining({
        category: 'room',
        message: 'Room creation throttled',
        data: { roomId: '[Filtered]', waitMs: 500 },
      }),
      expect.objectContaining({
        category: 'auth',
        message: 'Preview login attempted',
        data: { code: '[Filtered]', safe: 'kept' },
      }),
    ])
  })
})
