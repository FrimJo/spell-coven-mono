import type { SentryData } from '@convex/sentryData'
import { sanitizeSentryData } from '@convex/sentryData'
import * as Sentry from '@sentry/react'

export { sanitizeSentryData }

interface CaptureAppExceptionOptions {
  tags?: Record<string, string | number | boolean | undefined>
  contexts?: Record<string, Record<string, SentryData>>
  extra?: Record<string, SentryData>
  level?: Sentry.SeverityLevel
}

interface AppSpanOptions {
  name: string
  op: string
  attributes?: Record<string, string | number | boolean | undefined>
}

export function addAppBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, SentryData>,
) {
  Sentry.addBreadcrumb({
    category,
    message,
    level: 'info',
    data: data ? sanitizeSentryData(data) : undefined,
  })
}

export function captureAppException(
  error: unknown,
  options: CaptureAppExceptionOptions = {},
) {
  Sentry.captureException(error, {
    level: options.level,
    tags: options.tags,
    contexts: options.contexts
      ? sanitizeSentryData(options.contexts)
      : undefined,
    extra: options.extra ? sanitizeSentryData(options.extra) : undefined,
  })
}

export async function startAppSpan<T>(
  options: AppSpanOptions,
  callback: () => Promise<T>,
): Promise<T> {
  return await Sentry.startSpan(
    {
      name: options.name,
      op: options.op,
      attributes: options.attributes,
    },
    callback,
  )
}

export function startAppSpanSync<T>(
  options: AppSpanOptions,
  callback: () => T,
): T {
  return Sentry.startSpan(
    {
      name: options.name,
      op: options.op,
      attributes: options.attributes,
    },
    callback,
  )
}
