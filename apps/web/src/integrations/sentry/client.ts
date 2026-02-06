import { env } from '@/env'
import * as Sentry from '@sentry/react'
import { replayIntegration } from '@sentry/replay'

const globalForSentry = globalThis as typeof globalThis & {
  __spellCovenSentryInitialized?: boolean
}

const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'password',
  'authorization',
  'auth',
  'cookie',
  'secret',
  'key',
  'session',
  'code',
  'jwt',
  'refresh',
  'access',
])

const DEFAULT_TRACES_SAMPLE_RATE = 0.2
const DEVELOPMENT_TRACES_SAMPLE_RATE = 1
const DEFAULT_REPLAY_SAMPLE_RATE = 0.05

function parseSampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, Math.min(parsed, 1))
}

function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const target = new URL(url, window.location.origin)
    for (const [key] of target.searchParams) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        target.searchParams.set(key, '[Filtered]')
      }
    }
    return target.toString()
  } catch {
    return url
  }
}

function sanitizeBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
    if (breadcrumb.data?.url) {
      breadcrumb.data.url = sanitizeUrl(breadcrumb.data.url as string)
    }
    if (breadcrumb.data?.body) {
      delete breadcrumb.data.body
    }
    if (breadcrumb.data?.request_body) {
      delete breadcrumb.data.request_body
    }
    if (breadcrumb.data?.response_body) {
      delete breadcrumb.data.response_body
    }
    if (breadcrumb.data?.headers) {
      delete breadcrumb.data.headers
    }
  }

  return breadcrumb
}

function sanitizeEvent(event: Sentry.Event): Sentry.Event | null {
  if (event.request?.url) {
    event.request.url = sanitizeUrl(event.request.url)
  }
  if (event.request?.headers) {
    const headers = { ...event.request.headers }
    for (const key of Object.keys(headers)) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        delete headers[key]
      }
    }
    event.request.headers = headers
  }
  if (event.request?.cookies) {
    delete event.request.cookies
  }
  if (event.request?.data) {
    delete event.request.data
  }

  return event
}

export function initializeSentry() {
  if (globalForSentry.__spellCovenSentryInitialized) return

  const environment =
    import.meta.env.SENTRY_ENVIRONMENT ?? import.meta.env.MODE ?? 'development'
  const release =
    import.meta.env.VITE_SENTRY_RELEASE ?? import.meta.env.VITE_SENTRY_RELEASE
  const isProduction = import.meta.env.PROD
  const dsn = import.meta.env.SENTRY_DSN

  const tracePropagationTargets = [
    new URL(env.VITE_CONVEX_URL).origin,
    /^https:\/\/.*\.convex\.cloud/i,
    /^https:\/\/.*\.convex\.site/i,
    /^https:\/\/.*\.spell-coven/i,
    /^http:\/\/localhost:1234/i,
  ]

  const integrations: Sentry.Integration[] = [
    Sentry.browserTracingIntegration({
      tracePropagationTargets,
    }),
  ]

  if (isProduction) {
    integrations.push(
      replayIntegration({
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    )
  }

  Sentry.init({
    dsn,
    environment,
    release,
    enabled: Boolean(dsn),
    integrations,
    tracesSampleRate: parseSampleRate(
      import.meta.env.SENTRY_TRACES_SAMPLE_RATE,
      isProduction
        ? DEFAULT_TRACES_SAMPLE_RATE
        : DEVELOPMENT_TRACES_SAMPLE_RATE,
    ),
    replaysSessionSampleRate: isProduction
      ? parseSampleRate(
          import.meta.env.SENTRY_REPLAY_SESSION_SAMPLE_RATE,
          DEFAULT_REPLAY_SAMPLE_RATE,
        )
      : 0,
    replaysOnErrorSampleRate: isProduction
      ? parseSampleRate(import.meta.env.SENTRY_REPLAY_ERROR_SAMPLE_RATE, 1)
      : 0,
    maxBreadcrumbs: 50,
    beforeSend: sanitizeEvent,
    beforeBreadcrumb: sanitizeBreadcrumb,
    sendDefaultPii: false,
  })

  Sentry.setTag('service', 'web')
  Sentry.setTag('env', environment)
  if (release) {
    Sentry.setTag('release', release)
  }

  Sentry.setContext('app', {
    name: 'spell-coven-web',
    environment,
  })

  globalForSentry.__spellCovenSentryInitialized = true
}
