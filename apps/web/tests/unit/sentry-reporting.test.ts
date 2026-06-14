import {
  addAppBreadcrumb,
  captureAppException,
  sanitizeSentryData,
} from '@/integrations/sentry/reporting'
import * as Sentry from '@sentry/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/react', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  startSpan: vi.fn((...args: unknown[]) => {
    const callback = args[1]
    if (typeof callback !== 'function') return undefined
    return callback()
  }),
}))

describe('sentry reporting helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters sensitive keys and image payloads recursively', () => {
    const sanitized = sanitizeSentryData({
      roomId: 'ABC123',
      nested: {
        deviceId: 'camera-1',
        safe: 'kept',
        imageUrl: 'data:image/png;base64,secret',
        blobUrl: 'blob:https://example.test/secret',
      },
      url: 'https://example.test/path?code=secret&ok=true',
    })

    expect(sanitized).toEqual({
      roomId: '[Filtered]',
      nested: {
        deviceId: '[Filtered]',
        safe: 'kept',
        imageUrl: '[Filtered]',
        blobUrl: '[Filtered]',
      },
      url: 'https://example.test/path?code=%5BFiltered%5D&ok=true',
    })
  })

  it('sends expected states as breadcrumbs without capturing exceptions', () => {
    addAppBreadcrumb('room', 'Room access check: full', {
      roomId: 'ABC123',
      currentCount: 4,
      maxCount: 4,
    })

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'room',
      message: 'Room access check: full',
      level: 'info',
      data: {
        roomId: '[Filtered]',
        currentCount: 4,
        maxCount: 4,
      },
    })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('sanitizes exception context before capture', () => {
    const error = new Error('boom')

    captureAppException(error, {
      tags: { feature: 'media' },
      contexts: {
        media: {
          deviceId: 'camera-1',
          kind: 'videoinput',
        },
      },
      extra: {
        token: 'secret',
      },
    })

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      level: undefined,
      tags: { feature: 'media' },
      contexts: {
        media: {
          deviceId: '[Filtered]',
          kind: 'videoinput',
        },
      },
      extra: {
        token: '[Filtered]',
      },
    })
  })
})
