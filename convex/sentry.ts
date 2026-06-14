import type { SentryData } from './sentryData'
import { getErrorCode } from './errors'
import { sanitizeSentryData } from './sentryData'

export interface ConvexSentryMetadata {
  feature: string
  operation: string
  tags?: Record<string, string | number | boolean | undefined>
  extra?: Record<string, SentryData>
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'Error'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isExpectedConvexError(error: unknown): boolean {
  return (
    getErrorCode(error) !== null || getErrorMessage(error) === 'Unauthorized'
  )
}

function parseDsn(dsn: string): { endpoint: string; dsn: string } | null {
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace('/', '')
    if (!projectId) return null
    return {
      dsn,
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    }
  } catch {
    return null
  }
}

function createEventId(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

async function sendSentryEvent(event: Record<string, unknown>) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  const parsed = parseDsn(dsn)
  if (!parsed) return

  const eventId = createEventId()
  const payload = JSON.stringify({
    event_id: eventId,
    platform: 'javascript',
    timestamp: Date.now() / 1000,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.CONVEX_CLOUD_URL,
    release:
      process.env.VITE_SENTRY_RELEASE ??
      process.env.VITE_GITHUB_SHA ??
      process.env.VITE_BUILD_NUMBER,
    server_name: 'convex',
    ...event,
  })
  const payloadLength = new TextEncoder().encode(payload).length

  const envelope = [
    JSON.stringify({ event_id: eventId, dsn: parsed.dsn }),
    JSON.stringify({ type: 'event', length: payloadLength }),
    payload,
  ].join('\n')

  try {
    await fetch(parsed.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: envelope,
    })
  } catch (error) {
    console.error('[Sentry] Failed to send Convex event:', error)
  }
}

export function recordConvexBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, SentryData>,
) {
  console.info(
    '[Sentry breadcrumb]',
    category,
    message,
    sanitizeSentryData(data),
  )
}

export async function captureConvexException(
  error: unknown,
  options: ConvexSentryMetadata,
) {
  if (isExpectedConvexError(error)) {
    recordConvexBreadcrumb('convex.expected_error', getErrorMessage(error), {
      feature: options.feature,
      operation: options.operation,
    })
    return
  }

  await sendSentryEvent({
    level: 'error',
    logger: 'convex',
    tags: {
      service: 'convex',
      feature: options.feature,
      operation: options.operation,
      ...options.tags,
    },
    extra: options.extra ? sanitizeSentryData(options.extra) : undefined,
    exception: {
      values: [
        {
          type: getErrorName(error),
          value: getErrorMessage(error),
        },
      ],
    },
  })
}

export async function captureConvexMessage(
  message: string,
  options: ConvexSentryMetadata,
) {
  await sendSentryEvent({
    level: 'info',
    logger: 'convex',
    message,
    tags: {
      service: 'convex',
      feature: options.feature,
      operation: options.operation,
      ...options.tags,
    },
    extra: options.extra ? sanitizeSentryData(options.extra) : undefined,
  })
}

type ConvexHandler = (...args: any[]) => Promise<unknown>

export function withConvexSentry<THandler extends ConvexHandler>(
  metadata: ConvexSentryMetadata,
  handler: THandler,
): THandler {
  return (async (...args: Parameters<THandler>) => {
    try {
      return await handler(...args)
    } catch (error) {
      await captureConvexException(error, metadata)
      throw error
    }
  }) as THandler
}
